import type { Db } from "@/server/db/client";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import { NotFoundError } from "@/server/errors";
import type { StorageDriver } from "@/server/storage/driver";

/** Recent enquiries with everything staff need to respond (Phase 5 adds filters, paging and editing). */
export async function listRecentEnquiries(
  db: Db,
  actor: Actor,
  opts: { reference?: string; take?: number } = {},
) {
  assertCan(actor, "lead.read");
  return db.lead.findMany({
    where: { archivedAt: null, ...(opts.reference ? { reference: opts.reference } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.take ?? 50, 200),
    include: {
      customer: { select: { name: true, phone: true, email: true, type: true } },
      activities: {
        orderBy: { createdAt: "asc" },
        select: { id: true, kind: true, body: true, createdAt: true },
      },
      consultation: true,
      quotationRequest: {
        include: {
          files: {
            where: { status: "verified" },
            select: { id: true, originalName: true, mimeType: true, sizeBytes: true },
          },
        },
      },
    },
  });
}

/** Short-lived download link for an uploaded file; every download is audited. */
export async function fileDownloadUrl(
  db: Db,
  storage: StorageDriver,
  actor: Actor,
  fileId: string,
  ipHash: string | null,
) {
  assertCan(actor, "file.read");
  const file = await db.fileAsset.findFirst({
    where: { id: fileId, status: "verified", quotationRequestId: { not: null } },
  });
  if (!file) throw new NotFoundError("File");
  await audit(db, {
    actorId: actor.id,
    action: "file.downloaded",
    entityType: "file",
    entityId: file.id,
    ipHash,
  });
  return storage.downloadUrl(file.storageKey, file.originalName, file.mimeType, 60);
}
