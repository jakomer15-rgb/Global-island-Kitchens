import type { ActivityKind, LeadSource, LeadStatus, Prisma } from "@/generated/prisma/client";
import type { Db } from "@/server/db/client";
import { audit } from "@/server/audit";
import { assertCan, can, type Actor } from "@/server/auth/staff";
import { NotFoundError, RuleError } from "@/server/errors";
import { assignableStaff, notify, paged, pageArgs } from "./shared";

export const leadStatuses: LeadStatus[] = ["new", "contacted", "qualified", "quoted", "won", "lost"];
export const leadSources: LeadSource[] = [
  "website_quote",
  "website_consultation",
  "website_contact",
  "designer_portal",
  "whatsapp",
  "phone",
  "walk_in",
  "referral",
  "instagram",
  "other",
];
/** Kinds staff can log by hand (status changes and assignments are logged automatically). */
export const loggableKinds: ActivityKind[] = ["note", "call", "email", "whatsapp", "meeting"];

export interface LeadFilters {
  status?: LeadStatus;
  source?: LeadSource;
  /** User id, or "none" for unassigned. */
  assignedTo?: string;
  q?: string;
  page?: number;
}

export async function listLeads(db: Db, actor: Actor, filters: LeadFilters) {
  assertCan(actor, "lead.read");
  const q = filters.q?.trim();
  const where: Prisma.LeadWhereInput = {
    archivedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.assignedTo === "none"
      ? { assignedToId: null }
      : filters.assignedTo
        ? { assignedToId: filters.assignedTo }
        : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { customer: { phone: { contains: q.replace(/\s/g, "") } } },
            { customer: { email: { contains: q.toLowerCase() } } },
          ],
        }
      : {}),
  };
  const { skip, take, page } = pageArgs(filters.page);
  const [items, total] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
        followUps: { where: { doneAt: null }, orderBy: { dueAt: "asc" }, take: 1, select: { dueAt: true } },
      },
    }),
    db.lead.count({ where }),
  ]);
  return paged(items, total, page);
}

export async function getLead(db: Db, actor: Actor, id: string) {
  assertCan(actor, "lead.read");
  const lead = await db.lead.findFirst({
    where: { id, archivedAt: null },
    include: {
      customer: true,
      assignedTo: { select: { id: true, name: true } },
      activities: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      followUps: {
        orderBy: [{ doneAt: "asc" }, { dueAt: "asc" }],
        include: { assignedTo: { select: { name: true } } },
      },
      consultation: true,
      quotationRequest: {
        include: {
          files: {
            where: { status: "verified" },
            select: { id: true, originalName: true, sizeBytes: true, mimeType: true },
          },
        },
      },
    },
  });
  if (!lead) throw new NotFoundError("Lead");
  return lead;
}

export async function changeLeadStatus(
  db: Db,
  actor: Actor,
  input: { id: string; status: LeadStatus; lostReason?: string },
) {
  assertCan(actor, "lead.update");
  const lostReason = input.lostReason?.trim();
  if (input.status === "lost" && !lostReason)
    throw new RuleError("lostReason", "Give a reason when marking a lead lost.");
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id: input.id, archivedAt: null } });
    if (!lead) throw new NotFoundError("Lead");
    if (lead.status === input.status) return;
    await tx.lead.update({
      where: { id: lead.id },
      data: { status: input.status, lostReason: input.status === "lost" ? lostReason : null },
    });
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        kind: "status_change",
        authorId: actor.id,
        body: `Status: ${lead.status} → ${input.status}${input.status === "lost" ? ` (${lostReason})` : ""}`,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "lead.status_changed",
      entityType: "lead",
      entityId: lead.id,
      changes: { from: lead.status, to: input.status, lostReason: lostReason ?? null },
    });
  });
}

export async function assignLead(db: Db, actor: Actor, input: { id: string; userId: string | null }) {
  assertCan(actor, "lead.assign");
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id: input.id, archivedAt: null } });
    if (!lead) throw new NotFoundError("Lead");
    let assignee: { id: string; name: string } | null = null;
    if (input.userId) {
      assignee = (await assignableStaff(tx)).find((u) => u.id === input.userId) ?? null;
      if (!assignee) throw new RuleError("assignee", "That person can't be assigned leads.");
    }
    if (lead.assignedToId === (assignee?.id ?? null)) return;
    await tx.lead.update({ where: { id: lead.id }, data: { assignedToId: assignee?.id ?? null } });
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        kind: "assignment",
        authorId: actor.id,
        body: assignee ? `Assigned to ${assignee.name}` : "Unassigned",
      },
    });
    if (assignee && assignee.id !== actor.id) {
      await notify(
        tx,
        assignee.id,
        `Lead ${lead.reference} assigned to you`,
        `/admin/leads/${lead.id}`,
        lead.summary,
      );
    }
    await audit(tx, {
      actorId: actor.id,
      action: "lead.assigned",
      entityType: "lead",
      entityId: lead.id,
      changes: { from: lead.assignedToId, to: assignee?.id ?? null },
    });
  });
}

/** Internal note or a record of a call, email, WhatsApp message or meeting. */
export async function logActivity(
  db: Db,
  actor: Actor,
  input: { leadId: string; kind: ActivityKind; body: string },
) {
  assertCan(actor, "lead.update");
  if (!loggableKinds.includes(input.kind)) throw new RuleError("kind");
  const body = input.body.trim();
  if (!body) throw new RuleError("body", "Write something to log.");
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id: input.leadId, archivedAt: null } });
    if (!lead) throw new NotFoundError("Lead");
    await tx.leadActivity.create({
      data: { leadId: lead.id, kind: input.kind, body, authorId: actor.id, internal: true },
    });
    // First contact moves a new lead on.
    if (lead.status === "new" && input.kind !== "note") {
      await tx.lead.update({ where: { id: lead.id }, data: { status: "contacted" } });
      await tx.leadActivity.create({
        data: { leadId: lead.id, kind: "status_change", authorId: actor.id, body: "Status: new → contacted" },
      });
    }
    await audit(tx, {
      actorId: actor.id,
      action: "lead.activity_logged",
      entityType: "lead",
      entityId: lead.id,
      changes: { kind: input.kind },
    });
  });
}

export async function scheduleFollowUp(
  db: Db,
  actor: Actor,
  input: { leadId: string; dueAt: Date; note?: string; assignedToId?: string | null },
) {
  assertCan(actor, "lead.update");
  if (Number.isNaN(input.dueAt.getTime())) throw new RuleError("dueAt", "Choose a date and time.");
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id: input.leadId, archivedAt: null } });
    if (!lead) throw new NotFoundError("Lead");
    const assigneeId = input.assignedToId ?? lead.assignedToId ?? actor.id;
    if (!(await assignableStaff(tx)).some((u) => u.id === assigneeId)) throw new RuleError("assignee");
    const followUp = await tx.followUp.create({
      data: {
        leadId: lead.id,
        dueAt: input.dueAt,
        note: input.note?.trim() || null,
        assignedToId: assigneeId,
      },
    });
    if (assigneeId !== actor.id) {
      await notify(tx, assigneeId, `Follow-up for ${lead.reference}`, `/admin/leads/${lead.id}`, input.note);
    }
    await audit(tx, {
      actorId: actor.id,
      action: "followup.scheduled",
      entityType: "lead",
      entityId: lead.id,
      changes: { followUpId: followUp.id, dueAt: input.dueAt.toISOString() },
    });
  });
}

export async function completeFollowUp(db: Db, actor: Actor, id: string) {
  assertCan(actor, "lead.update");
  return db.$transaction(async (tx) => {
    const f = await tx.followUp.findUnique({ where: { id } });
    if (!f) throw new NotFoundError("Follow-up");
    if (f.doneAt) return;
    await tx.followUp.update({ where: { id }, data: { doneAt: new Date() } });
    await audit(tx, {
      actorId: actor.id,
      action: "followup.completed",
      entityType: "lead",
      entityId: f.leadId,
      changes: { followUpId: id },
    });
  });
}

/** Open follow-ups: the actor's own by default; everyone's for those who can assign leads. */
export async function listFollowUps(db: Db, actor: Actor, scope: "mine" | "all" = "mine") {
  assertCan(actor, "lead.read");
  const all = scope === "all" && can(actor, "lead.assign");
  return db.followUp.findMany({
    where: { doneAt: null, ...(all ? {} : { assignedToId: actor.id }), lead: { archivedAt: null } },
    orderBy: { dueAt: "asc" },
    take: 200,
    include: {
      lead: { select: { id: true, reference: true, summary: true, customer: { select: { name: true } } } },
      assignedTo: { select: { name: true } },
    },
  });
}
