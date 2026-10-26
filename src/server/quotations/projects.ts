import type { OrderStatus, Prisma, ProjectStage } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import { notify, paged, pageArgs } from "@/server/crm/shared";
import type { Db } from "@/server/db/client";
import { NotFoundError, RuleError } from "@/server/errors";
import { nextNumber } from "@/server/numbers";

/** Projects follow the stages in docs/ARCHITECTURE.md §6; every change is kept (append-only). */
export const projectStages: ProjectStage[] = [
  "inquiry",
  "measurement",
  "design",
  "quotation",
  "approval",
  "production",
  "installation",
  "completion",
];
export const orderStatuses: OrderStatus[] = [
  "confirmed",
  "in_production",
  "installed",
  "completed",
  "cancelled",
];

export async function listProjects(
  db: Db,
  actor: Actor,
  filters: { stage?: ProjectStage; assignedTo?: string; q?: string; page?: number },
) {
  assertCan(actor, "project.read");
  const q = filters.q?.trim();
  const where: Prisma.ProjectWhereInput = {
    ...(filters.stage && { stage: filters.stage }),
    ...(filters.assignedTo === "none"
      ? { assignedToId: null }
      : filters.assignedTo
        ? { assignedToId: filters.assignedTo }
        : {}),
    ...(q && {
      OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };
  const { skip, take, page } = pageArgs(filters.page);
  const [items, total, byStage] = await Promise.all([
    db.project.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        assignedTo: { select: { name: true } },
        order: { select: { number: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
    db.project.count({ where }),
    db.project.groupBy({ by: ["stage"], _count: true }),
  ]);
  return {
    ...paged(items, total, page),
    byStage: Object.fromEntries(byStage.map((s) => [s.stage, s._count])),
  };
}

export async function getProject(db: Db, actor: Actor, id: string) {
  assertCan(actor, "project.read");
  const project = await db.project.findUnique({
    where: { id },
    include: {
      customer: true,
      lead: { select: { id: true, reference: true } },
      assignedTo: { select: { id: true, name: true } },
      order: {
        include: {
          revision: { select: { revision: true, quotation: { select: { id: true, number: true } } } },
        },
      },
      stageChanges: { orderBy: { changedAt: "desc" }, include: { changedBy: { select: { name: true } } } },
    },
  });
  if (!project) throw new NotFoundError("Project");
  return project;
}

/** A project started from a lead before any quotation (to track measurement and design). */
export async function createProjectFromLead(db: Db, actor: Actor, input: { leadId: string; title?: string }) {
  assertCan(actor, "project.manage");
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id: input.leadId, archivedAt: null } });
    if (!lead) throw new NotFoundError("Lead");
    const open = await tx.project.findFirst({
      where: { leadId: lead.id, orderId: null },
      select: { id: true },
    });
    if (open) throw new RuleError("exists", "This lead already has an open project.");
    const project = await tx.project.create({
      data: {
        reference: await nextNumber(tx, "PR"),
        customerId: lead.customerId,
        leadId: lead.id,
        title: (input.title?.trim() || lead.summary).slice(0, 200),
        stage: "inquiry",
        assignedToId: lead.assignedToId,
      },
    });
    await tx.projectStageChange.create({
      data: {
        projectId: project.id,
        toStage: "inquiry",
        changedById: actor.id,
        note: `From lead ${lead.reference}`,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      changes: { reference: project.reference, leadId: lead.id },
    });
    return project.id;
  });
}

export async function changeStage(
  db: Db,
  actor: Actor,
  input: { projectId: string; stage: ProjectStage; note: string | null },
) {
  assertCan(actor, "project.manage");
  await db.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new NotFoundError("Project");
    if (project.stage === input.stage) throw new RuleError("same", "The project is already at that stage.");
    const back = projectStages.indexOf(input.stage) < projectStages.indexOf(project.stage);
    if (back && !input.note) throw new RuleError("note", "Say why the project is moving back a stage.");
    await tx.project.update({ where: { id: project.id }, data: { stage: input.stage } });
    await tx.projectStageChange.create({
      data: {
        projectId: project.id,
        fromStage: project.stage,
        toStage: input.stage,
        changedById: actor.id,
        note: input.note,
      },
    });
    if (project.assignedToId && project.assignedToId !== actor.id)
      await notify(
        tx,
        project.assignedToId,
        `${project.reference} moved to ${input.stage}`,
        `/admin/projects/${project.id}`,
      );
    await audit(tx, {
      actorId: actor.id,
      action: "project.stage_changed",
      entityType: "project",
      entityId: project.id,
      changes: { from: project.stage, to: input.stage, note: input.note },
    });
  });
}

export async function updateProject(
  db: Db,
  actor: Actor,
  id: string,
  input: {
    title: string;
    siteAddress: string | null;
    targetDate: Date | null;
    assignedToId: string | null;
    notes: string | null;
  },
) {
  assertCan(actor, "project.manage");
  await db.$transaction(async (tx) => {
    const before = await tx.project.findUnique({ where: { id } });
    if (!before) throw new NotFoundError("Project");
    if (input.assignedToId) {
      const staff = await tx.user.count({
        where: { id: input.assignedToId, kind: "staff", status: "active" },
      });
      if (!staff) throw new RuleError("assignee", "Choose an active staff member.");
    }
    await tx.project.update({ where: { id }, data: input });
    if (input.assignedToId && input.assignedToId !== before.assignedToId && input.assignedToId !== actor.id)
      await notify(
        tx,
        input.assignedToId,
        `Project ${before.reference} assigned to you`,
        `/admin/projects/${id}`,
      );
    await audit(tx, {
      actorId: actor.id,
      action: "project.updated",
      entityType: "project",
      entityId: id,
      changes: JSON.parse(JSON.stringify(input)) as Prisma.InputJsonObject,
    });
  });
}

export async function listOrders(db: Db, actor: Actor, filters: { status?: OrderStatus; page?: number }) {
  assertCan(actor, "quotation.read");
  const where: Prisma.OrderWhereInput = filters.status ? { status: filters.status } : {};
  const { skip, take, page } = pageArgs(filters.page);
  const [items, total] = await Promise.all([
    db.order.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        project: { select: { id: true, reference: true, stage: true } },
        revision: {
          select: { revision: true, quotation: { select: { id: true, number: true, title: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    db.order.count({ where }),
  ]);
  return paged(items, total, page);
}

export async function updateOrder(
  db: Db,
  actor: Actor,
  id: string,
  input: { status: OrderStatus; depositFils: number | null; depositReceived: boolean },
  now = new Date(),
) {
  assertCan(actor, "project.manage");
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundError("Order");
    if (input.depositFils !== null && (input.depositFils < 0 || BigInt(input.depositFils) > order.totalFils))
      throw new RuleError("deposit", "The deposit can't be more than the order total.");
    if (input.depositReceived && input.depositFils === null)
      throw new RuleError("deposit", "Enter the deposit amount before marking it received.");
    await tx.order.update({
      where: { id },
      data: {
        status: input.status,
        depositFils: input.depositFils === null ? null : BigInt(input.depositFils),
        depositReceivedAt: input.depositReceived ? (order.depositReceivedAt ?? now) : null,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "order.updated",
      entityType: "order",
      entityId: id,
      changes: {
        status: input.status,
        depositFils: input.depositFils,
        depositReceived: input.depositReceived,
      },
    });
  });
}
