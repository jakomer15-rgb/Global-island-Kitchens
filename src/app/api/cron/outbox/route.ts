import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { json } from "@/server/http";
import { processOutbox } from "@/server/outbox/worker";
import { draftNoResponseFollowUps } from "@/server/outreach/messages";
import { sweepRateLimits } from "@/server/rate-limit";
import { getStorage } from "@/server/storage/driver";
import { sweepStaleUploads } from "@/server/storage/files";

/**
 * Scheduled job (host cron, every few minutes): delivers outbox events and clears expired rate-limit
 * buckets and abandoned uploads. Requires `Authorization: Bearer CRON_SECRET`.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = env().CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok =
    secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return json({ error: "unauthorised" }, 401);
  // Follow-up drafts for customers who stopped replying (only if the owner switched it on); they wait
  // for approval, nothing is sent here.
  const followUps = await draftNoResponseFollowUps(db).catch((error) => {
    console.error("Follow-up drafting failed:", error instanceof Error ? error.message : "unknown");
    return { drafted: 0, skipped: "error" as const };
  });
  const outbox = await processOutbox(db);
  await sweepRateLimits(db);
  const storage = getStorage();
  const staleUploads = storage ? await sweepStaleUploads(db, storage) : 0;
  return json({ outbox, staleUploads, followUps });
}
