import { describe, expect, it } from "vitest";
import {
  autoPublishable,
  bahrainDateTime,
  bahrainDay,
  bahrainTime,
  calendarDays,
  composeCaption,
  engagementTotal,
  missingForApproval,
  normaliseHashtags,
  shiftAnchor,
} from "./social";

describe("social media rules", () => {
  it("publishes automatically only what the APIs support", () => {
    expect(autoPublishable("facebook", "image")).toBe(true);
    expect(autoPublishable("facebook", "text")).toBe(true);
    expect(autoPublishable("facebook", "reel")).toBe(false);
    expect(autoPublishable("instagram", "image")).toBe(true);
    expect(autoPublishable("instagram", "story")).toBe(true);
    expect(autoPublishable("instagram", "text")).toBe(false);
    expect(autoPublishable("linkedin", "image")).toBe(false);
    expect(autoPublishable("tiktok", "reel")).toBe(false);
  });

  it("cleans hashtags: no #, no duplicates, Arabic kept, at most 30", () => {
    expect(normaliseHashtags("#Kitchen, kitchen  #مطابخ_البحرين bad-tag ##EGGER")).toEqual([
      "Kitchen",
      "مطابخ_البحرين",
      "EGGER",
    ]);
    expect(normaliseHashtags(Array.from({ length: 40 }, (_, i) => `t${i}`))).toHaveLength(30);
  });

  it("puts Arabic first, then English, then hashtags", () => {
    const p = { language: "both" as const, captionEn: "Hello", captionAr: "مرحبا", hashtags: ["GIK"] };
    expect(composeCaption(p)).toBe("مرحبا\n\nHello\n\n#GIK");
    expect(composeCaption({ ...p, language: "en" })).toBe("Hello\n\n#GIK");
  });

  it("lists what is missing before approval", () => {
    const base = {
      type: "image" as const,
      platforms: ["instagram" as const],
      language: "both" as const,
      captionEn: "Text",
      captionAr: null,
      hashtags: [],
      imageFileId: null,
    };
    expect(missingForApproval(base)).toEqual(["Write the Arabic caption.", "Choose the photo."]);
    expect(missingForApproval({ ...base, type: "text", language: "en" })).toEqual([]);
    expect(
      missingForApproval({ ...base, type: "text", language: "en", captionEn: "x".repeat(2300) }),
    ).toEqual(["The caption with hashtags is longer than 2,200 characters."]);
  });

  it("works in Bahrain time (UTC+3)", () => {
    const at = bahrainDateTime("2026-11-14", "19:00")!;
    expect(at.toISOString()).toBe("2026-11-14T16:00:00.000Z");
    expect(bahrainDay(at)).toBe("2026-11-14");
    expect(bahrainTime(at)).toBe("19:00");
    expect(bahrainDay(new Date("2026-11-14T22:30:00Z"))).toBe("2026-11-15");
    expect(bahrainDateTime("2026-11-14", "25:00")).toBeNull();
  });

  it("builds weeks from Saturday and whole-week months", () => {
    // 2026-11-11 is a Wednesday; its week starts Saturday 2026-11-07.
    const week = calendarDays("week", "2026-11-11");
    expect(week.days[0]).toBe("2026-11-07");
    expect(week.days).toHaveLength(7);
    expect(week.start.toISOString()).toBe("2026-11-06T21:00:00.000Z");
    const month = calendarDays("month", "2026-11-11");
    expect(month.days[0]).toBe("2026-10-31"); // Saturday before 1 November (a Sunday)
    expect(month.days.length % 7).toBe(0);
    expect(month.days).toContain("2026-11-30");
    expect(shiftAnchor("month", "2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftAnchor("week", "2026-11-11", -1)).toBe("2026-11-04");
  });

  it("adds up engagement, unknown as zero", () => {
    expect(engagementTotal({ likes: 10, comments: null, shares: 2 })).toBe(12);
  });
});
