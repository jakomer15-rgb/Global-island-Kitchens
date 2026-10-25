import type { ConsultationStatus, Prisma } from "@/generated/prisma/client";
import type { Db } from "@/server/db/client";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import { NotFoundError, RuleError } from "@/server/errors";
import { assignableStaff, notify, paged, pageArgs } from "./shared";

export const consultationStatuses: ConsultationStatus[] = [
  "requested",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];

/** Allowed moves: requested → confirmed/cancelled; confirmed → completed/cancelled/no_show. */
const transitions: Record<ConsultationStatus, ConsultationStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function nextStatuses(status: ConsultationStatus) {
  return transitions[status];
}

export async function listConsultations(
  db: Db,
  actor: Actor,
  filters: { status?: ConsultationStatus; when?: "upcoming" | "past"; page?: number },
  today = new Date(),
) {
  assertCan(actor, "consultation.read");
  const startOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const where: Prisma.ConsultationWhereInput = {
    lead: { archivedAt: null },
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.when === "upcoming" ? { preferredDate: { gte: startOfToday } } : {}),
    ...(filters.when === "past" ? { preferredDate: { lt: startOfToday } } : {}),
  };
  const { skip, take, page } = pageArgs(filters.page);
  const [items, total] = await Promise.all([
    db.consultation.findMany({
      where,
      orderBy: filters.when === "past" ? { preferredDate: "desc" } : { preferredDate: "asc" },
      skip,
      take,
      include: {
        customer: { select: { name: true, phone: true } },
        lead: { select: { id: true, reference: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    db.consultation.count({ where }),
  ]);
  return paged(items, total, page);
}

export async function changeConsultationStatus(
  db: Db,
  actor: Actor,
  input: { id: string; status: ConsultationStatus },
) {
  assertCan(actor, "consultation.update");
  return db.$transaction(async (tx) => {
    const c = await tx.consultation.findUnique({ where: { id: input.id }, include: { lead: true } });
    if (!c) throw new NotFoundError("Consultation");
    if (!transitions[c.status].includes(input.status)) {
      throw new RuleError("transition", `A ${c.status} consultation can't be marked ${input.status}.`);
    }
    await tx.consultation.update({
      where: { id: c.id },
      data: { status: input.status, ...(input.status === "confirmed" ? { confirmedAt: new Date() } : {}) },
    });
    await tx.leadActivity.create({
      data: {
        leadId: c.leadId,
        kind: "status_change",
        authorId: actor.id,
        body: `Consultation: ${c.status} → ${input.status}`,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "consultation.status_changed",
      entityType: "consultation",
      entityId: c.id,
      changes: { from: c.status, to: input.status },
    });
  });
}

export async function assignConsultation(db: Db, actor: Actor, input: { id: string; userId: string | null }) {
  assertCan(actor, "consultation.update");
  return db.$transaction(async (tx) => {
    const c = await tx.consultation.findUnique({ where: { id: input.id }, include: { lead: true } });
    if (!c) throw new NotFoundError("Consultation");
    if (input.userId && !(await assignableStaff(tx)).some((u) => u.id === input.userId))
      throw new RuleError("assignee");
    await tx.consultation.update({ where: { id: c.id }, data: { assignedToId: input.userId } });
    if (input.userId && input.userId !== actor.id) {
      await notify(
        tx,
        input.userId,
        `Consultation ${c.lead.reference} assigned to you`,
        `/admin/leads/${c.leadId}`,
      );
    }
    await audit(tx, {
      actorId: actor.id,
      action: "consultation.assigned",
      entityType: "consultation",
      entityId: c.id,
      changes: { to: input.userId },
    });
  });
}
