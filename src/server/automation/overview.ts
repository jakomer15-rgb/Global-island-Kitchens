import type { Prisma } from "@/generated/prisma/client";
import { assertCan, can, type Actor } from "@/server/auth/staff";
import type { Db } from "@/server/db/client";

const DAY = 24 * 60 * 60 * 1000;
/** Bahrain is UTC+3 all year (no daylight saving). */
const BAHRAIN_OFFSET = 3 * 60 * 60 * 1000;

/** Midnight in Bahrain at the start of the day containing `now`, as a UTC instant. */
export function bahrainDayStart(now: Date): Date {
  const local = now.getTime() + BAHRAIN_OFFSET;
  return new Date(Math.floor(local / DAY) * DAY - BAHRAIN_OFFSET);
}

const openLead: Prisma.LeadWhereInput = { archivedAt: null, status: { notIn: ["won", "lost"] } };

/**
 * Figures for the Automation Centre overview, all counted from the database at request time. A figure
 * the person may not see (no permission) is null, and the page leaves it out.
 */
export async function centreOverview(db: Db, actor: Actor, now = new Date()) {
  assertCan(actor, "automation.read");
  const today = bahrainDayStart(now);
  const since7 = new Date(now.getTime() - 7 * DAY);
  const since30 = new Date(now.getTime() - 30 * DAY);
  const leads = can(actor, "lead.read");
  const quotes = can(actor, "quotation.read");
  const none = Promise.resolve(null);

  const [
    enquiriesToday,
    enquiries7,
    enquiries30,
    notContacted,
    byTemperature,
    followUpsOverdue,
    followUpsToday,
    chats7,
    quotationsCreated30,
    quotationsAwaiting,
    quotationsApproved30,
    orders30,
    decided,
  ] = await Promise.all([
    leads ? db.lead.count({ where: { archivedAt: null, createdAt: { gte: today } } }) : none,
    leads ? db.lead.count({ where: { archivedAt: null, createdAt: { gte: since7 } } }) : none,
    leads ? db.lead.count({ where: { archivedAt: null, createdAt: { gte: since30 } } }) : none,
    leads ? db.lead.count({ where: { archivedAt: null, status: "new" } }) : none,
    leads
      ? db.lead.groupBy({ by: ["temperature"], where: openLead, _count: { _all: true } })
      : Promise.resolve(null),
    leads
      ? db.followUp.count({ where: { doneAt: null, dueAt: { lt: now }, lead: { archivedAt: null } } })
      : none,
    leads
      ? db.followUp.count({
          where: {
            doneAt: null,
            dueAt: { gte: now, lt: new Date(today.getTime() + DAY) },
            lead: { archivedAt: null },
          },
        })
      : none,
    leads ? db.chatConversation.count({ where: { startedAt: { gte: since7 } } }) : none,
    quotes ? db.quotation.count({ where: { createdAt: { gte: since30 } } }) : none,
    quotes ? db.quotation.count({ where: { status: "sent" } }) : none,
    quotes ? db.quotationRevision.count({ where: { approvedAt: { gte: since30 } } }) : none,
    quotes ? db.order.count({ where: { createdAt: { gte: since30 } } }) : none,
    leads
      ? db.lead.groupBy({
          by: ["status"],
          where: { archivedAt: null, status: { in: ["won", "lost"] } },
          _count: { _all: true },
        })
      : Promise.resolve(null),
  ]);

  const temperature = byTemperature
    ? {
        hot: byTemperature.find((t) => t.temperature === "hot")?._count._all ?? 0,
        warm: byTemperature.find((t) => t.temperature === "warm")?._count._all ?? 0,
        cold: byTemperature.find((t) => t.temperature === "cold")?._count._all ?? 0,
        unrated: byTemperature.find((t) => t.temperature === null)?._count._all ?? 0,
      }
    : null;
  const won = decided?.find((d) => d.status === "won")?._count._all ?? 0;
  const lost = decided?.find((d) => d.status === "lost")?._count._all ?? 0;

  return {
    enquiriesToday,
    enquiries7,
    enquiries30,
    notContacted,
    temperature,
    followUpsOverdue,
    followUpsToday,
    chats7,
    quotationsCreated30,
    quotationsAwaiting,
    quotationsApproved30,
    orders30,
    /** Won out of decided leads, or null when none are decided (or not visible). */
    conversion:
      decided && won + lost > 0
        ? { percent: Math.round((won / (won + lost)) * 100), won, decided: won + lost }
        : null,
  };
}

export type ApprovalItem = {
  kind: "ai_draft" | "designer";
  id: string;
  /** Short description: draft type and lead reference, or the designer's name. */
  title: string;
  detail: string | null;
  createdAt: Date;
  href: string;
};

/**
 * Everything waiting for a person's decision, from the tables that hold it. Each kind appears only for
 * staff who may decide it. Later stages add their own kinds (outbound campaigns, social posts).
 */
export async function approvalQueue(db: Db, actor: Actor, limit = 100) {
  assertCan(actor, "automation.read");
  const showDrafts = can(actor, "ai.review");
  const showDesigners = can(actor, "designer.manage");
  const [drafts, draftCount, designers, designerCount] = await Promise.all([
    showDrafts
      ? db.aiDraft.findMany({
          where: { status: "pending_review" },
          orderBy: { createdAt: "asc" },
          take: limit,
          select: {
            id: true,
            kind: true,
            createdAt: true,
            lead: { select: { reference: true } },
            input: true,
          },
        })
      : Promise.resolve([]),
    showDrafts ? db.aiDraft.count({ where: { status: "pending_review" } }) : Promise.resolve(0),
    showDesigners
      ? db.designerAccount.findMany({
          where: { status: "pending" },
          orderBy: { createdAt: "asc" },
          take: limit,
          select: {
            id: true,
            createdAt: true,
            company: true,
            profession: true,
            user: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    showDesigners ? db.designerAccount.count({ where: { status: "pending" } }) : Promise.resolve(0),
  ]);

  const items: ApprovalItem[] = [
    ...drafts.map((d) => {
      const topic = (d.input as { topic?: unknown } | null)?.topic;
      return {
        kind: "ai_draft" as const,
        id: d.id,
        title: d.kind,
        detail: d.lead?.reference ?? (typeof topic === "string" ? topic.slice(0, 120) : null),
        createdAt: d.createdAt,
        href: "/admin/ai",
      };
    }),
    ...designers.map((d) => ({
      kind: "designer" as const,
      id: d.id,
      title: d.user.name,
      detail: [d.profession.replace(/_/g, " "), d.company].filter(Boolean).join(" · "),
      createdAt: d.createdAt,
      href: `/admin/designers/${d.id}`,
    })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return {
    items: items.slice(0, limit),
    counts: { ai_draft: showDrafts ? draftCount : null, designer: showDesigners ? designerCount : null },
    total: draftCount + designerCount,
  };
}
