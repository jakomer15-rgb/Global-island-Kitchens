import { describe, expect, it } from "vitest";
import { designerProgress } from "./designer";
import { leadScore, leadScoreParts, scoreBand } from "./lead-score";

const base = { category: null, requirements: null, measured: false, area: null };

describe("lead score", () => {
  it("adds rating, stage and known requirements, capped at 100", () => {
    expect(leadScore({ ...base, status: "new", temperature: null })).toBe(0);
    expect(leadScore({ ...base, status: "contacted", temperature: "cold" })).toBe(15);
    expect(
      leadScore({
        status: "negotiation",
        temperature: "hot",
        category: "woodenKitchens",
        requirements: { dimensions: "3m", budget: "4k", timeline: "May", location: "Riffa" },
        measured: false,
        area: null,
      }),
    ).toBe(100);
  });
  it("ignores blank requirement text and counts quotation-request measurements and area", () => {
    expect(
      leadScore({
        ...base,
        status: "new",
        temperature: null,
        requirements: { budget: "   ", dimensions: "" },
      }),
    ).toBe(0);
    expect(leadScore({ ...base, status: "new", temperature: null, measured: true, area: "Saar" })).toBe(15);
  });
  it("has no score once won or lost", () => {
    expect(leadScoreParts({ ...base, status: "won", temperature: "hot" })).toBeNull();
    expect(leadScore({ ...base, status: "lost", temperature: "hot" })).toBeNull();
  });
  it("explains each part with its maximum", () => {
    const parts = leadScoreParts({ ...base, status: "site_visit", temperature: "warm" })!;
    expect(parts.find((p) => p.key === "stage")).toMatchObject({ points: 15, max: 25 });
    expect(parts.reduce((s, p) => s + p.max, 0)).toBe(105);
  });
  it("bands scores", () => {
    expect(scoreBand(null)).toBeNull();
    expect(scoreBand(10)).toBe("low");
    expect(scoreBand(30)).toBe("medium");
    expect(scoreBand(60)).toBe("high");
  });
});

describe("designer progress with the new pipeline stages", () => {
  it("shows negotiation as quotation ready and site visits as in review", () => {
    expect(designerProgress({ leadStatus: "negotiation", projectStage: null })).toBe("quotation_ready");
    expect(designerProgress({ leadStatus: "site_visit", projectStage: null })).toBe("in_review");
    expect(designerProgress({ leadStatus: "measurement", projectStage: null })).toBe("in_review");
  });
});
