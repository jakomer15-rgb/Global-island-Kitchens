import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import type { Db } from "@/server/db/client";
import { NotFoundError, RuleError } from "@/server/errors";
import type { PortfolioSegment, Prisma } from "@/generated/prisma/client";

/**
 * Portfolio projects (seeded from the company profile) and their photos. A client name is shown
 * only with the client's permission; a photo only with permission to use it (both also enforced
 * by CHECK rules or the public query).
 */

export const segments: PortfolioSegment[] = ["residential", "villas", "commercial"];
export const scopeTags = [
  "kitchens",
  "closets",
  "bedSets",
  "tvUnits",
  "vanities",
  "doors",
  "cladding",
  "fullJoinery",
  "furnished",
  "commercial",
] as const;

export interface ProjectInput {
  slug: string;
  segment: PortfolioSegment;
  nameEn: string;
  nameAr: string;
  locationEn: string;
  locationAr: string;
  sizeEn: string | null;
  sizeAr: string | null;
  scopeEn: string;
  scopeAr: string;
  scopeTags: string[];
  clientName: string | null;
  clientNamePermission: boolean;
  featured: boolean;
  published: boolean;
  sortOrder: number;
}

export async function listProjects(db: Db, actor: Actor) {
  assertCan(actor, "portfolio.manage");
  return db.portfolioProject.findMany({
    include: { _count: { select: { images: true } } },
    orderBy: [{ segment: "asc" }, { sortOrder: "asc" }],
  });
}

export async function getProjectForEdit(db: Db, actor: Actor, id: string) {
  assertCan(actor, "portfolio.manage");
  const project = await db.portfolioProject.findUnique({
    where: { id },
    include: {
      images: {
        include: { file: { select: { originalName: true, credit: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!project) throw new NotFoundError("Project");
  return project;
}

export async function saveProject(db: Db, actor: Actor, id: string | null, input: ProjectInput) {
  assertCan(actor, "portfolio.manage");
  if (input.clientName && !input.clientNamePermission)
    throw new RuleError(
      "client_permission",
      "Only add the client's name once they have agreed to it being shown.",
    );
  const tags = input.scopeTags.filter((t) => (scopeTags as readonly string[]).includes(t));
  return db.$transaction(async (tx) => {
    const before = id ? await tx.portfolioProject.findUnique({ where: { id } }) : null;
    if (id && !before) throw new NotFoundError("Project");
    const clash = await tx.portfolioProject.findFirst({
      where: { slug: input.slug, ...(id && { id: { not: id } }) },
      select: { id: true },
    });
    if (clash) throw new RuleError("slug", "Another project already uses this web address.");
    const data = {
      ...input,
      scopeTags: tags,
      clientName: input.clientNamePermission ? input.clientName : null,
    };
    const saved = id
      ? await tx.portfolioProject.update({ where: { id }, data })
      : await tx.portfolioProject.create({ data });
    const changes = Object.fromEntries(
      Object.entries(data).filter(
        ([k, v]) =>
          JSON.stringify((before as Record<string, unknown> | null)?.[k] ?? null) !== JSON.stringify(v),
      ),
    ) as Prisma.InputJsonObject;
    await audit(tx, {
      actorId: actor.id,
      action: id ? "portfolio.updated" : "portfolio.created",
      entityType: "portfolio_project",
      entityId: saved.id,
      changes,
    });
    return saved.id;
  });
}

export async function deleteProject(db: Db, actor: Actor, id: string) {
  assertCan(actor, "portfolio.manage");
  await db.$transaction(async (tx) => {
    const p = await tx.portfolioProject.findUnique({ where: { id } });
    if (!p) throw new NotFoundError("Project");
    await tx.portfolioProject.delete({ where: { id } });
    await audit(tx, {
      actorId: actor.id,
      action: "portfolio.deleted",
      entityType: "portfolio_project",
      entityId: id,
      changes: { slug: p.slug, nameEn: p.nameEn },
    });
  });
}

export async function addProjectImage(
  db: Db,
  actor: Actor,
  input: { projectId: string; fileId: string; altEn: string; altAr: string; usagePermission: boolean },
) {
  assertCan(actor, "portfolio.manage");
  if (!input.usagePermission)
    throw new RuleError(
      "usage",
      "Confirm we have permission to show this photo (from the client and the photographer).",
    );
  await db.$transaction(async (tx) => {
    const project = await tx.portfolioProject.findUnique({
      where: { id: input.projectId },
      include: { _count: { select: { images: true } } },
    });
    if (!project) throw new NotFoundError("Project");
    const file = await tx.fileAsset.count({
      where: { id: input.fileId, kind: "project_photo", visibility: "public", status: "verified" },
    });
    if (!file) throw new RuleError("image", "Choose a project photo from Website images.");
    const image = await tx.portfolioImage.create({
      data: { ...input, sortOrder: project._count.images },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "portfolio.image_added",
      entityType: "portfolio_project",
      entityId: project.id,
      changes: { imageId: image.id, fileId: input.fileId, altEn: input.altEn },
    });
  });
}

export async function removeProjectImage(db: Db, actor: Actor, imageId: string) {
  assertCan(actor, "portfolio.manage");
  return db.$transaction(async (tx) => {
    const image = await tx.portfolioImage.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundError("Photo");
    await tx.portfolioImage.delete({ where: { id: imageId } });
    await audit(tx, {
      actorId: actor.id,
      action: "portfolio.image_removed",
      entityType: "portfolio_project",
      entityId: image.projectId,
      changes: { imageId, fileId: image.fileId },
    });
    return image.projectId;
  });
}

/** Public: published projects with their permitted photos. */
export async function publicProjects(db: Db) {
  return db.portfolioProject.findMany({
    where: { published: true },
    include: {
      images: {
        where: { usagePermission: true, file: { visibility: "public", status: "verified" } },
        select: { fileId: true, altEn: true, altAr: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ sortOrder: "asc" }],
  });
}
