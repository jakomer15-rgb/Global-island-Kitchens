import { z } from "zod";
import type { Prisma, SocialPostStatus } from "@/generated/prisma/client";
import {
  autoPublishable,
  bahrainDateTime,
  composeCaption,
  missingForApproval,
  normaliseHashtags,
  socialPlatforms,
  socialPostTypes,
  type SocialPlatformKey,
  type SocialPostTypeKey,
  type SocialStatusKey,
} from "@/lib/social";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import { notify, paged, pageArgs } from "@/server/crm/shared";
import type { Db, Tx } from "@/server/db/client";
import { env as readEnv, type Env } from "@/server/env";
import { NotFoundError, RuleError } from "@/server/errors";
import type { ChannelResult } from "@/server/outbox/deliver";
import { enqueue } from "@/server/outbox/events";
import { getStorage, type StorageDriver } from "@/server/storage/driver";
import {
  fetchMetaMetrics,
  instagramReady,
  MetaError,
  metaReady,
  publishToFacebook,
  publishToInstagram,
  type Metrics,
  type Published,
} from "./meta";

/**
 * Social media posts (Stage 6). The rules:
 * - staff with `social.manage` write posts (or have the AI draft them) and send them for approval;
 * - only `social.publish` approves, schedules or publishes, and nothing is published unless approved
 *   (also enforced by the database);
 * - approved content can't change: editing sends the post back to draft and needs approval again;
 * - Facebook and Instagram photo posts are published through Meta's official API; reels, LinkedIn and
 *   TikTok are posted by hand and marked as posted, so the calendar stays complete.
 */

export const postInput = z.object({
  title: z.string().trim().min(2, "Name the post (at least 2 characters).").max(160),
  brief: z.string().trim().max(2000).optional(),
  type: z.enum(socialPostTypes),
  platforms: z.array(z.enum(socialPlatforms)).min(1, "Choose at least one platform.").max(4),
  language: z.enum(["en", "ar", "both"]),
  captionEn: z.string().trim().max(2200).optional(),
  captionAr: z.string().trim().max(2200).optional(),
  hashtags: z.string().max(2000).optional(),
  script: z.string().trim().max(5000).optional(),
  imageBrief: z.string().trim().max(2000).optional(),
  imageFileId: z.string().optional(),
  /** Bahrain day and time, "2026-11-14" and "19:00". */
  plannedDay: z.string().optional(),
  plannedTime: z.string().optional(),
  campaignId: z.string().optional(),
});
export type PostInput = z.infer<typeof postInput>;

const LOCKED: SocialPostStatus[] = ["approved", "scheduled", "published", "failed"];

/** A website image that may be used publicly: published by staff, and, for a project photo, with permission. */
export async function assertUsableImage(tx: Tx | Db, fileId: string) {
  const file = await tx.fileAsset.findFirst({
    where: { id: fileId, visibility: "public", status: "verified", quotationRequestId: null },
    select: { id: true, mimeType: true, portfolioImages: { select: { usagePermission: true } } },
  });
  if (!file || !file.mimeType.startsWith("image/"))
    throw new RuleError("imageFileId", "Choose a published website image.");
  if (file.portfolioImages.length && !file.portfolioImages.some((i) => i.usagePermission))
    throw new RuleError("imageFileId", "This project photo has no confirmed permission to be used.");
  return file;
}

function plannedAt(input: PostInput): Date | null {
  if (!input.plannedDay) return null;
  const at = bahrainDateTime(input.plannedDay, input.plannedTime || "19:00");
  if (!at) throw new RuleError("plannedDay", "Choose a valid day and time.");
  return at;
}

async function postData(tx: Tx | Db, input: PostInput) {
  if (input.imageFileId) await assertUsableImage(tx, input.imageFileId);
  if (input.campaignId) {
    const c = await tx.socialCampaign.findUnique({ where: { id: input.campaignId }, select: { id: true } });
    if (!c) throw new RuleError("campaignId", "Unknown campaign.");
  }
  return {
    title: input.title,
    brief: input.brief || null,
    type: input.type,
    platforms: [...new Set(input.platforms)],
    language: input.language,
    captionEn: input.captionEn || null,
    captionAr: input.captionAr || null,
    hashtags: normaliseHashtags(input.hashtags ?? ""),
    script: input.script || null,
    imageBrief: input.imageBrief || null,
    imageFileId: input.imageFileId || null,
    plannedAt: plannedAt(input),
    campaignId: input.campaignId || null,
  };
}

export async function createPost(db: Db, actor: Actor, input: PostInput) {
  assertCan(actor, "social.manage");
  return db.$transaction(async (tx) => {
    const post = await tx.socialPost.create({
      data: { ...(await postData(tx, input)), createdById: actor.id },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "social_post.created",
      entityType: "social_post",
      entityId: post.id,
      changes: { title: post.title },
    });
    return post;
  });
}

async function draftPost(tx: Tx, id: string) {
  const post = await tx.socialPost.findUnique({ where: { id } });
  if (!post) throw new NotFoundError("Post");
  if (post.status !== "draft")
    throw new RuleError("notDraft", "Only a draft can be changed. Send it back to draft first.");
  return post;
}

export async function updatePost(db: Db, actor: Actor, id: string, input: PostInput) {
  assertCan(actor, "social.manage");
  await db.$transaction(async (tx) => {
    await draftPost(tx, id);
    await tx.socialPost.update({ where: { id }, data: await postData(tx, input) });
    await audit(tx, {
      actorId: actor.id,
      action: "social_post.updated",
      entityType: "social_post",
      entityId: id,
    });
  });
}

/** Picks the post's photo (e.g. one the AI suggested). Draft posts only. */
export async function setPostImage(db: Db, actor: Actor, id: string, fileId: string | null) {
  assertCan(actor, "social.manage");
  await db.$transaction(async (tx) => {
    await draftPost(tx, id);
    if (fileId) await assertUsableImage(tx, fileId);
    await tx.socialPost.update({ where: { id }, data: { imageFileId: fileId } });
  });
}

/** Moves a draft in the calendar (or a post waiting for approval, without changing what was approved). */
export async function movePost(db: Db, actor: Actor, id: string, day: string, time: string) {
  assertCan(actor, "social.manage");
  const at = bahrainDateTime(day, time);
  if (!at) throw new RuleError("plannedDay", "Choose a valid day and time.");
  await db.$transaction(async (tx) => {
    const post = await tx.socialPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundError("Post");
    if (post.status !== "draft" && post.status !== "pending_approval")
      throw new RuleError("state", "An approved post is rescheduled by an approver.");
    await tx.socialPost.update({ where: { id }, data: { plannedAt: at } });
  });
}

export async function deletePost(db: Db, actor: Actor, id: string) {
  assertCan(actor, "social.manage");
  await db.$transaction(async (tx) => {
    const post = await tx.socialPost.findUnique({ where: { id }, include: { targets: true } });
    if (!post) throw new NotFoundError("Post");
    if (post.status === "published" || post.targets.some((t) => t.status === "published"))
      throw new RuleError("published", "A published post is kept as a record.");
    if (LOCKED.includes(post.status) && !actor.permissions.has("social.publish"))
      throw new RuleError("approved", "An approved post can only be removed by an approver.");
    await tx.socialPost.delete({ where: { id } });
    await audit(tx, {
      actorId: actor.id,
      action: "social_post.deleted",
      entityType: "social_post",
      entityId: id,
      changes: { title: post.title, status: post.status },
    });
  });
}

async function approvers(tx: Tx) {
  return tx.user.findMany({
    where: {
      kind: "staff",
      status: "active",
      roles: { some: { role: { permissions: { some: { permissionKey: "social.publish" } } } } },
    },
    select: { id: true },
  });
}

export async function submitPost(db: Db, actor: Actor, id: string, now = new Date()) {
  assertCan(actor, "social.manage");
  await db.$transaction(async (tx) => {
    const post = await draftPost(tx, id);
    const missing = missingForApproval(post);
    if (missing.length) throw new RuleError("incomplete", missing.join(" "));
    await tx.socialPost.update({
      where: { id },
      data: { status: "pending_approval", submittedAt: now, decisionNote: null },
    });
    for (const a of await approvers(tx))
      if (a.id !== actor.id)
        await notify(tx, a.id, `Social media post to approve: ${post.title}`, `/admin/social/${id}`);
    await audit(tx, {
      actorId: actor.id,
      action: "social_post.submitted",
      entityType: "social_post",
      entityId: id,
    });
  });
}

/** Back to draft to change it: approval is withdrawn; platforms not yet published are cleared. */
export async function reopenPost(db: Db, actor: Actor, id: string) {
  assertCan(actor, "social.manage");
  await db.$transaction(async (tx) => {
    const post = await tx.socialPost.findUnique({ where: { id }, include: { targets: true } });
    if (!post) throw new NotFoundError("Post");
    if (post.status === "draft") return;
    if (post.status === "published" || post.targets.some((t) => t.status === "published"))
      throw new RuleError("published", "It is already published on a platform, so it can't be changed.");
    if (LOCKED.includes(post.status) && !actor.permissions.has("social.publish"))
      throw new RuleError("approved", "An approved post can only be sent back to draft by an approver.");
    await tx.socialPostTarget.deleteMany({ where: { postId: id } });
    await tx.socialPost.update({
      where: { id },
      data: { status: "draft", approvedAt: null, decidedById: null, submittedAt: null, lastError: null },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "social_post.reopened",
      entityType: "social_post",
      entityId: id,
    });
  });
}

/** Which platforms publish automatically now (connection set up and the post type supported). */
export function targetStatus(
  platform: SocialPlatformKey,
  type: SocialPostTypeKey,
  e: Pick<Env, "META_PAGE_ID" | "META_PAGE_ACCESS_TOKEN" | "META_INSTAGRAM_ACCOUNT_ID">,
): "pending" | "manual" {
  if (!autoPublishable(platform, type)) return "manual";
  if (platform === "facebook") return metaReady(e) ? "pending" : "manual";
  if (platform === "instagram") return instagramReady(e) ? "pending" : "manual";
  return "manual";
}

async function queuedPublish(tx: Tx, postId: string) {
  return (
    (await tx.outboxEvent.count({
      where: {
        type: "social.publish",
        status: { in: ["pending", "processing"] },
        payload: { path: ["postId"], equals: postId },
      },
    })) > 0
  );
}

async function enqueuePublish(tx: Tx, postId: string) {
  if (await queuedPublish(tx, postId)) return false;
  await tx.socialPostTarget.updateMany({
    where: { postId, status: "failed" },
    data: { status: "pending", error: null },
  });
  await enqueue(tx, "social.publish", { postId });
  return true;
}

export const decisionInput = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
  /** After approval: keep it approved, schedule it at its planned time, or publish now. */
  then: z.enum(["keep", "schedule", "now"]).default("keep"),
});

/**
 * Approve (with what happens next) or reject (back to draft with the reason). Creates one result row
 * per platform: "pending" where it publishes automatically, "manual" where staff post it by hand.
 */
export async function decidePost(
  db: Db,
  actor: Actor,
  id: string,
  input: z.input<typeof decisionInput>,
  e: Env = readEnv(),
  now = new Date(),
) {
  assertCan(actor, "social.publish");
  const d = decisionInput.parse(input);
  return db.$transaction(async (tx) => {
    const post = await tx.socialPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundError("Post");
    if (post.status !== "pending_approval")
      throw new RuleError("state", "This post isn't waiting for approval.");
    if (!d.approve) {
      await tx.socialPost.update({
        where: { id },
        data: { status: "draft", decidedById: actor.id, decisionNote: d.note || null, submittedAt: null },
      });
      if (post.createdById && post.createdById !== actor.id)
        await notify(tx, post.createdById, `Post not approved: ${post.title}`, `/admin/social/${id}`, d.note);
      await audit(tx, {
        actorId: actor.id,
        action: "social_post.rejected",
        entityType: "social_post",
        entityId: id,
        changes: { note: d.note || null },
      });
      return { status: "draft" as const, queued: false };
    }
    const missing = missingForApproval(post);
    if (missing.length) throw new RuleError("incomplete", missing.join(" "));
    if (d.then === "schedule" && (!post.plannedAt || post.plannedAt <= now))
      throw new RuleError("plannedAt", "Choose a planned time in the future first, or publish now.");
    await tx.socialPostTarget.createMany({
      data: post.platforms.map((platform) => ({
        postId: id,
        platform,
        status: targetStatus(platform, post.type, e),
      })),
    });
    const status = d.then === "schedule" ? "scheduled" : "approved";
    await tx.socialPost.update({
      where: { id },
      data: { status, approvedAt: now, decidedById: actor.id, decisionNote: d.note || null },
    });
    const queued = d.then === "now" ? await enqueuePublish(tx, id) : false;
    if (post.createdById && post.createdById !== actor.id)
      await notify(tx, post.createdById, `Post approved: ${post.title}`, `/admin/social/${id}`);
    await audit(tx, {
      actorId: actor.id,
      action: "social_post.approved",
      entityType: "social_post",
      entityId: id,
      changes: { then: d.then, note: d.note || null },
    });
    return { status, queued };
  });
}

export async function schedulePost(db: Db, actor: Actor, id: string, at: Date, now = new Date()) {
  assertCan(actor, "social.publish");
  if (at <= now) throw new RuleError("plannedAt", "Choose a time in the future.");
  await db.$transaction(async (tx) => {
    const post = await tx.socialPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundError("Post");
    if (post.status !== "approved" && post.status !== "scheduled")
      throw new RuleError("state", "Only an approved post can be scheduled.");
    await tx.socialPost.update({ where: { id }, data: { status: "scheduled", plannedAt: at } });
    await audit(tx, {
      actorId: actor.id,
      action: "social_post.scheduled",
      entityType: "social_post",
      entityId: id,
      changes: { at: at.toISOString() },
    });
  });
}

export async function unschedulePost(db: Db, actor: Actor, id: string) {
  assertCan(actor, "social.publish");
  await db.$transaction(async (tx) => {
    const post = await tx.socialPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundError("Post");
    if (post.status !== "scheduled") throw new RuleError("state", "This post isn't scheduled.");
    await tx.socialPost.update({ where: { id }, data: { status: "approved" } });
    await audit(tx, {
      actorId: actor.id,
      action: "social_post.unscheduled",
      entityType: "social_post",
      entityId: id,
    });
  });
}

/** Queues an approved (or failed) post for publishing now. Returns false when it is already queued. */
export async function publishPostNow(db: Db, actor: Actor, id: string) {
  assertCan(actor, "social.publish");
  return db.$transaction(async (tx) => {
    const post = await tx.socialPost.findUnique({ where: { id }, include: { targets: true } });
    if (!post) throw new NotFoundError("Post");
    if (!["approved", "scheduled", "failed"].includes(post.status) || !post.approvedAt)
      throw new RuleError("state", "Only an approved post can be published.");
    if (!post.targets.some((t) => t.status === "pending" || t.status === "failed"))
      throw new RuleError(
        "manualOnly",
        "None of its platforms publishes automatically: post it by hand and mark it below.",
      );
    if (post.status === "scheduled")
      await tx.socialPost.update({ where: { id }, data: { status: "approved" } });
    const queued = await enqueuePublish(tx, id);
    await audit(tx, {
      actorId: actor.id,
      action: "social_post.publish_requested",
      entityType: "social_post",
      entityId: id,
    });
    return queued;
  });
}

/** Post status from its platform results: published when nothing is waiting or failed. */
async function settle(tx: Tx, postId: string, now: Date) {
  const post = await tx.socialPost.findUniqueOrThrow({ where: { id: postId }, include: { targets: true } });
  if (post.status === "published") return post.status;
  const waiting = post.targets.some((t) => t.status === "pending");
  const failed = post.targets.filter((t) => t.status === "failed");
  const published = post.targets.filter((t) => t.status === "published");
  let status: SocialPostStatus = post.status;
  if (failed.length) status = "failed";
  else if (!waiting && published.length) status = "published";
  if (status !== post.status || failed.length) {
    await tx.socialPost.update({
      where: { id: postId },
      data: {
        status,
        lastError: failed.length
          ? failed
              .map((t) => `${t.platform}: ${t.error ?? "failed"}`)
              .join(" · ")
              .slice(0, 500)
          : null,
        ...(status === "published"
          ? { publishedAt: published.reduce((max, t) => (t.publishedAt! > max ? t.publishedAt! : max), now) }
          : {}),
      },
    });
  }
  return status;
}

/** Records a post made by hand on a platform (with its link when given). */
export async function markPostedByHand(
  db: Db,
  actor: Actor,
  targetId: string,
  permalink: string | undefined,
  now = new Date(),
) {
  assertCan(actor, "social.publish");
  if (permalink && !/^https:\/\/[^\s]{4,500}$/.test(permalink))
    throw new RuleError("permalink", "The link should start with https://.");
  await db.$transaction(async (tx) => {
    const t = await tx.socialPostTarget.findUnique({ where: { id: targetId }, include: { post: true } });
    if (!t) throw new NotFoundError("Platform");
    if (!["approved", "scheduled", "failed", "published"].includes(t.post.status))
      throw new RuleError("state", "Only an approved post can be marked as posted.");
    if (t.status === "published") return;
    if (t.status === "pending")
      throw new RuleError("auto", "This platform publishes automatically; use Publish now.");
    await tx.socialPostTarget.update({
      where: { id: targetId },
      data: { status: "published", publishedAt: now, permalink: permalink || null, error: null },
    });
    await settle(tx, t.postId, now);
    await audit(tx, {
      actorId: actor.id,
      action: "social_post.posted_by_hand",
      entityType: "social_post",
      entityId: t.postId,
      changes: { platform: t.platform },
    });
  });
}

export interface PublishDeps {
  facebook?: typeof publishToFacebook;
  instagram?: typeof publishToInstagram;
  storage?: StorageDriver | null;
  now?: () => Date;
}

/**
 * Outbox delivery: publishes every waiting platform of one approved post. Published platforms are never
 * repeated. Throws (so the outbox retries) when a platform failed for a reason a retry may fix.
 */
export async function publishSocialPost(
  db: Db,
  e: Env,
  postId: string,
  deps: PublishDeps = {},
): Promise<ChannelResult> {
  const now = deps.now ?? (() => new Date());
  const post = await db.socialPost.findUnique({
    where: { id: postId },
    include: { targets: true, image: { select: { storageKey: true, originalName: true, mimeType: true } } },
  });
  if (!post || !post.approvedAt || !["approved", "scheduled", "failed"].includes(post.status))
    return "skipped";
  const due = post.targets.filter((t) => t.status === "pending");
  if (!due.length) return "skipped";
  const caption = composeCaption(post);
  let imageUrl: string | null = null;
  if (post.image) {
    const storage = deps.storage === undefined ? getStorage() : deps.storage;
    if (storage)
      imageUrl = await storage.downloadUrl(
        post.image.storageKey,
        post.image.originalName,
        post.image.mimeType,
        3600,
      );
  }
  const retryable: string[] = [];
  for (const t of due) {
    let result: Published;
    try {
      if (t.platform === "facebook") {
        if ((post.type === "image" || post.type === "story") && !imageUrl)
          throw new MetaError("The photo isn't available (file storage isn't connected).", false);
        result = await (deps.facebook ?? publishToFacebook)(e, { caption, imageUrl });
      } else if (t.platform === "instagram") {
        if (!imageUrl || !post.image)
          throw new MetaError("Instagram needs a photo from file storage.", false);
        result = await (deps.instagram ?? publishToInstagram)(e, {
          caption,
          imageUrl,
          mimeType: post.image.mimeType,
          story: post.type === "story",
        });
      } else {
        throw new MetaError("This platform isn't published automatically.", false);
      }
    } catch (error) {
      const message = error instanceof MetaError ? error.message : "Publishing failed unexpectedly.";
      if (!(error instanceof MetaError)) console.error("Social publishing failed", t.platform, error);
      if (!(error instanceof MetaError) || error.retry) retryable.push(`${t.platform}: ${message}`);
      await db.socialPostTarget.update({
        where: { id: t.id },
        data: { status: "failed", error: message.slice(0, 300) },
      });
      continue;
    }
    await db.socialPostTarget.update({
      where: { id: t.id },
      data: {
        status: "published",
        publishedAt: now(),
        externalId: result.externalId,
        permalink: result.permalink,
        error: null,
      },
    });
  }
  await db.$transaction((tx) => settle(tx, postId, now()));
  if (retryable.length) throw new Error(retryable.join("; "));
  return "sent";
}

/** Scheduled job: queues scheduled posts whose time has come. */
export async function queueDuePosts(db: Db, now = new Date()) {
  const due = await db.socialPost.findMany({
    where: { status: "scheduled", plannedAt: { lte: now }, approvedAt: { not: null } },
    select: { id: true },
    take: 50,
  });
  let queued = 0;
  for (const p of due) if (await db.$transaction((tx) => enqueuePublish(tx, p.id))) queued++;
  return { queued };
}

/** Reads likes, comments and shares for posts published through Meta in the last 60 days. */
export async function refreshEngagement(
  db: Db,
  e: Env = readEnv(),
  options: {
    fetchMetrics?: (platform: "facebook" | "instagram", externalId: string) => Promise<Metrics>;
    now?: Date;
  } = {},
) {
  if (!metaReady(e)) return { updated: 0, failed: 0, skipped: "not_configured" as const };
  const now = options.now ?? new Date();
  const targets = await db.socialPostTarget.findMany({
    where: {
      status: "published",
      externalId: { not: null },
      platform: { in: ["facebook", "instagram"] },
      publishedAt: { gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { metricsAt: { sort: "asc", nulls: "first" } },
    take: 50,
  });
  const get = options.fetchMetrics ?? ((p, id) => fetchMetaMetrics(e, p, id));
  let updated = 0;
  let failed = 0;
  for (const t of targets) {
    try {
      const m = await get(t.platform as "facebook" | "instagram", t.externalId!);
      await db.socialPostTarget.update({ where: { id: t.id }, data: { ...m, metricsAt: now } });
      updated++;
    } catch {
      failed++;
    }
  }
  return { updated, failed };
}

/** Engagement refresh started by a person (Performance page); limited by the caller. */
export async function refreshEngagementNow(db: Db, actor: Actor, e: Env = readEnv()) {
  assertCan(actor, "social.manage");
  if (!metaReady(e))
    throw new RuleError("notConnected", "Meta isn't connected yet, so there are no figures to read.");
  return refreshEngagement(db, e);
}

// ─── Reading ──────────────────────────────────────────────────────────────────

export const postListInclude = {
  targets: { select: { id: true, platform: true, status: true } },
  campaign: { select: { id: true, name: true } },
} satisfies Prisma.SocialPostInclude;

/** Posts planned (or published) between two instants, for the calendar, plus drafts with no date. */
export async function calendarPosts(
  db: Db,
  actor: Actor,
  start: Date,
  end: Date,
  filters: { status?: SocialPostStatus; platform?: SocialPlatformKey; campaignId?: string } = {},
) {
  assertCan(actor, "social.manage");
  const where: Prisma.SocialPostWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.platform ? { platforms: { has: filters.platform } } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
  };
  const [dated, undated, counts] = await Promise.all([
    db.socialPost.findMany({
      where: {
        ...where,
        OR: [
          { plannedAt: { gte: start, lt: end } },
          { plannedAt: null, publishedAt: { gte: start, lt: end } },
        ],
      },
      orderBy: [{ plannedAt: "asc" }, { publishedAt: "asc" }],
      include: postListInclude,
      take: 500,
    }),
    db.socialPost.findMany({
      where: { ...where, plannedAt: null, publishedAt: null },
      orderBy: { createdAt: "desc" },
      include: postListInclude,
      take: 50,
    }),
    db.socialPost.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    dated,
    undated,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<
      Record<SocialPostStatus, number>
    >,
  };
}

export interface PostFilters {
  q?: string;
  status?: SocialStatusKey;
  platform?: SocialPlatformKey;
  campaignId?: string;
  sort?: "planned" | "newest" | "published";
  page?: number;
}

/** All posts as a list, with filters (for search and bulk review). */
export async function listPosts(db: Db, actor: Actor, f: PostFilters) {
  assertCan(actor, "social.manage");
  const where: Prisma.SocialPostWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.platform ? { platforms: { has: f.platform } } : {}),
    ...(f.campaignId ? { campaignId: f.campaignId } : {}),
    ...(f.q
      ? {
          OR: [
            { title: { contains: f.q, mode: "insensitive" } },
            { captionEn: { contains: f.q, mode: "insensitive" } },
            { captionAr: { contains: f.q } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.SocialPostOrderByWithRelationInput[] =
    f.sort === "newest"
      ? [{ createdAt: "desc" }]
      : f.sort === "published"
        ? [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
        : [{ plannedAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }];
  const { skip, take, page } = pageArgs(f.page);
  const [items, total] = await Promise.all([
    db.socialPost.findMany({
      where,
      orderBy,
      skip,
      take,
      include: { ...postListInclude, createdBy: { select: { name: true } } },
    }),
    db.socialPost.count({ where }),
  ]);
  return paged(items, total, page);
}

export async function getPost(db: Db, actor: Actor, id: string) {
  assertCan(actor, "social.manage");
  const post = await db.socialPost.findUnique({
    where: { id },
    include: {
      targets: { orderBy: { platform: "asc" } },
      campaign: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      decidedBy: { select: { name: true } },
      image: { select: { id: true, originalName: true, mimeType: true } },
    },
  });
  if (!post) throw new NotFoundError("Post");
  return post;
}

/** Published website images that may be used in posts (portfolio photos need usage permission). */
export async function usableImages(db: Db | Tx, limit = 120) {
  const files = await db.fileAsset.findMany({
    where: {
      visibility: "public",
      status: "verified",
      quotationRequestId: null,
      mimeType: { startsWith: "image/" },
      OR: [{ portfolioImages: { none: {} } }, { portfolioImages: { some: { usagePermission: true } } }],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      kind: true,
      portfolioImages: {
        where: { usagePermission: true },
        take: 1,
        select: {
          altEn: true,
          project: { select: { nameEn: true, locationEn: true, scopeEn: true, published: true } },
        },
      },
    },
  });
  return files.map((f) => {
    const p = f.portfolioImages[0];
    return {
      id: f.id,
      name: f.originalName,
      mimeType: f.mimeType,
      kind: f.kind,
      label: p ? `${p.project.nameEn} — ${p.altEn}` : f.originalName,
      project: p
        ? { name: p.project.nameEn, location: p.project.locationEn, scope: p.project.scopeEn, alt: p.altEn }
        : null,
    };
  });
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const socialCampaignInput = z.object({
  name: z.string().trim().min(2, "Name the campaign.").max(120),
  objective: z.string().trim().max(1000).optional(),
  startsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function createSocialCampaign(db: Db, actor: Actor, input: z.infer<typeof socialCampaignInput>) {
  assertCan(actor, "social.manage");
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn)
    throw new RuleError("endsOn", "The end date is before the start date.");
  return db.$transaction(async (tx) => {
    const c = await tx.socialCampaign.create({
      data: {
        name: input.name,
        objective: input.objective || null,
        startsOn: input.startsOn ? new Date(`${input.startsOn}T00:00:00Z`) : null,
        endsOn: input.endsOn ? new Date(`${input.endsOn}T00:00:00Z`) : null,
        createdById: actor.id,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "social_campaign.created",
      entityType: "social_campaign",
      entityId: c.id,
      changes: { name: c.name },
    });
    return c;
  });
}

export async function listSocialCampaigns(db: Db, actor: Actor) {
  assertCan(actor, "social.manage");
  const campaigns = await db.socialCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { posts: true } } },
  });
  const byStatus = await db.socialPost.groupBy({
    by: ["campaignId", "status"],
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
    _count: { _all: true },
  });
  return campaigns.map((c) => ({
    ...c,
    statuses: Object.fromEntries(
      byStatus.filter((s) => s.campaignId === c.id).map((s) => [s.status, s._count._all]),
    ) as Partial<Record<SocialPostStatus, number>>,
  }));
}

// ─── Performance ──────────────────────────────────────────────────────────────

/** Published posts and their figures over the last `days`, per platform, and the top posts. */
export async function socialPerformance(db: Db, actor: Actor, days: number, now = new Date()) {
  assertCan(actor, "social.manage");
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const targets = await db.socialPostTarget.findMany({
    where: { status: "published", publishedAt: { gte: since } },
    include: { post: { select: { id: true, title: true, type: true } } },
  });
  const perPlatform = socialPlatforms.map((platform) => {
    const ts = targets.filter((t) => t.platform === platform);
    const measured = ts.filter((t) => t.metricsAt);
    const sum = (k: "likes" | "comments" | "shares") =>
      measured.some((t) => t[k] !== null) ? measured.reduce((n, t) => n + (t[k] ?? 0), 0) : null;
    return {
      platform,
      published: ts.length,
      measured: measured.length,
      likes: sum("likes"),
      comments: sum("comments"),
      shares: sum("shares"),
    };
  });
  const top = targets
    .filter((t) => t.metricsAt)
    .map((t) => ({ ...t, total: (t.likes ?? 0) + (t.comments ?? 0) + (t.shares ?? 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  const lastMeasured = targets.reduce<Date | null>(
    (m, t) => (t.metricsAt && (!m || t.metricsAt > m) ? t.metricsAt : m),
    null,
  );
  return { perPlatform, top, lastMeasured, publishedPosts: new Set(targets.map((t) => t.postId)).size };
}
