import { describe, expect, it } from "vitest";
import { change, hoursText, median, period, reportPeriod } from "./analytics";

// Wednesday 11 November 2026, 10:00 in Bahrain.
const now = new Date("2026-11-11T07:00:00Z");

describe("analytics periods (Bahrain time, weeks from Saturday)", () => {
  it("names today, this week and this month", () => {
    expect(period("today", now)).toMatchObject({ from: "2026-11-11", to: "2026-11-11" });
    expect(period("today", now).start.toISOString()).toBe("2026-11-10T21:00:00.000Z");
    expect(period("yesterday", now)).toMatchObject({ from: "2026-11-10", to: "2026-11-10" });
    expect(period("this_week", now)).toMatchObject({ from: "2026-11-07", to: "2026-11-13" });
    expect(period("last_week", now)).toMatchObject({ from: "2026-10-31", to: "2026-11-06" });
    expect(period("this_month", now)).toMatchObject({ from: "2026-11-01", to: "2026-11-30" });
    expect(period("last_month", now)).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(period("last_7_days", now)).toMatchObject({ from: "2026-11-05", to: "2026-11-11" });
    expect(period("last_30_days", now)).toMatchObject({ from: "2026-10-13", to: "2026-11-11" });
  });

  it("uses the Bahrain day, not UTC, near midnight", () => {
    // 22:30 UTC on the 14th is 01:30 on the 15th in Bahrain.
    expect(period("today", new Date("2026-11-14T22:30:00Z")).from).toBe("2026-11-15");
  });

  it("steps reports back by period", () => {
    expect(reportPeriod("daily", now, 1)).toMatchObject({ from: "2026-11-10", to: "2026-11-10" });
    expect(reportPeriod("weekly", now, 1)).toMatchObject({ from: "2026-10-31", to: "2026-11-06" });
    expect(reportPeriod("monthly", now, 1)).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(reportPeriod("monthly", new Date("2026-03-15T07:00:00Z"), 1)).toMatchObject({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("describes change, medians and durations", () => {
    expect(change(5, 3)).toBe("+2");
    expect(change(3, 5)).toBe("−2");
    expect(change(4, 4)).toBe("no change");
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(hoursText(0.5)).toBe("30 min");
    expect(hoursText(5.25)).toBe("5.3 h");
    expect(hoursText(72)).toBe("3 days");
    expect(hoursText(null)).toBe("—");
  });
});
