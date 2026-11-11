import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { json } from "@/server/http";
import { processOutbox } from "@/server/outbox/worker";
import { sweepRateLimits } from "@/server/rate-limit";
import { getStorage } from "@/server/storage/driver";
import { sweepStaleUploads } from "@/server/storage/files";
import { runDueWorkflows } from "@/server/workflows/registry";

/**
 * Scheduled job: runs the automation workflows that are due (each at its own interval, never twice at
 * once), delivers outbox events, and clears expired rate-limit buckets and abandoned uploads. Called by
 * Vercel Cron daily, and as often as every few minutes by an n8n Schedule trigger or a paid plan.
 * Requires `Authorization: Bearer CRON_SECRET`.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = env().CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok =
    secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return json({ error: "unauthorised" }, 401);
  // Workflows only draft, queue or count: anything for customers or social media still needs approval.
  const workflows = await runDueWorkflows(db).catch((error) => {
    console.error("Workflow scheduler failed:", error instanceof Error ? error.message : "unknown");
    return { error: "scheduler" };
  });
  const outbox = await processOutbox(db);
  await sweepRateLimits(db);
  const storage = getStorage();
  const staleUploads = storage ? await sweepStaleUploads(db, storage) : 0;
  return json({ workflows, outbox, staleUploads });
}
