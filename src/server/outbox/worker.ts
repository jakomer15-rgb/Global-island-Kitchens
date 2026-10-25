import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "@/server/db/client";
import { env as readEnv, type Env } from "@/server/env";
import { confirmToCustomer, notifyStaff, postToN8n, type ChannelResult } from "./deliver";
import type { EnquiryReceived, OutboxType } from "./events";

export const MAX_ATTEMPTS = 6;
/** A claimed event not finished within this time is picked up again (the worker died). */
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export type Delivery = (
  event: { id: string; type: string; payload: unknown },
  previous: Record<string, ChannelResult>,
) => Promise<Record<string, ChannelResult>>;

/**
 * Default delivery: each channel runs once; channels already "sent" on an earlier attempt are not
 * repeated when another channel fails and the event is retried.
 */
export function defaultDelivery(e: Env, siteUrl: string): Delivery {
  return async (event, previous) => {
    const result: Record<string, ChannelResult> = { ...previous };
    const errors: string[] = [];
    const run = async (channel: string, send: () => Promise<ChannelResult>) => {
      if (result[channel] === "sent") return;
      try {
        result[channel] = await send();
      } catch (error) {
        errors.push(`${channel}: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    if ((event.type as OutboxType) === "enquiry.received") {
      const payload = event.payload as EnquiryReceived;
      await run("staffEmail", () => notifyStaff(e, payload, siteUrl));
      await run("customerEmail", () => confirmToCustomer(e, payload));
    }
    await run("n8n", () => postToN8n(e, event.type, event.id, event.payload));
    if (errors.length) throw new DeliveryError(errors.join("; "), result);
    return result;
  };
}

/** Some channels failed; `result` keeps the ones that succeeded so a retry doesn't repeat them. */
export class DeliveryError extends Error {
  constructor(
    message: string,
    public readonly result: Record<string, ChannelResult>,
  ) {
    super(message);
    this.name = "DeliveryError";
  }
}

/** Backoff: 1, 4, 9, 16, 25 minutes. */
const backoff = (attempts: number) => attempts * attempts * 60 * 1000;

/**
 * Processes due events. Claims rows with SKIP LOCKED so concurrent workers never take the same
 * event. Returns counts for logging.
 */
export async function processOutbox(db: Db, deliver?: Delivery, limit = 20) {
  const delivery =
    deliver ?? defaultDelivery(readEnv(), process.env.NEXT_PUBLIC_SITE_URL ?? readEnv().BETTER_AUTH_URL);
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  const claimed = await db.$queryRaw<{ id: string }[]>`
    UPDATE "outbox_events" SET "status" = 'processing', "locked_at" = ${now}, "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "outbox_events"
      WHERE ("status" = 'pending' AND "next_attempt_at" <= ${now})
         OR ("status" = 'processing' AND "locked_at" < ${staleBefore})
      ORDER BY "created_at"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"`;

  let done = 0;
  let retried = 0;
  let failed = 0;
  for (const { id } of claimed) {
    const event = await db.outboxEvent.findUniqueOrThrow({ where: { id } });
    const previous = (event.result ?? {}) as Record<string, ChannelResult>;
    try {
      const result = await delivery(event, previous);
      await db.outboxEvent.update({
        where: { id },
        data: {
          status: "done",
          processedAt: new Date(),
          lockedAt: null,
          lastError: null,
          result: result as Prisma.InputJsonValue,
        },
      });
      done++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const giveUp = event.attempts >= MAX_ATTEMPTS;
      await db.outboxEvent.update({
        where: { id },
        data: {
          status: giveUp ? "failed" : "pending",
          lockedAt: null,
          lastError: message.slice(0, 500),
          nextAttemptAt: new Date(Date.now() + backoff(event.attempts)),
          ...(error instanceof DeliveryError ? { result: error.result as Prisma.InputJsonValue } : {}),
        },
      });
      if (giveUp) failed++;
      else retried++;
    }
  }
  return { claimed: claimed.length, done, retried, failed };
}
