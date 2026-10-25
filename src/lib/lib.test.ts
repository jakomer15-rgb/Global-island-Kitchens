import { describe, expect, it } from "vitest";
import { alternates, localizedPath } from "./seo";
import { organizationJsonLd } from "./structured-data";

describe("seo", () => {
  it("keeps English unprefixed and puts Arabic under /ar", () => {
    expect(localizedPath("/", "en")).toBe("/");
    expect(localizedPath("/", "ar")).toBe("/ar");
    expect(localizedPath("/wardrobes", "ar")).toBe("/ar/wardrobes");
  });

  it("emits canonical and hreflang alternates", () => {
    expect(alternates("/", "ar")).toEqual({
      canonical: "/ar",
      languages: { "en-BH": "/", "ar-BH": "/ar", "x-default": "/" },
    });
  });
});

describe("structured data", () => {
  it("uses only verified facts and no review markup", () => {
    const json = JSON.stringify(organizationJsonLd("en"));
    expect(json).toContain("Global Island Kitchens W.L.L");
    expect(json).toContain("Al-Hamalah");
    expect(json).not.toMatch(/Review|AggregateRating|openingHours|geo/);
  });
});
