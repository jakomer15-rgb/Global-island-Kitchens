import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { json } from "@/server/http";
import { processOutbox } from "@/server/outbox/worker";
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
  const outbox = await processOutbox(db);
  await sweepRateLimits(db);
  const storage = getStorage();
  const staleUploads = storage ? await sweepStaleUploads(db, storage) : 0;
  return json({ outbox, staleUploads });
}
