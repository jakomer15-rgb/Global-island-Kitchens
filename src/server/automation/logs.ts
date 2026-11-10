import type { OutboxStatus, Prisma } from "@/generated/prisma/client";
import { assertCan, type Actor } from "@/server/auth/staff";
import { audit } from "@/server/audit";
import type { Db } from "@/server/db/client";
import { NotFoundError, RuleError } from "@/server/errors";

/**
 * The delivery log: every automated side effect (emails, WhatsApp alerts, n8n events) goes through the
 * outbox, so its rows are the record of what ran, when, and what failed. Payloads hold customer contact
 * details and are never shown here; only the event type, channel results and errors.
 */

export const outboxStatuses = [
  "pending",
  "processing",
  "done",
  "failed",
] as const satisfies readonly OutboxStatus[];

const PAGE = 25;

export async function listDeliveries(
  db: Db,
  actor: Actor,
  filters: { status?: OutboxStatus; type?: string; page?: number },
) {
  assertCan(actor, "automation.read");
  const where: Prisma.OutboxEventWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
  };
  const page = Math.max(1, filters.page ?? 1);
  const [items, total, types] = await Promise.all([
    db.outboxEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true,
        type: true,
        status: true,
        attempts: true,
        lastError: true,
        result: true,
        createdAt: true,
        processedAt: true,
        nextAttemptAt: true,
      },
    }),
    db.outboxEvent.count({ where }),
    db.outboxEvent.findMany({ distinct: ["type"], select: { type: true }, orderBy: { type: "asc" } }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE)), types: types.map((t) => t.type) };
}

/** Is the scheduled job running, and are deliveries getting through? */
export async function deliveryHealth(db: Db, actor: Actor, now = new Date()) {
  assertCan(actor, "automation.read");
  const [pending, overdue, failed, lastProcessed, lastN8n] = await Promise.all([
    db.outboxEvent.count({ where: { status: { in: ["pending", "processing"] } } }),
    // Waiting for more than a day: the scheduled job isn't running, or a channel keeps failing.
    db.outboxEvent.count({
      where: { status: "pending", nextAttemptAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
    }),
    db.outboxEvent.count({ where: { status: "failed" } }),
    db.outboxEvent.findFirst({
      where: { processedAt: { not: null } },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true },
    }),
    db.outboxEvent.findFirst({
      where: { result: { path: ["n8n"], equals: "sent" } },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true },
    }),
  ]);
  return {
    pending,
    overdue,
    failed,
    lastProcessedAt: lastProcessed?.processedAt ?? null,
    lastN8nAt: lastN8n?.processedAt ?? null,
  };
}

/**
 * Puts a failed delivery back in the queue for the next run. Channels that already succeeded are kept
 * in `result`, so they are not repeated (no second email to the team).
 */
export async function retryDelivery(db: Db, actor: Actor, id: string) {
  assertCan(actor, "integrations.manage");
  await db.$transaction(async (tx) => {
    const event = await tx.outboxEvent.findUnique({ where: { id }, select: { type: true } });
    if (!event) throw new NotFoundError("Delivery");
    // Conditional update: two people pressing Retry at once re-queue it only once.
    const { count } = await tx.outboxEvent.updateMany({
      where: { id, status: "failed" },
      data: { status: "pending", attempts: 0, nextAttemptAt: new Date(), lockedAt: null },
    });
    if (count === 0) throw new RuleError("not_failed", "Only failed deliveries can be retried.");
    await audit(tx, {
      actorId: actor.id,
      action: "outbox.retry",
      entityType: "outbox_event",
      entityId: id,
      changes: { type: event.type },
    });
  });
}

export async function recentIntegrationChecks(db: Db, actor: Actor, take = 20) {
  assertCan(actor, "automation.read");
  return db.integrationCheck.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      integration: true,
      ok: true,
      message: true,
      durationMs: true,
      createdAt: true,
      checkedBy: { select: { name: true } },
    },
  });
}
