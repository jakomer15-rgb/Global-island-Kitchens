import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import type { Db, Tx } from "@/server/db/client";
import { NotFoundError, RuleError } from "@/server/errors";
import type { MaterialAvailability, MaterialBoard, Prisma } from "@/generated/prisma/client";
import type { MediaKind } from "./media";

/**
 * Website content managed in the admin: the materials library (EGGER laminate / melamine décors
 * and painted MDF colours only), testimonials (only with recorded consent) and blog posts
 * (published in both languages). The database CHECK rules back up every publish rule here.
 */

const changed = (before: Record<string, unknown> | null, after: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(after).filter(
      ([k, v]) => JSON.stringify(before?.[k] ?? null) !== JSON.stringify(v ?? null),
    ),
  ) as Prisma.InputJsonObject;

async function assertImage(tx: Tx, fileId: string | null, kind: MediaKind) {
  if (!fileId) return;
  const ok = await tx.fileAsset.count({
    where: { id: fileId, kind, visibility: "public", status: "verified" },
  });
  if (!ok) throw new RuleError("image", "Choose an image from Website images.");
}

// ─── Materials ───────────────────────────────────────────────────────────────

export const materialBoards: MaterialBoard[] = ["egger_laminate", "egger_melamine", "painted_mdf"];
export const materialAvailability: MaterialAvailability[] = [
  "unverified",
  "in_stock",
  "to_order",
  "discontinued",
];

export interface MaterialInput {
  board: MaterialBoard;
  code: string;
  nameEn: string;
  nameAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  texture: string | null;
  colourFamily: string | null;
  swatchHex: string | null;
  imageFileId: string | null;
  availability: MaterialAvailability;
  sortOrder: number;
  /** The editor confirms the décor/colour was checked against EGGER's current range or the paint reference. */
  verified: boolean;
  published: boolean;
}

export async function listMaterials(db: Db, actor: Actor) {
  assertCan(actor, "materials.manage");
  return db.material.findMany({
    include: { verifiedBy: { select: { name: true } } },
    orderBy: [{ board: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function getMaterial(db: Db, actor: Actor, id: string) {
  assertCan(actor, "materials.manage");
  const m = await db.material.findUnique({
    where: { id },
    include: { verifiedBy: { select: { name: true } } },
  });
  if (!m) throw new NotFoundError("Material");
  return m;
}

export async function saveMaterial(db: Db, actor: Actor, id: string | null, input: MaterialInput) {
  assertCan(actor, "materials.manage");
  if (input.published && !input.verified)
    throw new RuleError("unverified", "Check the décor against the current range before publishing it.");
  if (input.published && input.availability === "discontinued")
    throw new RuleError("discontinued", "A discontinued décor can't be published.");
  if (input.published && !input.nameAr)
    throw new RuleError("name_ar", "Add the Arabic name before publishing.");
  return db.$transaction(async (tx) => {
    const before = id ? await tx.material.findUnique({ where: { id } }) : null;
    if (id && !before) throw new NotFoundError("Material");
    await assertImage(tx, input.imageFileId, "material_image");
    const clash = await tx.material.findFirst({
      where: { board: input.board, code: input.code, ...(id && { id: { not: id } }) },
      select: { id: true },
    });
    if (clash) throw new RuleError("duplicate", "This board already has a décor with that code.");
    const { verified, ...fields } = input;
    const keepVerification =
      verified && before?.verifiedAt && before.code === input.code && before.board === input.board;
    const data = {
      ...fields,
      manufacturer: input.board === "painted_mdf" ? null : "EGGER",
      verifiedAt: verified ? (keepVerification ? before.verifiedAt : new Date()) : null,
      verifiedById: verified ? (keepVerification ? before.verifiedById : actor.id) : null,
    };
    const saved = id ? await tx.material.update({ where: { id }, data }) : await tx.material.create({ data });
    await audit(tx, {
      actorId: actor.id,
      action: id ? "material.updated" : "material.created",
      entityType: "material",
      entityId: saved.id,
      changes: changed(before, { ...fields, verified }),
    });
    return saved.id;
  });
}

export async function deleteMaterial(db: Db, actor: Actor, id: string) {
  assertCan(actor, "materials.manage");
  await db.$transaction(async (tx) => {
    const m = await tx.material.findUnique({ where: { id } });
    if (!m) throw new NotFoundError("Material");
    await tx.material.delete({ where: { id } });
    await audit(tx, {
      actorId: actor.id,
      action: "material.deleted",
      entityType: "material",
      entityId: id,
      changes: { board: m.board, code: m.code, nameEn: m.nameEn },
    });
  });
}

/** Public: published (and therefore verified) décors. */
export async function publicMaterials(db: Db) {
  return db.material.findMany({
    where: { published: true, verifiedAt: { not: null }, availability: { not: "discontinued" } },
    select: {
      id: true,
      board: true,
      code: true,
      nameEn: true,
      nameAr: true,
      descriptionEn: true,
      descriptionAr: true,
      texture: true,
      swatchHex: true,
      imageFileId: true,
      availability: true,
    },
    orderBy: [{ board: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
  });
}

// ─── Testimonials ────────────────────────────────────────────────────────────

export interface TestimonialInput {
  displayName: string;
  textEn: string | null;
  textAr: string | null;
  source: string;
  consentNote: string | null;
  /** The editor confirms the customer agreed to publication as described in consentNote. */
  consent: boolean;
  published: boolean;
  sortOrder: number;
}

export async function listTestimonials(db: Db, actor: Actor) {
  assertCan(actor, "content.manage");
  return db.testimonial.findMany({
    orderBy: [{ status: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function getTestimonial(db: Db, actor: Actor, id: string) {
  assertCan(actor, "content.manage");
  const t = await db.testimonial.findUnique({ where: { id } });
  if (!t) throw new NotFoundError("Testimonial");
  return t;
}

export async function saveTestimonial(db: Db, actor: Actor, id: string | null, input: TestimonialInput) {
  assertCan(actor, "content.manage");
  if (!input.textEn && !input.textAr) throw new RuleError("text", "Enter the testimonial text.");
  if (input.consent && !input.consentNote)
    throw new RuleError("consent_note", "Describe how and when the customer agreed.");
  if (input.published && !input.consent)
    throw new RuleError(
      "consent",
      "A testimonial can only be published with the customer's recorded consent.",
    );
  return db.$transaction(async (tx) => {
    const before = id ? await tx.testimonial.findUnique({ where: { id } }) : null;
    if (id && !before) throw new NotFoundError("Testimonial");
    const { consent, published, ...fields } = input;
    const data = {
      ...fields,
      consentRecordedAt: consent ? (before?.consentRecordedAt ?? new Date()) : null,
      status: published ? ("published" as const) : ("draft" as const),
    };
    const saved = id
      ? await tx.testimonial.update({ where: { id }, data })
      : await tx.testimonial.create({ data });
    await audit(tx, {
      actorId: actor.id,
      action: id ? "testimonial.updated" : "testimonial.created",
      entityType: "testimonial",
      entityId: saved.id,
      changes: changed(before, { ...fields, consent, status: data.status }),
    });
    return saved.id;
  });
}

export async function deleteTestimonial(db: Db, actor: Actor, id: string) {
  assertCan(actor, "content.manage");
  await db.$transaction(async (tx) => {
    const t = await tx.testimonial.findUnique({ where: { id } });
    if (!t) throw new NotFoundError("Testimonial");
    await tx.testimonial.delete({ where: { id } });
    await audit(tx, {
      actorId: actor.id,
      action: "testimonial.deleted",
      entityType: "testimonial",
      entityId: id,
      changes: { displayName: t.displayName },
    });
  });
}

export async function publicTestimonials(db: Db) {
  return db.testimonial.findMany({
    where: { status: "published", consentRecordedAt: { not: null } },
    select: { id: true, displayName: true, textEn: true, textAr: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 6,
  });
}

// ─── Blog ────────────────────────────────────────────────────────────────────

export interface BlogPostInput {
  slug: string;
  titleEn: string;
  titleAr: string | null;
  excerptEn: string | null;
  excerptAr: string | null;
  bodyEn: string;
  bodyAr: string | null;
  coverFileId: string | null;
  published: boolean;
}

export async function listBlogPosts(db: Db, actor: Actor) {
  assertCan(actor, "content.manage");
  return db.blogPost.findMany({
    include: { author: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { publishedAt: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getBlogPost(db: Db, actor: Actor, id: string) {
  assertCan(actor, "content.manage");
  const p = await db.blogPost.findUnique({ where: { id } });
  if (!p) throw new NotFoundError("Post");
  return p;
}

export async function saveBlogPost(db: Db, actor: Actor, id: string | null, input: BlogPostInput) {
  assertCan(actor, "content.manage");
  if (input.published && !(input.titleAr && input.bodyAr))
    throw new RuleError("arabic", "Add the Arabic title and text before publishing (the site is bilingual).");
  return db.$transaction(async (tx) => {
    const before = id ? await tx.blogPost.findUnique({ where: { id } }) : null;
    if (id && !before) throw new NotFoundError("Post");
    await assertImage(tx, input.coverFileId, "blog_image");
    const clash = await tx.blogPost.findFirst({
      where: { slug: input.slug, ...(id && { id: { not: id } }) },
      select: { id: true },
    });
    if (clash) throw new RuleError("slug", "Another post already uses this web address.");
    const { published, ...fields } = input;
    const data = {
      ...fields,
      status: published ? ("published" as const) : ("draft" as const),
      // The first publication date is kept when a post is edited or unpublished and republished.
      publishedAt: published ? (before?.publishedAt ?? new Date()) : (before?.publishedAt ?? null),
    };
    const saved = id
      ? await tx.blogPost.update({ where: { id }, data })
      : await tx.blogPost.create({ data: { ...data, authorId: actor.id } });
    await audit(tx, {
      actorId: actor.id,
      action: id ? "blog.updated" : "blog.created",
      entityType: "blog_post",
      entityId: saved.id,
      changes: changed(before, { ...fields, status: data.status }),
    });
    return { id: saved.id, slug: saved.slug, previousSlug: before?.slug ?? null };
  });
}

export async function deleteBlogPost(db: Db, actor: Actor, id: string) {
  assertCan(actor, "content.manage");
  return db.$transaction(async (tx) => {
    const p = await tx.blogPost.findUnique({ where: { id } });
    if (!p) throw new NotFoundError("Post");
    await tx.blogPost.delete({ where: { id } });
    await audit(tx, {
      actorId: actor.id,
      action: "blog.deleted",
      entityType: "blog_post",
      entityId: id,
      changes: { slug: p.slug, titleEn: p.titleEn },
    });
    return p.slug;
  });
}

const publicPostSelect = {
  slug: true,
  titleEn: true,
  titleAr: true,
  excerptEn: true,
  excerptAr: true,
  coverFileId: true,
  publishedAt: true,
  updatedAt: true,
} as const;

export async function publicBlogPosts(db: Db) {
  return db.blogPost.findMany({
    where: { status: "published" },
    select: publicPostSelect,
    orderBy: { publishedAt: "desc" },
  });
}

export async function publicBlogPost(db: Db, slug: string) {
  return db.blogPost.findFirst({
    where: { slug, status: "published" },
    select: { ...publicPostSelect, bodyEn: true, bodyAr: true },
  });
}
