import type { Tx } from "@/server/db/client";

/**
 * Fixed-window rate limiting in Postgres (no extra service). One atomic upsert per check.
 * Returns true when the request is allowed.
 */
export async function rateLimit(db: Tx, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const [row] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "rate_limit_buckets" ("key", "window_start", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "window_start") DO UPDATE SET "count" = "rate_limit_buckets"."count" + 1
    RETURNING "count"`;
  return (row?.count ?? 0) <= limit;
}

/** Current count in this window without adding to it (e.g. to check failed sign-ins before trying). */
export async function rateLimitCount(db: Tx, key: string, windowSeconds: number): Promise<number> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const row = await db.rateLimitBucket.findUnique({ where: { key_windowStart: { key, windowStart } } });
  return row?.count ?? 0;
}

/** Deletes expired buckets (run by the outbox cron). */
export async function sweepRateLimits(db: Tx, olderThan = new Date(Date.now() - 24 * 60 * 60 * 1000)) {
  return db.rateLimitBucket.deleteMany({ where: { windowStart: { lt: olderThan } } });
}
