import type { Db } from "@/server/db/client";
import { assertCan, can, type Actor } from "@/server/auth/staff";

const DAY = 24 * 60 * 60 * 1000;

/** Monday 00:00 UTC of the week containing `d`. */
function weekStart(d: Date) {
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
}

/**
 * Dashboard figures from live data. Quotation and project figures arrive with Phase 6; nothing is
 * shown for them until then.
 */
export async function dashboard(db: Db, actor: Actor, now = new Date()) {
  assertCan(actor, "lead.read");
  const since30 = new Date(now.getTime() - 30 * DAY);
  const firstWeek = new Date(weekStart(now).getTime() - 11 * 7 * DAY);
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [
    total,
    last30,
    newLeads,
    openRequests,
    byStatus,
    bySource,
    recentLeads,
    weekly,
    upcomingConsultations,
    dueFollowUps,
  ] = await Promise.all([
    db.lead.count({ where: { archivedAt: null } }),
    db.lead.count({ where: { archivedAt: null, createdAt: { gte: since30 } } }),
    db.lead.count({ where: { archivedAt: null, status: "new" } }),
    db.quotationRequest.count({
      where: { status: { in: ["received", "reviewing"] }, lead: { archivedAt: null } },
    }),
    db.lead.groupBy({ by: ["status"], where: { archivedAt: null }, _count: { _all: true } }),
    db.lead.groupBy({
      by: ["source"],
      where: { archivedAt: null, createdAt: { gte: since30 } },
      _count: { _all: true },
    }),
    db.lead.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        reference: true,
        summary: true,
        status: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    }),
    db.$queryRaw<{ week: Date; count: bigint }[]>`
        SELECT date_trunc('week', "created_at") AS week, count(*) AS count
        FROM "leads" WHERE "archived_at" IS NULL AND "created_at" >= ${firstWeek}
        GROUP BY 1 ORDER BY 1`,
    can(actor, "consultation.read")
      ? db.consultation.count({
          where: { status: { in: ["requested", "confirmed"] }, preferredDate: { gte: startOfToday } },
        })
      : Promise.resolve(null),
    db.followUp.count({
      where: { doneAt: null, assignedToId: actor.id, dueAt: { lte: new Date(now.getTime() + DAY) } },
    }),
  ]);

  const statusCount = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Record<
    string,
    number
  >;
  const won = statusCount.won ?? 0;
  const lost = statusCount.lost ?? 0;
  // Conversion: won out of leads that reached a decision.
  const conversion = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null;

  const weeklyMap = new Map(weekly.map((w) => [weekStart(new Date(w.week)).getTime(), Number(w.count)]));
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(firstWeek.getTime() + i * 7 * DAY);
    return { week: start.toISOString().slice(0, 10), leads: weeklyMap.get(start.getTime()) ?? 0 };
  });

  return {
    total,
    last30,
    newLeads,
    openRequests,
    upcomingConsultations,
    dueFollowUps,
    conversion,
    statusCount,
    bySource: bySource
      .map((s) => ({ source: s.source, count: s._count._all }))
      .sort((a, b) => b.count - a.count),
    recentLeads,
    weeks,
  };
}

export async function recentActivity(db: Db, actor: Actor) {
  assertCan(actor, "lead.read");
  return db.leadActivity.findMany({
    where: { lead: { archivedAt: null }, kind: { not: "message" } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      kind: true,
      body: true,
      createdAt: true,
      author: { select: { name: true } },
      lead: { select: { id: true, reference: true } },
    },
  });
}

export async function myNotifications(db: Db, actor: Actor) {
  return db.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 30 });
}

export async function unreadNotificationCount(db: Db, actor: Actor) {
  return db.notification.count({ where: { userId: actor.id, readAt: null } });
}

export async function markNotificationsRead(db: Db, actor: Actor) {
  await db.notification.updateMany({
    where: { userId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });
}
