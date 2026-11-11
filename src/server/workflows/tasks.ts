import { aiAvailable } from "@/server/ai/drafts";
import type { AiGenerate } from "@/server/ai/provider";
import type { Db } from "@/server/db/client";
import { aiWritePost } from "@/server/social/ai";

/** The work of the workflows that are new in Stage 8. Each is safe to run again (nothing is done twice). */

export const QUALIFIED_NOTE = "Workflow: lead qualified, follow up.";

/**
 * "Qualified lead → follow-up": each lead at the Qualified stage with no open follow-up gets one, due in
 * `days` days and given to the lead's salesperson. Once per lead (the note marks it).
 */
export async function qualifiedFollowUps(db: Db, days: number, now = new Date(), limit = 50) {
  const leads = await db.lead.findMany({
    where: {
      archivedAt: null,
      status: "qualified",
      followUps: { none: { OR: [{ doneAt: null }, { note: QUALIFIED_NOTE }] } },
    },
    select: { id: true, assignedToId: true },
    take: limit,
  });
  const dueAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  for (const l of leads)
    await db.followUp.create({
      data: { leadId: l.id, dueAt, assignedToId: l.assignedToId, note: QUALIFIED_NOTE },
    });
  return { created: leads.length };
}

/**
 * "New project image → social media draft": each portfolio photo added since `since` (published project,
 * usage permission confirmed, published file) that no post uses yet becomes a draft photo post for
 * Instagram and Facebook; the AI writes it when switched on. Drafts wait for approval like any post.
 */
export async function projectPhotoDrafts(
  db: Db,
  options: { since: Date; aiWrite: boolean; limit?: number; generate?: AiGenerate },
) {
  const images = await db.portfolioImage.findMany({
    where: {
      createdAt: { gte: options.since },
      usagePermission: true,
      project: { published: true },
      file: { visibility: "public", status: "verified", socialPosts: { none: {} } },
    },
    orderBy: { createdAt: "asc" },
    take: options.limit ?? 10,
    select: {
      fileId: true,
      altEn: true,
      project: { select: { nameEn: true, locationEn: true, scopeEn: true } },
    },
  });
  const ai = options.aiWrite && (await aiAvailable(db, "contentAssistant"));
  let created = 0;
  let written = 0;
  for (const img of images) {
    const post = await db.socialPost.create({
      data: {
        title: `New project photo: ${img.project.nameEn}`.slice(0, 160),
        brief:
          `Show this photo of ${img.project.nameEn} (${img.project.locationEn}): ${img.altEn}. Scope: ${img.project.scopeEn}.`.slice(
            0,
            2000,
          ),
        type: "image",
        platforms: ["instagram", "facebook"],
        language: "both",
        imageFileId: img.fileId,
        suggestedImageIds: [img.fileId],
      },
    });
    created++;
    if (ai) {
      try {
        await aiWritePost(db, post.id, null, options.generate);
        written++;
      } catch (error) {
        console.warn(
          "Project photo post: AI draft failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
  }
  return { created, written };
}
