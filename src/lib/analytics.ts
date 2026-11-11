import { bahrainDay, dayStart } from "./social";

/**
 * Reporting periods in Bahrain time (UTC+3, no daylight saving). Weeks start on Saturday, as in the other
 * reports. Pure, so they are unit-tested.
 */

export const periodKeys = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_7_days",
  "last_30_days",
] as const;
export type PeriodKey = (typeof periodKeys)[number];

export const periodNames: Record<PeriodKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
  last_month: "Last month",
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
};

export interface Period {
  key: string;
  label: string;
  start: Date;
  /** Exclusive. For a period still running, the end of the day/week/month (figures up to now). */
  end: Date;
  /** "2026-11-07" to "2026-11-13", Bahrain days, end inclusive. */
  from: string;
  to: string;
}

const DAY = 24 * 60 * 60 * 1000;
const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

function weekStartDay(day: string) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 Sunday … 6 Saturday
  return addDays(day, -((dow + 1) % 7));
}

function monthStartDay(day: string, offset = 0) {
  const d = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 10);
}

function make(key: string, label: string, firstDay: string, endDayExclusive: string): Period {
  return {
    key,
    label,
    start: dayStart(firstDay),
    end: dayStart(endDayExclusive),
    from: firstDay,
    to: addDays(endDayExclusive, -1),
  };
}

export function period(key: PeriodKey, now = new Date()): Period {
  const today = bahrainDay(now);
  const name = periodNames[key];
  switch (key) {
    case "today":
      return make(key, name, today, addDays(today, 1));
    case "yesterday":
      return make(key, name, addDays(today, -1), today);
    case "this_week": {
      const s = weekStartDay(today);
      return make(key, name, s, addDays(s, 7));
    }
    case "last_week": {
      const s = addDays(weekStartDay(today), -7);
      return make(key, name, s, addDays(s, 7));
    }
    case "this_month":
      return make(key, name, monthStartDay(today), monthStartDay(today, 1));
    case "last_month":
      return make(key, name, monthStartDay(today, -1), monthStartDay(today));
    case "last_7_days":
      return make(key, name, addDays(today, -6), addDays(today, 1));
    case "last_30_days":
      return make(key, name, addDays(today, -29), addDays(today, 1));
  }
}

export type ReportKind = "daily" | "weekly" | "monthly";
export const reportKindNames: Record<ReportKind, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

/** The current period of a report (offset 0) or an earlier one (offset 1 = the one before). */
export function reportPeriod(kind: ReportKind, now = new Date(), offset = 0): Period {
  const today = bahrainDay(now);
  if (kind === "daily") {
    const d = addDays(today, -offset);
    return make(`day:${d}`, d, d, addDays(d, 1));
  }
  if (kind === "weekly") {
    const s = addDays(weekStartDay(today), -7 * offset);
    return make(`week:${s}`, `Week from ${s}`, s, addDays(s, 7));
  }
  const s = monthStartDay(today, -offset);
  return make(`month:${s.slice(0, 7)}`, s.slice(0, 7), s, monthStartDay(s, 1));
}

/** Change from the previous period, as a short text ("+3", "−2", "no change"). */
export function change(now: number | null, before: number | null): string {
  if (now === null || before === null) return "";
  const d = now - before;
  return d === 0 ? "no change" : d > 0 ? `+${d}` : `−${-d}`;
}

/** Median of a list of numbers (null when empty). */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Hours, readable: "45 min", "5.5 h", "3.2 days". */
export function hoursText(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round((h / 24) * 10) / 10} days`;
}
