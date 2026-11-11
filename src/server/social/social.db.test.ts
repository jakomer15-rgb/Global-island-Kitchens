import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createStaffUser } from "@/server/auth/accounts";
import { ForbiddenError, resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { approvalQueue } from "@/server/automation/overview";
import { createPrismaClient } from "@/server/db/client";
import type { Env } from "@/server/env";
import { updateSetting } from "@/server/settings/update";
import type { StorageDriver } from "@/server/storage/driver";
import { planContentWithAi, writePostWithAi } from "./ai";
import { MetaError } from "./meta";
import {
  createPost,
  decidePost,
  deletePost,
  markPostedByHand,
  publishPostNow,
  publishSocialPost,
  queueDuePosts,
  refreshEngagement,
  reopenPost,
  setPostImage,
  socialPerformance,
  submitPost,
  updatePost,
  type PostInput,
} from "./posts";

const db = createPrismaClient();
const uid = () => Math.random().toString(36).slice(2, 10);
const metaEnv = {
  META_PAGE_ID: "1234567",
  META_PAGE_ACCESS_TOKEN: "page-token-that-is-long-enough",
  META_INSTAGRAM_ACCOUNT_ID: "7654321",
  META_GRAPH_VERSION: "v21.0",
} as unknown as Env;
const noMeta = {} as unknown as Env;
const storage = { downloadUrl: async () => "https://files.example/photo.jpg" } as unknown as StorageDriver;
const DAY = 24 * 60 * 60 * 1000;

async function staff(roleKeys: string[]): Promise<Actor> {
  const id = await db.$transaction((tx) =>
    createStaffUser(tx, {
      email: `s6-${uid()}@example.test`,
      name: `S6 ${uid()}`,
      password: "a long test password",
      roleKeys,
      actorId: null,
      via: "test",
    }),
  );
  return resolveActor(await db.user.findUniqueOrThrow({ where: { id }, include: userWithRolesInclude }))!;
}

async function photo(mimeType = "image/jpeg") {
  return db.fileAsset.create({
    data: {
      storageKey: `media/test-${uid()}`,
      originalName: "kitchen.jpg",
      mimeType,
      sizeBytes: 1000,
      kind: "project_photo",
      visibility: "public",
      status: "verified",
      verifiedAt: new Date(),
      credit: "GIK own photo",
    },
  });
}

const textPost = (over: Partial<PostInput> = {}): PostInput => ({
  title: `Post ${uid()}`,
  type: "text",
  platforms: ["facebook", "linkedin"],
  language: "en",
  captionEn: "Painted MDF kitchens, made in Bahrain.",
  hashtags: "#Bahrain #Kitchens",
  ...over,
});

let owner: Actor;
let sales: Actor;
let editor: Actor;
let supervisor: Actor;
beforeAll(async () => {
  process.env.AI_PROVIDER = "mock";
  [owner, sales, editor, supervisor] = await Promise.all([
    staff(["owner"]),
    staff(["sales_manager"]),
    staff(["content_editor"]),
    staff(["production_supervisor"]),
  ]);
});
afterAll(() => db.$disconnect());

describe("social posts: drafting and approval", () => {
  it("staff without the permission can't write posts; writers can't approve", async () => {
    await expect(createPost(db, supervisor, textPost())).rejects.toBeInstanceOf(ForbiddenError);
    const p = await createPost(db, editor, textPost());
    await submitPost(db, editor, p.id);
    await expect(decidePost(db, editor, p.id, { approve: true }, metaEnv)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await db.socialPost.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({
      status: "pending_approval",
    });
  });

  it("refuses to send an incomplete post for approval", async () => {
    const p = await createPost(
      db,
      sales,
      textPost({ type: "image", language: "both", captionAr: undefined }),
    );
    await expect(submitPost(db, sales, p.id)).rejects.toThrow(/Arabic caption.*photo/);
  });

  it("only accepts published images, and project photos only with permission", async () => {
    const privateFile = await db.fileAsset.create({
      data: { storageKey: `incoming/${uid()}`, originalName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 10 },
    });
    await expect(createPost(db, sales, textPost({ imageFileId: privateFile.id }))).rejects.toThrow(
      /published website image/,
    );
    const file = await photo();
    const project = await db.portfolioProject.findFirstOrThrow();
    await db.portfolioImage.create({
      data: {
        projectId: project.id,
        fileId: file.id,
        altEn: "Kitchen",
        altAr: "مطبخ",
        usagePermission: false,
      },
    });
    await expect(createPost(db, sales, textPost({ imageFileId: file.id }))).rejects.toThrow(
      /no confirmed permission/,
    );
  });

  it("approval creates one result per platform: automatic where Meta is connected, by hand elsewhere", async () => {
    const p = await createPost(db, sales, textPost());
    await submitPost(db, sales, p.id);
    expect(
      (await approvalQueue(db, owner)).items.some((i) => i.kind === "social_post" && i.id === p.id),
    ).toBe(true);
    expect((await approvalQueue(db, sales)).counts.social_post).toBeNull();
    await decidePost(db, owner, p.id, { approve: true }, metaEnv);
    const targets = await db.socialPostTarget.findMany({
      where: { postId: p.id },
      orderBy: { platform: "asc" },
    });
    expect(targets.map((t) => [t.platform, t.status])).toEqual([
      ["facebook", "pending"],
      ["linkedin", "manual"],
    ]);

    const q = await createPost(db, sales, textPost());
    await submitPost(db, sales, q.id);
    await decidePost(db, owner, q.id, { approve: true }, noMeta);
    expect(
      (await db.socialPostTarget.findMany({ where: { postId: q.id } })).every((t) => t.status === "manual"),
    ).toBe(true);
  });

  it("a rejected post goes back to its author as a draft with the reason", async () => {
    const p = await createPost(db, sales, textPost());
    await submitPost(db, sales, p.id);
    await decidePost(db, owner, p.id, { approve: false, note: "Add the showroom invitation." }, metaEnv);
    expect(await db.socialPost.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({
      status: "draft",
      decisionNote: "Add the showroom invitation.",
      approvedAt: null,
    });
    expect(
      await db.notification.count({ where: { userId: sales.id, title: { contains: "not approved" } } }),
    ).toBe(1);
  });

  it("approved content can't change: editing is refused, and the database refuses it too", async () => {
    const p = await createPost(db, sales, textPost());
    await submitPost(db, sales, p.id);
    await decidePost(db, owner, p.id, { approve: true }, metaEnv);
    await expect(updatePost(db, sales, p.id, textPost({ captionEn: "Changed" }))).rejects.toThrow(
      /Only a draft/,
    );
    await expect(
      db.socialPost.update({ where: { id: p.id }, data: { captionEn: "Sneaky change" } }),
    ).rejects.toThrow(/approved content can't change/);
    // Writers can't withdraw an approval; approvers can, and it needs approval again.
    await expect(reopenPost(db, sales, p.id)).rejects.toThrow(/only be sent back to draft by an approver/);
    await reopenPost(db, owner, p.id);
    expect(await db.socialPost.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({
      status: "draft",
      approvedAt: null,
    });
    expect(await db.socialPostTarget.count({ where: { postId: p.id } })).toBe(0);
  });

  it("the database never records a publication of an unapproved post", async () => {
    const p = await createPost(db, sales, textPost());
    await expect(
      db.socialPostTarget.create({
        data: {
          postId: p.id,
          platform: "facebook",
          status: "published",
          publishedAt: new Date(),
          externalId: "1_1",
        },
      }),
    ).rejects.toThrow(/not approved/);
    await expect(
      db.socialPost.update({ where: { id: p.id }, data: { status: "published", publishedAt: new Date() } }),
    ).rejects.toThrow(/social_posts_approved/);
  });
});

describe("social posts: publishing", () => {
  async function approved(over: Partial<PostInput> = {}, then: "keep" | "now" | "schedule" = "keep") {
    const p = await createPost(db, sales, textPost(over));
    await submitPost(db, sales, p.id);
    await decidePost(db, owner, p.id, { approve: true, then }, metaEnv);
    return p;
  }

  it("publishes to Facebook through the outbox; LinkedIn is marked by hand; a published post is final", async () => {
    const p = await approved({}, "now");
    const event = await db.outboxEvent.findFirstOrThrow({
      where: { type: "social.publish", payload: { path: ["postId"], equals: p.id } },
    });
    expect(event.status).toBe("pending");
    // Asking again doesn't queue it twice.
    expect(await publishPostNow(db, owner, p.id)).toBe(false);

    const calls: string[] = [];
    const result = await publishSocialPost(db, metaEnv, p.id, {
      storage,
      facebook: async (_e, input) => {
        calls.push(input.caption);
        return { externalId: "1234567_1", permalink: "https://www.facebook.com/1234567_1" };
      },
    });
    expect(result).toBe("sent");
    expect(calls).toEqual(["Painted MDF kitchens, made in Bahrain.\n\n#Bahrain #Kitchens"]);
    const after = await db.socialPost.findUniqueOrThrow({ where: { id: p.id }, include: { targets: true } });
    expect(after.status).toBe("published");
    expect(after.targets.find((t) => t.platform === "linkedin")?.status).toBe("manual");

    // Never published twice.
    expect(
      await publishSocialPost(db, metaEnv, p.id, {
        storage,
        facebook: async () => {
          throw new Error("called");
        },
      }),
    ).toBe("skipped");
    const linkedin = after.targets.find((t) => t.platform === "linkedin")!;
    await expect(markPostedByHand(db, sales, linkedin.id, undefined)).rejects.toBeInstanceOf(ForbiddenError);
    await markPostedByHand(db, owner, linkedin.id, "https://www.linkedin.com/feed/update/1");
    expect((await db.socialPostTarget.findUniqueOrThrow({ where: { id: linkedin.id } })).status).toBe(
      "published",
    );

    await expect(reopenPost(db, owner, p.id)).rejects.toThrow(/already published/);
    await expect(deletePost(db, owner, p.id)).rejects.toThrow(/kept as a record/);
    await expect(db.socialPost.delete({ where: { id: p.id } })).rejects.toThrow(/published post is kept/);
  });

  it("a failure is recorded and retried; a later success publishes it", async () => {
    const p = await approved({ platforms: ["facebook"] }, "now");
    await expect(
      publishSocialPost(db, metaEnv, p.id, {
        storage,
        facebook: async () => {
          throw new MetaError("Meta did not answer in time.");
        },
      }),
    ).rejects.toThrow(/facebook: Meta did not answer/);
    expect(await db.socialPost.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({
      status: "failed",
      lastError: "facebook: Meta did not answer in time.",
    });
    expect(await publishPostNow(db, owner, p.id)).toBe(false); // the outbox event is still pending (retry)
    await db.socialPostTarget.updateMany({ where: { postId: p.id }, data: { status: "pending" } });
    await publishSocialPost(db, metaEnv, p.id, {
      storage,
      facebook: async () => ({ externalId: "1234567_2", permalink: null }),
    });
    expect(await db.socialPost.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({
      status: "published",
      lastError: null,
    });
  });

  it("problems a retry can't fix are not retried (e.g. a PNG for Instagram)", async () => {
    const png = await photo("image/png");
    const p = await approved({
      type: "image",
      platforms: ["instagram"],
      imageFileId: png.id,
    });
    expect(await publishPostNow(db, owner, p.id)).toBe(true);
    const result = await publishSocialPost(db, metaEnv, p.id, { storage });
    expect(result).toBe("sent"); // nothing to retry; the failure is on the post
    const t = await db.socialPostTarget.findFirstOrThrow({ where: { postId: p.id } });
    expect(t).toMatchObject({
      status: "failed",
      error: "Instagram only accepts JPEG photos. Choose a JPEG image.",
    });
    // Staff can post it by hand instead.
    await markPostedByHand(db, owner, t.id, undefined);
    expect((await db.socialPost.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("published");
  });

  it("schedules approved posts and queues them once when their time comes", async () => {
    const now = new Date();
    const day = new Date(now.getTime() + 2 * DAY).toISOString().slice(0, 10);
    await expect(approved({}, "schedule")).rejects.toThrow(/planned time in the future/);
    const p = await approved({ plannedDay: day, plannedTime: "10:00" }, "schedule");
    const post = await db.socialPost.findUniqueOrThrow({ where: { id: p.id } });
    expect(post.status).toBe("scheduled");
    expect((await queueDuePosts(db, now)).queued).toBeGreaterThanOrEqual(0);
    expect(
      await db.outboxEvent.count({
        where: { type: "social.publish", payload: { path: ["postId"], equals: p.id } },
      }),
    ).toBe(0);
    const later = new Date(post.plannedAt!.getTime() + 60_000);
    await queueDuePosts(db, later);
    await queueDuePosts(db, later);
    expect(
      await db.outboxEvent.count({
        where: { type: "social.publish", payload: { path: ["postId"], equals: p.id } },
      }),
    ).toBe(1);
  });

  it("reads engagement for published Meta posts and reports it", async () => {
    const p = await approved({ platforms: ["facebook"] }, "now");
    await publishSocialPost(db, metaEnv, p.id, {
      storage,
      facebook: async () => ({ externalId: `9_${uid()}`, permalink: null }),
    });
    const r = await refreshEngagement(db, metaEnv, {
      fetchMetrics: async () => ({ likes: 7, comments: 2, shares: 1 }),
    });
    expect(r.updated).toBeGreaterThanOrEqual(1);
    const t = await db.socialPostTarget.findFirstOrThrow({ where: { postId: p.id } });
    expect(t).toMatchObject({ likes: 7, comments: 2, shares: 1 });
    expect(await refreshEngagement(db, noMeta)).toMatchObject({ skipped: "not_configured" });
    const perf = await socialPerformance(db, sales, 7);
    expect(perf.perPlatform.find((x) => x.platform === "facebook")!.published).toBeGreaterThanOrEqual(1);
    expect(perf.top.some((x) => x.postId === p.id)).toBe(true);
  });
});

describe("social posts: AI drafts", () => {
  beforeAll(() =>
    updateSetting(db, owner, "ai", {
      enabled: true,
      leadAssistant: true,
      contentAssistant: true,
      furnitureAssistant: false,
    }),
  );

  it("writes captions and hashtags; only photos from the usable list are kept as suggestions", async () => {
    const good = await photo();
    const project = await db.portfolioProject.findFirstOrThrow({ where: { published: true } });
    await db.portfolioImage.create({
      data: {
        projectId: project.id,
        fileId: good.id,
        altEn: "White kitchen",
        altAr: "مطبخ أبيض",
        usagePermission: true,
      },
    });
    const p = await createPost(
      db,
      sales,
      textPost({ type: "image", language: "both", captionEn: undefined }),
    );
    await writePostWithAi(db, sales, p.id, async (req) => {
      expect(req.system).toMatch(/Never mention prices/);
      expect(req.user).toContain(good.id);
      return {
        text: JSON.stringify({
          captionEn: "A white kitchen.",
          captionAr: "مطبخ أبيض.",
          hashtags: ["#WhiteKitchen", "bad tag!", "مطابخ"],
          imageBrief: "Daylight photo.",
          photoIds: [good.id, "not-a-real-id"],
        }),
        model: "test",
      };
    });
    const after = await db.socialPost.findUniqueOrThrow({ where: { id: p.id } });
    expect(after).toMatchObject({
      captionEn: "A white kitchen.",
      captionAr: "مطبخ أبيض.",
      hashtags: ["WhiteKitchen", "مطابخ"],
      suggestedImageIds: [good.id],
      imageFileId: null,
    });
    await setPostImage(db, sales, p.id, good.id);
    await submitPost(db, sales, p.id);
    // Not a draft any more: the AI can't change it.
    await expect(writePostWithAi(db, sales, p.id)).rejects.toThrow(/Only a draft/);
  });

  it("plans a week as dated drafts on future days only", async () => {
    const now = new Date();
    const next = new Date(now.getTime() + 7 * DAY).toISOString().slice(0, 10);
    const before = await db.socialPost.count();
    const r = await planContentWithAi(
      db,
      editor,
      {
        view: "week",
        anchorDay: next,
        postsPerWeek: 3,
        platforms: ["instagram", "facebook"],
        language: "both",
      },
      undefined,
      now,
    );
    expect(r.created).toBe(3);
    expect(await db.socialPost.count()).toBe(before + 3);
    const drafts = await db.socialPost.findMany({
      where: { createdById: editor.id, status: "draft", plannedAt: { gt: now } },
    });
    expect(drafts.length).toBeGreaterThanOrEqual(3);
    // Platforms are limited to the ones chosen.
    expect(drafts.every((d) => d.platforms.every((x) => x === "instagram" || x === "facebook"))).toBe(true);
    await expect(
      planContentWithAi(db, supervisor, {
        view: "week",
        anchorDay: next,
        postsPerWeek: 3,
        platforms: ["instagram"],
        language: "en",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
