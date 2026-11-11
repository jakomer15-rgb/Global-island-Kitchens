import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { prospectScore } from "@/lib/prospect-score";
import { composeProspectEmail, fillTemplate } from "./campaigns";
import { areaFromAddress, PLACES_FIELDS, placesRequest } from "./places";
import {
  normaliseProspect,
  normaliseWebsite,
  prospectUnsubscribeUrl,
  readProspectToken,
  websiteDomain,
} from "./prospects";
import { reportPeriod } from "./report";

describe("CSV import reader", () => {
  it("reads quotes, doubled quotes, line breaks in quotes, a BOM and semicolons", () => {
    expect(parseCsv('﻿Company,Notes\n"Studio, A","Says ""hi""\nsecond line"\n\n')).toEqual([
      ["Company", "Notes"],
      ["Studio, A", 'Says "hi"\nsecond line'],
    ]);
    expect(parseCsv("Company;Email\r\nB Co;b@b.example")).toEqual([
      ["Company", "Email"],
      ["B Co", "b@b.example"],
    ]);
  });
});

describe("prospect score", () => {
  it("weights fit, Bahrain, contact details and response", () => {
    expect(
      prospectScore({
        type: "real_estate_developer",
        country: "BH",
        email: "a@b.c",
        phone: "+97333000000",
        website: "https://x.bh",
        status: "interested",
      }),
    ).toEqual({
      score: 100,
      priority: "high",
    });
    expect(
      prospectScore({ type: "other", country: "SA", email: null, phone: null, website: null, status: "new" }),
    ).toEqual({ score: 15, priority: "low" });
    expect(
      prospectScore({
        type: "interior_designer",
        country: "BH",
        email: "a@b.c",
        phone: null,
        website: null,
        status: "new",
      }),
    ).toEqual({ score: 65, priority: "high" });
    expect(
      prospectScore({
        type: "architect",
        country: "BH",
        email: "a@b.c",
        phone: null,
        website: null,
        status: "do_not_contact",
      }).score,
    ).toBe(0);
  });
});

describe("prospect details", () => {
  it("normalises websites, emails and phones, and refuses bad ones", () => {
    expect(normaliseWebsite("www.studio.bh/")).toBe("https://www.studio.bh");
    expect(normaliseWebsite("not a site")).toBeNull();
    expect(websiteDomain("https://www.studio.bh/about")).toBe("studio.bh");
    const p = normaliseProspect({
      companyName: "  Studio   A ",
      type: "architect",
      country: "BH",
      email: "Info@Studio.BH",
      phone: "3300 1122",
      website: "studio.bh",
    });
    expect(p).toMatchObject({
      companyName: "Studio A",
      email: "info@studio.bh",
      phone: "+97333001122",
      website: "https://studio.bh",
    });
    expect(() =>
      normaliseProspect({ companyName: "X Co", type: "architect", country: "US", email: null }),
    ).toThrow(/GCC/);
    expect(() =>
      normaliseProspect({ companyName: "X Co", type: "architect", country: "BH", email: "nope" }),
    ).toThrow(/email/);
  });

  it("signs unsubscribe links that can't be forged", () => {
    const url = prospectUnsubscribeUrl("cprospect1", "https://example.test");
    const token = decodeURIComponent(url.split("token=")[1]!);
    expect(readProspectToken(token)).toBe("cprospect1");
    expect(readProspectToken(token.replace("cprospect1", "cprospect2"))).toBeNull();
    expect(readProspectToken("email.c1.abc")).toBeNull();
  });
});

describe("campaign emails", () => {
  const p = { companyName: "Studio A", contactName: null, area: "Seef", type: "interior_designer" };
  it("fill placeholders, with natural fall-backs", () => {
    expect(fillTemplate("Hello {contact} at {company} in {area}, a fellow {type}. {unknown}", p, "en")).toBe(
      "Hello Studio A team at Studio A in Seef, a fellow interior designer. {unknown}",
    );
    expect(fillTemplate("{area}", { ...p, area: null }, "ar")).toBe("البحرين");
    expect(fillTemplate("{area}", { ...p, area: null, country: "OM" }, "en")).toBe("Oman");
    expect(fillTemplate("{area}", { ...p, area: null, country: "KW" }, "ar")).toBe("الكويت");
  });
  it("say who sent them and why, with an unsubscribe link", () => {
    const text = composeProspectEmail(
      "We make kitchens.",
      { id: "cp1", companyName: "Studio A", contactName: "Sara" },
      "en",
      "https://example.test",
    );
    expect(text.startsWith("Dear Sara,\n\nWe make kitchens.")).toBe(true);
    expect(text).toContain("Global Island Kitchens W.L.L, Kingdom of Bahrain");
    expect(text).toMatch(/published as a business contact/);
    expect(text).toMatch(/https:\/\/example\.test\/unsubscribe\?token=prospect\.cp1\./);
  });
});

describe("Google Places", () => {
  it("asks only for the fields kept (name, address, types, id, map link)", () => {
    const { url, init } = placesRequest("key", "interior design studio", "BH");
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(init.headers["x-goog-fieldmask"]).toBe(PLACES_FIELDS);
    expect(PLACES_FIELDS).not.toMatch(/phone|website|email/i);
    expect(JSON.parse(init.body)).toMatchObject({
      textQuery: "interior design studio in Bahrain",
      regionCode: "BH",
    });
  });
  it("takes the area from an address", () => {
    expect(areaFromAddress("Building 2253B, Road 90, Block 1014, Al-Hamalah, Bahrain")).toBe("Al-Hamalah");
    expect(areaFromAddress("Bahrain")).toBeNull();
  });
});

describe("report periods (Bahrain time)", () => {
  it("weeks start on Saturday", () => {
    // Wednesday 11 November 2026, 10:00 in Bahrain.
    const w = reportPeriod("week", new Date("2026-11-11T07:00:00Z"));
    expect(w.start.toISOString()).toBe("2026-11-06T21:00:00.000Z"); // Saturday 7 Nov, 00:00 Bahrain
    expect(w.end.toISOString()).toBe("2026-11-13T21:00:00.000Z");
    const d = reportPeriod("day", new Date("2026-11-11T07:00:00Z"), 1);
    expect(d.start.toISOString()).toBe("2026-11-09T21:00:00.000Z");
  });
});
