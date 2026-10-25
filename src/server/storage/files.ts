import { createHash, randomBytes } from "node:crypto";
import type { Tx } from "@/server/db/client";
import { RuleError } from "@/server/errors";
import { MAX_UPLOAD_BYTES, resolveUploadType, safeFileName, uploadTypes } from "@/lib/uploads/policy";
import type { StorageDriver, UploadTarget } from "./driver";
import { matchesType, SNIFF_BYTES } from "./sniff";

/** Signed upload URLs live for 15 minutes; an unclaimed upload can be attached for 2 hours. */
export const UPLOAD_URL_TTL = 15 * 60;
export const CLAIM_WINDOW_MS = 2 * 60 * 60 * 1000;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export interface StartedUpload {
  id: string;
  ticket: string;
  upload: UploadTarget;
}

/**
 * Records a pending upload and returns a signed URL plus a ticket. The ticket (stored only as a
 * hash) must be sent with the form, so nobody can attach someone else's upload by guessing an id.
 */
export async function startUpload(
  db: Tx,
  storage: StorageDriver,
  input: { name: string; type: string; size: number; ipHash: string | null },
): Promise<StartedUpload> {
  const type = resolveUploadType(input.name, input.type);
  if (!type) throw new RuleError("fileType");
  if (!Number.isInteger(input.size) || input.size <= 0) throw new RuleError("fileEmpty");
  if (input.size > MAX_UPLOAD_BYTES) throw new RuleError("fileTooLarge");

  const storageKey = `incoming/${randomBytes(16).toString("hex")}`;
  const ticket = randomBytes(24).toString("base64url");
  const file = await db.fileAsset.create({
    data: {
      storageKey,
      originalName: safeFileName(input.name),
      mimeType: type,
      sizeBytes: input.size,
      kind: uploadTypes[type].kind,
      ticketHash: sha256(ticket),
      ipHash: input.ipHash,
    },
  });
  const upload = await storage.uploadTarget(storageKey, type, input.size, UPLOAD_URL_TTL);
  return { id: file.id, ticket, upload };
}

/**
 * Checks each referenced upload before it can be attached: ticket, age, not already attached, the
 * stored size matches what was declared, and the first bytes match the declared type. Marks them
 * verified and returns their ids. Run before the submit transaction (it reads storage).
 */
export async function verifyUploads(
  db: Tx,
  storage: StorageDriver,
  refs: { id: string; ticket: string }[],
  now = new Date(),
): Promise<string[]> {
  const ids: string[] = [];
  for (const ref of refs) {
    const file = await db.fileAsset.findUnique({ where: { id: ref.id } });
    const fresh = file && now.getTime() - file.createdAt.getTime() < CLAIM_WINDOW_MS;
    if (!file || !fresh || file.ticketHash !== sha256(ref.ticket) || file.quotationRequestId) {
      throw new RuleError("fileMissing");
    }
    if (file.status === "verified") {
      ids.push(file.id);
      continue;
    }
    if (file.status === "rejected") throw new RuleError("fileRejected", file.originalName);
    const stored = await storage.size(file.storageKey);
    if (stored === null) throw new RuleError("fileNotUploaded", file.originalName);
    const head = await storage.readStart(file.storageKey, SNIFF_BYTES);
    const ok = stored === file.sizeBytes && matchesType(head, file.mimeType as keyof typeof uploadTypes);
    if (!ok) {
      await db.fileAsset.update({ where: { id: file.id }, data: { status: "rejected" } });
      await storage.delete(file.storageKey).catch(() => {});
      throw new RuleError("fileRejected", file.originalName);
    }
    await db.fileAsset.update({ where: { id: file.id }, data: { status: "verified", verifiedAt: now } });
    ids.push(file.id);
  }
  return ids;
}

/**
 * Deletes uploads that were never attached to a request (abandoned or rejected) after a day, from
 * storage and the database. Run by the scheduled job.
 */
export async function sweepStaleUploads(db: Tx, storage: StorageDriver, now = new Date()) {
  const stale = await db.fileAsset.findMany({
    where: { quotationRequestId: null, createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
    select: { id: true, storageKey: true },
    take: 200,
  });
  for (const file of stale) {
    await storage.delete(file.storageKey);
    await db.fileAsset.delete({ where: { id: file.id } });
  }
  return stale.length;
}

/** Attaches verified uploads to a request inside the submit transaction; fails if any was taken meanwhile. */
export async function attachUploads(tx: Tx, fileIds: string[], quotationRequestId: string) {
  if (fileIds.length === 0) return;
  const { count } = await tx.fileAsset.updateMany({
    where: { id: { in: fileIds }, status: "verified", quotationRequestId: null },
    data: { quotationRequestId, ticketHash: null },
  });
  if (count !== fileIds.length) throw new RuleError("fileMissing");
}
