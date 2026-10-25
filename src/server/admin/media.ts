import { createHash, randomBytes } from "node:crypto";
import { audit } from "@/server/audit";
import type { Permission } from "@/server/auth/permissions";
import { can, ForbiddenError, type Actor } from "@/server/auth/staff";
import type { Db } from "@/server/db/client";
import { NotFoundError, RuleError } from "@/server/errors";
import type { StorageDriver } from "@/server/storage/driver";
import { UPLOAD_URL_TTL, verifyUploads } from "@/server/storage/files";
import { safeFileName } from "@/lib/uploads/policy";

/**
 * Website images (material décors, project photos, blog covers). Uploaded by staff straight to
 * storage, checked like customer uploads, then published with a credit stating who owns the photo
 * and that the company may use it (no unlicensed photography). Public at /media/<id>.
 */

export const mediaKinds = {
  material_image: "materials.manage",
  project_photo: "portfolio.manage",
  blog_image: "content.manage",
} as const satisfies Record<string, Permission>;
export type MediaKind = keyof typeof mediaKinds;

export const mediaTypes = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
} as const;
export type MediaType = keyof typeof mediaTypes;
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function canManageMedia(actor: Actor, kind?: MediaKind) {
  return kind ? can(actor, mediaKinds[kind]) : Object.values(mediaKinds).some((p) => can(actor, p));
}

function assertMedia(actor: Actor, kind: MediaKind) {
  if (!can(actor, mediaKinds[kind])) throw new ForbiddenError(mediaKinds[kind]);
}

export function mediaType(name: string, type: string): MediaType | null {
  if (type in mediaTypes) return type as MediaType;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const hit = Object.entries(mediaTypes).find(([, exts]) => (exts as readonly string[]).includes(ext));
  return hit ? (hit[0] as MediaType) : null;
}

export async function startMediaUpload(
  db: Db,
  storage: StorageDriver,
  actor: Actor,
  input: { kind: MediaKind; name: string; type: string; size: number },
) {
  assertMedia(actor, input.kind);
  const type = mediaType(input.name, input.type);
  if (!type) throw new RuleError("fileType", "Use a JPEG, PNG or WebP image.");
  if (!Number.isInteger(input.size) || input.size <= 0)
    throw new RuleError("fileEmpty", "The file is empty.");
  if (input.size > MAX_MEDIA_BYTES) throw new RuleError("fileTooLarge", "Images must be 8 MB or smaller.");
  const ticket = randomBytes(24).toString("base64url");
  const file = await db.fileAsset.create({
    data: {
      storageKey: `media/${randomBytes(16).toString("hex")}`,
      originalName: safeFileName(input.name),
      mimeType: type,
      sizeBytes: input.size,
      kind: input.kind,
      ticketHash: sha256(ticket),
      uploadedById: actor.id,
    },
  });
  const upload = await storage.uploadTarget(file.storageKey, type, input.size, UPLOAD_URL_TTL);
  return { id: file.id, ticket, upload };
}

/** After the browser has uploaded: verify the bytes, then publish with the credit. */
export async function finishMediaUpload(
  db: Db,
  storage: StorageDriver,
  actor: Actor,
  input: { id: string; ticket: string; credit: string },
) {
  const credit = input.credit.trim();
  if (credit.length < 3) throw new RuleError("credit", "Say who took the photo and that we may use it.");
  const file = await db.fileAsset.findFirst({ where: { id: input.id, uploadedById: actor.id } });
  if (!file || !(file.kind in mediaKinds)) throw new NotFoundError("Upload");
  assertMedia(actor, file.kind as MediaKind);
  await verifyUploads(db, storage, [{ id: input.id, ticket: input.ticket }]);
  await db.$transaction(async (tx) => {
    await tx.fileAsset.update({
      where: { id: file.id },
      data: { visibility: "public", credit: credit.slice(0, 300), ticketHash: null },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "media.uploaded",
      entityType: "file",
      entityId: file.id,
      changes: { kind: file.kind, name: file.originalName, credit },
    });
  });
  return file.id;
}

export async function listMedia(db: Db, actor: Actor, kind?: MediaKind) {
  const kinds = (Object.keys(mediaKinds) as MediaKind[]).filter(
    (k) => can(actor, mediaKinds[k]) && (!kind || k === kind),
  );
  if (kinds.length === 0) throw new ForbiddenError(kind ? mediaKinds[kind] : "content.manage");
  return db.fileAsset.findMany({
    where: { kind: { in: kinds }, visibility: "public", status: "verified" },
    select: {
      id: true,
      kind: true,
      originalName: true,
      credit: true,
      sizeBytes: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
      _count: { select: { materials: true, portfolioImages: true, blogCovers: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

/** Removes an image nothing uses any more. */
export async function deleteMedia(db: Db, storage: StorageDriver, actor: Actor, id: string) {
  const file = await db.fileAsset.findFirst({
    where: { id, visibility: "public" },
    include: { _count: { select: { materials: true, portfolioImages: true, blogCovers: true } } },
  });
  if (!file || !(file.kind in mediaKinds)) throw new NotFoundError("Image");
  assertMedia(actor, file.kind as MediaKind);
  const used = file._count.materials + file._count.portfolioImages + file._count.blogCovers;
  if (used > 0) throw new RuleError("in_use", "This image is still used. Remove it from those pages first.");
  await db.$transaction(async (tx) => {
    await tx.fileAsset.delete({ where: { id } });
    await audit(tx, {
      actorId: actor.id,
      action: "media.deleted",
      entityType: "file",
      entityId: id,
      changes: { name: file.originalName },
    });
  });
  await storage.delete(file.storageKey).catch(() => {});
}

/** Public URL of a published website image. */
export function mediaUrl(id: string) {
  return `/media/${id}`;
}
