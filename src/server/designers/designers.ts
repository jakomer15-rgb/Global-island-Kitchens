import { Prisma } from "@/generated/prisma/client";
import type { Db, Tx } from "@/server/db/client";
import { audit } from "@/server/audit";
import { createDesignerUser } from "@/server/auth/accounts";
import { notify } from "@/server/crm/shared";
import { NotFoundError, RuleError } from "@/server/errors";
import type { Register, DesignerProject } from "@/lib/designer";
import { designerProgress } from "@/lib/designer";
import { submitDesignerProject } from "@/server/enquiries/submit";
import type { StorageDriver } from "@/server/storage/driver";
import { verifyUploads } from "@/server/storage/files";
import type { DesignerActor } from "./session";

/** Active staff who hold a permission, to notify. */
async function staffWith(tx: Tx, permission: string) {
  return tx.user.findMany({
    where: {
      kind: "staff",
      status: "active",
      roles: { some: { role: { permissions: { some: { permissionKey: permission } } } } },
    },
    select: { id: true },
  });
}

function assertApproved(designer: DesignerActor) {
  if (designer.status !== "approved") throw new RuleError("designerNotApproved");
}

/**
 * Registers a designer: a sign-in (kind designer) and a pending profile. An email that already has
 * an account is answered the same way as a new one, so the form can't be used to find out who has one.
 */
export async function registerDesigner(
  db: Db,
  input: Register,
  ctx: { ipHash: string | null },
): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      const { userId, designerId } = await createDesignerUser(tx, {
        email: input.email,
        name: input.name,
        password: input.password,
        company: input.company ?? null,
        profession: input.profession,
        phone: input.phone,
      });
      await audit(tx, {
        actorId: null,
        action: "designer.registered",
        entityType: "designer",
        entityId: designerId,
        changes: { profession: input.profession, userId },
        ipHash: ctx.ipHash,
      });
      for (const staff of await staffWith(tx, "designer.manage")) {
        await notify(
          tx,
          staff.id,
          "New designer registration",
          "/admin/designers",
          `${input.name}${input.company ? `, ${input.company}` : ""} is waiting for approval.`,
        );
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
}

// ───────────────────────────── The designer's own data ─────────────────────────────

export async function listMyProjects(db: Db, designer: DesignerActor) {
  assertApproved(designer);
  const rows = await db.designerProject.findMany({
    where: { designerId: designer.designerId },
    orderBy: { createdAt: "desc" },
    include: {
      request: {
        select: {
          reference: true,
          category: true,
          lead: { select: { status: true, projects: { select: { stage: true } } } },
        },
      },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    reference: p.request.reference,
    category: p.request.category,
    createdAt: p.createdAt,
    progress: designerProgress({
      leadStatus: p.request.lead.status,
      projectStage: p.request.lead.projects[0]?.stage ?? null,
    }),
  }));
}

/** One of the designer's own projects; anything else is "not found", never "forbidden". */
export async function getMyProject(db: Db, designer: DesignerActor, id: string) {
  assertApproved(designer);
  const p = await db.designerProject.findFirst({
    where: { id, designerId: designer.designerId },
    include: {
      request: {
        select: {
          reference: true,
          category: true,
          unit: true,
          measurements: true,
          preferredBoards: true,
          finishNotes: true,
          message: true,
          area: true,
          lead: { select: { status: true, projects: { select: { stage: true } } } },
        },
      },
      materials: { select: { material: { select: { id: true, code: true, nameEn: true, nameAr: true } } } },
      messages: {
        where: { internal: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, fromStaff: true, createdAt: true },
      },
      files: {
        where: { status: "verified" },
        select: { id: true, originalName: true, sizeBytes: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!p) throw new NotFoundError("Project");
  return {
    ...p,
    progress: designerProgress({
      leadStatus: p.request.lead.status,
      projectStage: p.request.lead.projects[0]?.stage ?? null,
    }),
  };
}

/** Materials a designer can pick: only what the website shows publicly. */
export async function pickableMaterials(db: Db) {
  return db.material.findMany({
    where: { published: true, verifiedAt: { not: null }, availability: { not: "discontinued" } },
    select: { id: true, board: true, code: true, nameEn: true, nameAr: true },
    orderBy: [{ board: "asc" }, { code: "asc" }],
  });
}

export async function submitMyProject(
  db: Db,
  storage: StorageDriver | null,
  designer: DesignerActor,
  input: DesignerProject,
  ctx: { ipHash: string | null },
): Promise<{ id: string; reference: string }> {
  assertApproved(designer);
  let fileIds: string[] = [];
  if (input.files.length) {
    if (!storage) throw new RuleError("uploadsOff");
    fileIds = await verifyUploads(db, storage, input.files);
  }
  const allowed = await db.material.count({
    where: {
      id: { in: input.materialIds },
      published: true,
      verifiedAt: { not: null },
      availability: { not: "discontinued" },
    },
  });
  if (allowed !== new Set(input.materialIds).size) throw new RuleError("materialUnavailable");
  return submitDesignerProject(db, designer, input, { ...ctx, verifiedFileIds: fileIds });
}

export async function addMyMessage(db: Db, designer: DesignerActor, projectId: string, body: string) {
  assertApproved(designer);
  const project = await db.designerProject.findFirst({
    where: { id: projectId, designerId: designer.designerId },
    select: {
      id: true,
      request: { select: { reference: true, lead: { select: { id: true, assignedToId: true } } } },
    },
  });
  if (!project) throw new NotFoundError("Project");
  await db.$transaction(async (tx) => {
    await tx.designerMessage.create({
      data: { projectId: project.id, authorId: designer.userId, fromStaff: false, body },
    });
    const lead = project.request.lead;
    const recipients = lead.assignedToId
      ? [{ id: lead.assignedToId }]
      : await staffWith(tx, "designer.manage");
    for (const staff of recipients) {
      await notify(
        tx,
        staff.id,
        `Message from ${designer.name}`,
        `/admin/leads/${lead.id}`,
        `On ${project.request.reference}`,
      );
    }
  });
}

/** Short-lived link to a file on one of the designer's own projects. */
export async function myFileUrl(db: Db, storage: StorageDriver, designer: DesignerActor, fileId: string) {
  assertApproved(designer);
  const file = await db.fileAsset.findFirst({
    where: { id: fileId, status: "verified", designerProject: { designerId: designer.designerId } },
  });
  if (!file) throw new NotFoundError("File");
  return storage.downloadUrl(file.storageKey, file.originalName, file.mimeType, 60);
}
