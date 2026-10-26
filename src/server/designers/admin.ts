import type { DesignerStatus } from "@/generated/prisma/client";
import type { Db } from "@/server/db/client";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import { NotFoundError, RuleError } from "@/server/errors";

/** Designers, newest first, with how many projects each has submitted. */
export async function listDesigners(db: Db, actor: Actor, opts: { status?: DesignerStatus } = {}) {
  assertCan(actor, "designer.read");
  return db.designerAccount.findMany({
    where: opts.status ? { status: opts.status } : {},
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    include: {
      user: { select: { name: true, email: true, lastLoginAt: true } },
      decidedBy: { select: { name: true } },
      _count: { select: { projects: true } },
    },
  });
}

export async function getDesignerAccount(db: Db, actor: Actor, id: string) {
  assertCan(actor, "designer.read");
  const designer = await db.designerAccount.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, lastLoginAt: true, createdAt: true } },
      decidedBy: { select: { name: true } },
      projects: {
        orderBy: { createdAt: "desc" },
        include: { request: { select: { reference: true, leadId: true, category: true } } },
      },
    },
  });
  if (!designer) throw new NotFoundError("Designer");
  return designer;
}

/**
 * Approve, reject or suspend a designer. Turning someone away or suspending them needs a reason,
 * and ends their open sessions so they are out at once.
 */
export async function decideDesigner(
  db: Db,
  actor: Actor,
  id: string,
  decision: Exclude<DesignerStatus, "pending">,
  note: string | null,
) {
  assertCan(actor, "designer.manage");
  if (decision !== "approved" && !note?.trim()) throw new RuleError("reasonRequired");
  await db.$transaction(async (tx) => {
    const designer = await tx.designerAccount.findUnique({ where: { id } });
    if (!designer) throw new NotFoundError("Designer");
    await tx.designerAccount.update({
      where: { id },
      data: {
        status: decision,
        statusNote: note?.trim() || null,
        decidedById: actor.id,
        decidedAt: new Date(),
      },
    });
    if (decision !== "approved") await tx.session.deleteMany({ where: { userId: designer.userId } });
    await audit(tx, {
      actorId: actor.id,
      action: `designer.${decision}`,
      entityType: "designer",
      entityId: id,
      changes: { from: designer.status, note: note?.trim() || null },
    });
  });
}

/** The designer project behind a lead (if any) with every message, internal notes included. */
export async function designerProjectForLead(db: Db, actor: Actor, leadId: string) {
  assertCan(actor, "designer.read");
  return db.designerProject.findFirst({
    where: { request: { leadId } },
    include: {
      designer: {
        select: {
          id: true,
          company: true,
          profession: true,
          phone: true,
          status: true,
          user: { select: { name: true, email: true } },
        },
      },
      materials: { select: { material: { select: { code: true, nameEn: true } } } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          fromStaff: true,
          internal: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });
}

/** Staff reply on a designer project, or an internal note the designer never sees. */
export async function staffReply(db: Db, actor: Actor, projectId: string, body: string, internal: boolean) {
  assertCan(actor, "designer.manage");
  const text = body.trim();
  if (!text || text.length > 2000) throw new RuleError("invalidMessage");
  await db.$transaction(async (tx) => {
    const project = await tx.designerProject.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundError("Project");
    const message = await tx.designerMessage.create({
      data: { projectId, authorId: actor.id, fromStaff: true, internal, body: text },
    });
    await audit(tx, {
      actorId: actor.id,
      action: internal ? "designer.note_added" : "designer.message_sent",
      entityType: "designer_project",
      entityId: projectId,
      changes: { messageId: message.id },
    });
  });
}
