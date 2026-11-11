import type {
  ActivityKind,
  CustomerType,
  LeadSource,
  LeadStatus,
  LeadTemperature,
  Prisma,
} from "@/generated/prisma/client";
import type { Db } from "@/server/db/client";
import { audit } from "@/server/audit";
import { enqueue } from "@/server/outbox/events";
import { assertCan, can, type Actor } from "@/server/auth/staff";
import { NotFoundError, RuleError } from "@/server/errors";
import { assignableStaff, notify, paged, pageArgs } from "./shared";

/** The owner's pipeline, in order (2026-11-11). `quoted` is the Quotation stage. */
export const leadStatuses: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "site_visit",
  "measurement",
  "quoted",
  "negotiation",
  "won",
  "lost",
];
/** Stages a lead is still being worked in (everything before won / lost). */
export const openLeadStatuses: LeadStatus[] = leadStatuses.filter((s) => s !== "won" && s !== "lost");
/** Pipeline names shown to staff. */
export const leadStatusNames: Record<LeadStatus, string> = {
  new: "New inquiry",
  contacted: "Contacted",
  qualified: "Qualified",
  site_visit: "Site visit",
  measurement: "Measurement",
  quoted: "Quotation",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};
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
  "website_chat",
  "other",
];
/** Kinds staff can log by hand (status changes and assignments are logged automatically). */
export const loggableKinds: ActivityKind[] = ["note", "call", "email", "whatsapp", "meeting"];

export const leadSorts = ["newest", "oldest", "score", "next_follow_up", "last_contact", "stale"] as const;
export type LeadSort = (typeof leadSorts)[number];
export const followUpFilters = ["overdue", "today", "week", "none"] as const;

export interface LeadFilters {
  status?: LeadStatus;
  /** "open": any stage before won / lost. */
  stage?: "open";
  source?: LeadSource;
  /** User id, or "none" for unassigned. */
  assignedTo?: string;
  /** HOT / WARM / COLD, or "none" for leads without a rating. */
  temperature?: LeadTemperature | "none";
  customerType?: CustomerType;
  /** Product page key (src/config/routes.ts) or "none". */
  category?: string;
  followUp?: (typeof followUpFilters)[number];
  /** Minimum score (0–100). */
  minScore?: number;
  /** Received from / before (inclusive / exclusive). */
  from?: Date;
  to?: Date;
  q?: string;
  sort?: LeadSort;
  page?: number;
}

const DAY = 24 * 60 * 60 * 1000;
/** Bahrain (UTC+3, no daylight saving) midnight at the start of `now`'s day. */
const bahrainMidnight = (now: Date) =>
  new Date(Math.floor((now.getTime() + 3 * 3600_000) / DAY) * DAY - 3 * 3600_000);

/** The filter shared by the leads list, the pipeline and the CSV export. */
export function leadWhere(filters: LeadFilters, now = new Date()): Prisma.LeadWhereInput {
  const q = filters.q?.trim();
  const and: Prisma.LeadWhereInput[] = [];
  if (filters.followUp === "overdue") and.push({ nextFollowUpAt: { lt: now } });
  if (filters.followUp === "today")
    and.push({ nextFollowUpAt: { lt: new Date(bahrainMidnight(now).getTime() + DAY) } });
  if (filters.followUp === "week") and.push({ nextFollowUpAt: { lt: new Date(now.getTime() + 7 * DAY) } });
  if (filters.followUp === "none") and.push({ nextFollowUpAt: null });
  if (filters.from || filters.to)
    and.push({
      createdAt: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lt: filters.to } : {}),
      },
    });
  return {
    archivedAt: null,
    ...(filters.status
      ? { status: filters.status }
      : filters.stage === "open"
        ? { status: { in: openLeadStatuses } }
        : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.temperature === "none"
      ? { temperature: null }
      : filters.temperature
        ? { temperature: filters.temperature }
        : {}),
    ...(filters.assignedTo === "none"
      ? { assignedToId: null }
      : filters.assignedTo
        ? { assignedToId: filters.assignedTo }
        : {}),
    ...(filters.customerType ? { customer: { type: filters.customerType } } : {}),
    ...(filters.category === "none"
      ? { category: null }
      : filters.category
        ? { category: filters.category }
        : {}),
    ...(filters.minScore !== undefined ? { score: { gte: filters.minScore } } : {}),
    ...(and.length ? { AND: and } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { customer: { phone: { contains: q.replace(/\s/g, "") } } },
            { customer: { email: { contains: q.toLowerCase() } } },
            { customer: { location: { contains: q, mode: "insensitive" } } },
            { requirements: { location: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

/** Sort order; ties fall back to newest first. Empty values (no score, no date) go last. */
export function leadOrder(sort: LeadSort = "newest"): Prisma.LeadOrderByWithRelationInput[] {
  const newest: Prisma.LeadOrderByWithRelationInput = { createdAt: "desc" };
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }];
    case "score":
      return [{ score: { sort: "desc", nulls: "last" } }, newest];
    case "next_follow_up":
      return [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, newest];
    case "last_contact":
      return [{ lastContactAt: { sort: "desc", nulls: "last" } }, newest];
    case "stale":
      // Longest without contact first; never contacted first of all.
      return [{ lastContactAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }];
    default:
      return [newest];
  }
}

export async function listLeads(db: Db, actor: Actor, filters: LeadFilters) {
  assertCan(actor, "lead.read");
  const where = leadWhere(filters);
  const { skip, take, page } = pageArgs(filters.page);
  const [items, total] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: leadOrder(filters.sort),
      skip,
      take,
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true, type: true, location: true } },
        assignedTo: { select: { id: true, name: true } },
        requirements: { select: { location: true, budget: true } },
      },
    }),
    db.lead.count({ where }),
  ]);
  return paged(items, total, page);
}

/**
 * The sales pipeline: each stage with its count and its leads (highest score first, up to `perStage`).
 * Won and lost show counts for the period only.
 */
export async function leadPipeline(
  db: Db,
  actor: Actor,
  filters: Pick<LeadFilters, "assignedTo" | "temperature" | "customerType" | "source" | "q">,
  perStage = 30,
  now = new Date(),
) {
  assertCan(actor, "lead.read");
  const base = leadWhere(filters, now);
  const since90 = new Date(now.getTime() - 90 * DAY);
  const [counts, decided, columns] = await Promise.all([
    db.lead.groupBy({
      by: ["status"],
      where: { ...base, status: { in: openLeadStatuses } },
      _count: { _all: true },
    }),
    db.lead.groupBy({
      by: ["status"],
      where: { ...base, status: { in: ["won", "lost"] }, updatedAt: { gte: since90 } },
      _count: { _all: true },
    }),
    Promise.all(
      openLeadStatuses.map((status) =>
        db.lead.findMany({
          where: { ...base, status },
          orderBy: leadOrder("score"),
          take: perStage,
          select: {
            id: true,
            reference: true,
            summary: true,
            score: true,
            temperature: true,
            nextFollowUpAt: true,
            lastContactAt: true,
            createdAt: true,
            customer: { select: { name: true } },
            assignedTo: { select: { name: true } },
          },
        }),
      ),
    ),
  ]);
  const count = (rows: { status: LeadStatus; _count: { _all: number } }[], s: LeadStatus) =>
    rows.find((r) => r.status === s)?._count._all ?? 0;
  return {
    stages: openLeadStatuses.map((status, i) => ({
      status,
      count: count(counts, status),
      leads: columns[i]!,
    })),
    won90: count(decided, "won"),
    lost90: count(decided, "lost"),
  };
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
      requirements: true,
      chats: {
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          startedAt: true,
          messageCount: true,
          language: true,
          temperature: true,
          temperatureNote: true,
          summary: true,
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
    await enqueue(tx, "lead.status_changed", {
      leadId: lead.id,
      reference: lead.reference,
      from: lead.status,
      to: input.status,
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
