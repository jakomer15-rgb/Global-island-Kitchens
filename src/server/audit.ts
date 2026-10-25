import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/server/db/client";

/** Writes an audit entry (append-only table). Call inside the same transaction as the change. */
export async function audit(
  db: Tx,
  entry: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    changes?: Prisma.InputJsonValue;
    ipHash?: string | null;
  },
) {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      changes: entry.changes,
      ipHash: entry.ipHash ?? null,
    },
  });
}
