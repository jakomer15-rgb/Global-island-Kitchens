import { AUTOPILOT_HELD, AUTOPILOT_NOTE, heldReasons, holdText } from "@/lib/autopilot";
import { bahrainDay, missingForApproval, type SocialPlatformKey } from "@/lib/social";
import { aiAvailable } from "@/server/ai/drafts";
import { aiConfigured, aiGenerate, type AiGenerate } from "@/server/ai/provider";
import { audit } from "@/server/audit";
import type { Db } from "@/server/db/client";
import { env as readEnv, type Env } from "@/server/env";
import { aiPlanIdeas, aiWritePost } from "@/server/social/ai";
import { instagramReady, metaReady } from "@/server/social/meta";
import { enqueue } from "@/server/outbox/events";
import { targetStatus, usableImages } from "@/server/social/posts";
import { getStorage } from "@/server/storage/driver";
import { autoSends, notifyHolders, partActive, readAutopilot } from "./state";

/**
 * Autopilot's social media: keeps `postsPerWeek` posts planned for the coming seven days. For each missing
 * post the AI picks an idea, writes the captions and hashtags and chooses a published portfolio photo; the
 * post is then scheduled and published by the "approved post publishing" workflow through Meta. Only
 * platforms that publish automatically are used (Facebook photo/text, Instagram photo). A post that breaks
 * a safety rule or is incomplete waits for a person in the calendar instead.
 */

const DAY = 24 * 60 * 60 * 1000;
const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** What social Autopilot still needs (shown on the Autopilot page). */
export async function socialNeeds(db: Db, e: Env): Promise<string[]> {
  const needs: string[] = [];
  if (!aiConfigured(e)) needs.push("Claude API key (ANTHROPIC_API_KEY)");
  else if (!(await aiAvailable(db, "contentAssistant")))
    needs.push("AI content assistant switched on (Settings → AI)");
  if (!metaReady(e)) needs.push("Facebook and Instagram connection (META_* settings)");
  else if (!instagramReady(e)) needs.push("Instagram account id (META_INSTAGRAM_ACCOUNT_ID); Facebook works");
  if (!getStorage()) needs.push("File storage (R2) for photo posts; until then only Facebook text posts");
  return needs;
}

export async function runSocialAutopilot(
  db: Db,
  options: { now?: Date; env?: Env; generate?: AiGenerate } = {},
) {
  const now = options.now ?? new Date();
  const e = options.env ?? readEnv();
  const s = await readAutopilot(db);
  if (!partActive(s, "social")) return { scheduled: 0, skipped: "off" };
  if (!aiConfigured(e) || !(await aiAvailable(db, "contentAssistant")))
    return { scheduled: 0, skipped: "aiOff" };
  const auto = autoSends(s);
  // Asking first, posts can still be prepared without Meta (approved ones are then posted by hand).
  if (auto && !metaReady(e)) return { scheduled: 0, skipped: "metaOff" };

  const weekEnd = new Date(now.getTime() + 7 * DAY);
  const planned = await db.socialPost.count({
    where: {
      plannedAt: { gte: now, lt: weekEnd },
      status: { in: ["pending_approval", "approved", "scheduled", "published"] },
    },
  });
  const need = s.postsPerWeek - planned;
  if (need <= 0) return { scheduled: 0 };

  // Photo posts need a photo: one the platforms can fetch (storage) when publishing by itself, or any
  // published portfolio photo when a person approves and may post it by hand.
  const photos = auto ? Boolean(getStorage()) : (await usableImages(db, 1)).length > 0;
  const platforms = (
    auto
      ? s.socialPlatforms.filter((p) => (p === "instagram" ? instagramReady(e) && photos : true))
      : s.socialPlatforms
  ) as SocialPlatformKey[];
  if (!platforms.length) return { scheduled: 0, skipped: "noPlatform" };
  const today = bahrainDay(now);
  const generate = options.generate ?? aiGenerate;
  const ideas = await aiPlanIdeas(generate, {
    days: Array.from({ length: 7 }, (_, i) => addDays(today, i)),
    max: need,
    postsPerWeek: s.postsPerWeek,
    platforms,
    types: photos ? ["image", "text"] : ["text"],
    reviewed: false,
    now,
  });

  let scheduled = 0;
  let held = 0;
  let forApproval = 0;
  for (const idea of ideas.slice(0, need)) {
    // Text posts go to Facebook only (Instagram needs a photo).
    const targets = idea.type === "text" ? idea.platforms.filter((p) => p === "facebook") : idea.platforms;
    if (!targets.length) continue;
    const post = await db.socialPost.create({
      data: {
        title: idea.title,
        brief: idea.brief || null,
        type: idea.type,
        platforms: targets,
        language: s.socialLanguage,
        plannedAt: idea.at,
      },
    });
    try {
      await aiWritePost(db, post.id, null, generate);
    } catch (error) {
      console.warn("Autopilot post writing failed:", error instanceof Error ? error.message : "unknown");
      await db.socialPost.delete({ where: { id: post.id } });
      continue;
    }
    let p = await db.socialPost.findUniqueOrThrow({ where: { id: post.id } });
    if (p.type === "image") {
      const photo = p.suggestedImageIds[0];
      if (photo) p = await db.socialPost.update({ where: { id: p.id }, data: { imageFileId: photo } });
      else if (p.platforms.includes("facebook"))
        p = await db.socialPost.update({
          where: { id: p.id },
          data: { type: "text", platforms: ["facebook"] },
        });
    }
    const unsafe = heldReasons([p.captionEn, p.captionAr, p.hashtags.join(" ")].filter(Boolean).join("\n"));
    const missing = missingForApproval(p);
    if (unsafe.length || missing.length) {
      const reason = [unsafe.length ? `the post ${holdText(unsafe)}` : null, ...missing]
        .filter(Boolean)
        .join("; ");
      await db.$transaction(async (tx) => {
        await tx.socialPost.update({
          where: { id: p.id },
          data: {
            status: "pending_approval",
            submittedAt: now,
            decisionNote: `${AUTOPILOT_HELD}: ${reason}`.slice(0, 500),
          },
        });
        await notifyHolders(
          tx,
          "social.publish",
          `Post held by Autopilot: ${p.title}`,
          `/admin/social/${p.id}`,
          reason,
        );
        await enqueue(tx, "approval.requested", { kind: "social_post", id: p.id });
        await audit(tx, {
          actorId: null,
          action: "social_post.autopilot_held",
          entityType: "social_post",
          entityId: p.id,
          changes: { reason },
        });
      });
      held++;
      continue;
    }
    if (!auto) {
      await db.$transaction(async (tx) => {
        await tx.socialPost.update({
          where: { id: p.id },
          data: { status: "pending_approval", submittedAt: now },
        });
        await notifyHolders(
          tx,
          "social.publish",
          `Social media post to approve: ${p.title}`,
          `/admin/social/${p.id}`,
        );
        await enqueue(tx, "approval.requested", { kind: "social_post", id: p.id });
        await audit(tx, {
          actorId: null,
          action: "social_post.autopilot_prepared",
          entityType: "social_post",
          entityId: p.id,
        });
      });
      forApproval++;
      continue;
    }
    await db.$transaction(async (tx) => {
      await tx.socialPostTarget.createMany({
        data: p.platforms.map((platform) => ({
          postId: p.id,
          platform,
          status: targetStatus(platform, p.type, e),
        })),
      });
      await tx.socialPost.update({
        where: { id: p.id },
        data: { status: "scheduled", submittedAt: now, approvedAt: now, decisionNote: AUTOPILOT_NOTE },
      });
      await audit(tx, {
        actorId: null,
        action: "social_post.auto_approved",
        entityType: "social_post",
        entityId: p.id,
        changes: { plannedAt: p.plannedAt?.toISOString() ?? null },
      });
    });
    scheduled++;
  }
  return { scheduled, held, forApproval };
}
