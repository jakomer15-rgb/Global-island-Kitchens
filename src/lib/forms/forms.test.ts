import { describe, expect, it } from "vitest";
import { looksLikeBot, MIN_FILL_MS } from "./common";
import { bahrainToday, consultationSchema } from "./consultation";
import { contactSchema } from "./contact";
import { quoteRequestSchema, quoteStepSchemas } from "./quote";
import { normalisePhone } from "@/lib/phone";

const consent = { consentEmail: false, consentWhatsapp: false, privacyAccepted: true };
const traps = { website: "", startedAt: Date.now() - 60_000, locale: "en" };

describe("normalisePhone", () => {
  it.each([
    ["3459 7636", "+97334597636"],
    ["7790-1988", "+97377901988"],
    ["+973 3459 7636", "+97334597636"],
    ["0097334597636", "+97334597636"],
    ["٣٤٥٩٧٦٣٦", "+97334597636"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("normalises %s", (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  it.each(["", "123", "+973 1234", "abc", "+9733459763612"])("rejects %s", (input) => {
    expect(normalisePhone(input)).toBeNull();
  });
});

describe("quote request", () => {
  const valid = {
    ...traps,
    category: "wardrobes",
    unit: "cm",
    walls: [{ label: "Left wall", width: "320", height: "270" }],
    noMeasurements: false,
    boards: ["egger", "mdf"],
    files: [],
    name: "Test Customer",
    phone: "3459 7636",
    customerType: "homeowner",
    ...consent,
  };

  it("accepts a complete request and normalises values", () => {
    const r = quoteRequestSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBe("+97334597636");
      expect(r.data.walls[0]).toMatchObject({ width: 320, height: 270 });
    }
  });

  it("needs a width unless the customer has no measurements yet", () => {
    const step = quoteStepSchemas.measurements;
    expect(step.safeParse({ unit: "cm", walls: [{}], noMeasurements: false }).error?.issues[0]?.message).toBe(
      "measureNeeded",
    );
    expect(step.safeParse({ unit: "cm", walls: [{}], noMeasurements: true }).success).toBe(true);
  });

  it("rejects impossible sizes for the unit", () => {
    const step = quoteStepSchemas.measurements;
    expect(step.safeParse({ unit: "m", walls: [{ width: 400 }], noMeasurements: false }).success).toBe(false);
    expect(step.safeParse({ unit: "cm", walls: [{ width: -5 }], noMeasurements: false }).success).toBe(false);
  });

  it("only offers the approved materials", () => {
    expect(quoteStepSchemas.materials.safeParse({ boards: ["veneer"] }).success).toBe(false);
    expect(quoteStepSchemas.materials.safeParse({ boards: [] }).error?.issues[0]?.message).toBe("boards");
  });

  it("requires the privacy acknowledgement but not marketing consent", () => {
    expect(quoteRequestSchema.safeParse({ ...valid, privacyAccepted: false }).success).toBe(false);
    expect(
      quoteRequestSchema.safeParse({ ...valid, consentEmail: false, consentWhatsapp: false }).success,
    ).toBe(true);
  });

  it("limits attachments to 8", () => {
    const files = Array.from({ length: 9 }, (_, i) => ({ id: `file_${i}_abcdefgh`, ticket: "t".repeat(32) }));
    expect(quoteStepSchemas.files.safeParse({ files }).success).toBe(false);
  });
});

describe("consultation", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  const base = {
    ...traps,
    type: "showroom",
    preferredSlot: "morning",
    name: "Test",
    phone: "34597636",
    ...consent,
  };

  it("accepts dates from today to six months ahead (Bahrain time)", () => {
    const schema = consultationSchema(now);
    expect(bahrainToday(now)).toBe("2026-10-25");
    expect(schema.safeParse({ ...base, preferredDate: "2026-10-25" }).success).toBe(true);
    expect(schema.safeParse({ ...base, preferredDate: "2026-10-24" }).success).toBe(false);
    expect(schema.safeParse({ ...base, preferredDate: "2027-06-01" }).success).toBe(false);
  });

  it("needs an area for site visits", () => {
    const schema = consultationSchema(now);
    const r = schema.safeParse({ ...base, type: "site_visit", preferredDate: "2026-11-01" });
    expect(r.error?.issues[0]).toMatchObject({ message: "areaNeeded", path: ["area"] });
  });
});

describe("contact", () => {
  const base = { ...traps, name: "Test", message: "Hello, I would like to ask about a kitchen.", ...consent };
  it("reports every problem at once, including the phone-or-email rule", () => {
    const paths = contactSchema
      .safeParse({ ...traps, ...consent, name: "", message: "" })
      .error!.issues.map((i) => i.message);
    expect(paths).toEqual(expect.arrayContaining(["name", "messageShort", "phoneOrEmail"]));
  });

  it("needs a phone or an email", () => {
    expect(contactSchema.safeParse(base).error?.issues[0]?.message).toBe("phoneOrEmail");
    expect(contactSchema.safeParse({ ...base, email: "Test@Example.com" }).data?.email).toBe(
      "test@example.com",
    );
    expect(contactSchema.safeParse({ ...base, phone: "34597636" }).success).toBe(true);
  });
});

describe("spam traps", () => {
  it("flags filled honeypots and implausibly fast submissions", () => {
    const now = 1_000_000;
    expect(looksLikeBot({ website: "x", startedAt: now - 60_000 }, now)).toBe(true);
    expect(looksLikeBot({ startedAt: now - MIN_FILL_MS + 1 }, now)).toBe(true);
    expect(looksLikeBot({ startedAt: now - 60_000 }, now)).toBe(false);
  });
});
