import { assertCan, type Actor } from "@/server/auth/staff";
import { bahrainDayStart } from "@/server/automation/overview";
import type { Db } from "@/server/db/client";

const DAY = 24 * 60 * 60 * 1000;

/** The period's start and end (Bahrain time): a day, or the week starting on Saturday (the working week). */
export function reportPeriod(period: "day" | "week", now = new Date(), offset = 0) {
  const today = bahrainDayStart(now);
  if (period === "day") {
    const start = new Date(today.getTime() - offset * DAY);
    return { start, end: new Date(start.getTime() + DAY) };
  }
  // Day of the week in Bahrain: 0 Sunday … 6 Saturday.
  const weekday = new Date(today.getTime() + 3 * 3600_000).getUTCDay();
  const sinceSaturday = (weekday + 1) % 7;
  const start = new Date(today.getTime() - (sinceSaturday + 7 * offset) * DAY);
  return { start, end: new Date(start.getTime() + 7 * DAY) };
}

async function counts(db: Db, start: Date, end: Date) {
  const range = { gte: start, lt: end };
  const [added, statusChanges, converted, emailsSent, unsubscribed, leadsBySource] = await Promise.all([
    db.prospect.count({ where: { createdAt: range } }),
    db.auditLog.findMany({
      where: { action: "prospect.status_changed", createdAt: range },
      select: { changes: true },
    }),
    db.auditLog.count({ where: { action: "prospect.converted", createdAt: range } }),
    db.campaignMessage.count({ where: { sentAt: range } }),
    db.prospect.count({ where: { unsubscribedAt: range } }),
    db.lead.groupBy({
      by: ["source"],
      where: { createdAt: range, archivedAt: null },
      _count: { _all: true },
    }),
  ]);
  const to = (s: string) =>
    statusChanges.filter((c) => (c.changes as { to?: string } | null)?.to === s).length;
  return {
    added,
    contacted: to("contacted") + emailsSent,
    interested: to("interested"),
    notInterested: to("not_interested"),
    converted,
    emailsSent,
    unsubscribed,
    leads: leadsBySource.reduce((s, r) => s + r._count._all, 0),
    leadsBySource: leadsBySource
      .map((r) => ({ source: r.source, count: r._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}

/**
 * Daily or weekly lead-generation report, from the database only: prospects added, contacted (by staff
 * or by a campaign email), interested, converted, unsubscribed; leads received by source; with the
 * previous period for comparison and the current prospect list by priority, type and country.
 */
export async function marketingReport(db: Db, actor: Actor, period: "day" | "week", now = new Date()) {
  assertCan(actor, "marketing.manage");
  const current = reportPeriod(period, now, 0);
  const previous = reportPeriod(period, now, 1);
  const [thisPeriod, lastPeriod, byPriority, byType, byCountry, byStatus] = await Promise.all([
    counts(db, current.start, current.end),
    counts(db, previous.start, previous.end),
    db.prospect.groupBy({
      by: ["priority"],
      where: { status: { in: ["new", "contacted", "interested"] } },
      _count: { _all: true },
    }),
    db.prospect.groupBy({ by: ["type"], _count: { _all: true } }),
    db.prospect.groupBy({ by: ["country"], _count: { _all: true } }),
    db.prospect.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const map = <K extends string>(rows: ({ _count: { _all: number } } & Record<string, unknown>)[], key: K) =>
    Object.fromEntries(rows.map((r) => [r[key] as string, r._count._all])) as Record<string, number>;
  return {
    period: current,
    previousPeriod: previous,
    thisPeriod,
    lastPeriod,
    pipeline: {
      byPriority: map(byPriority, "priority"),
      byType: map(byType, "type"),
      byCountry: map(byCountry, "country"),
      byStatus: map(byStatus, "status"),
    },
  };
}
