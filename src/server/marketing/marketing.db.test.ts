import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createStaffUser } from "@/server/auth/accounts";
import { ForbiddenError, resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { approvalQueue } from "@/server/automation/overview";
import { createPrismaClient } from "@/server/db/client";
import type { Env } from "@/server/env";
import {
  createCampaign,
  decideCampaign,
  prepareCampaign,
  saveTemplate,
  sendCampaignMessage,
  submitCampaign,
} from "./campaigns";
import { searchPlaces } from "./places";
import {
  convertProspect,
  createProspect,
  importProspects,
  prospectUnsubscribeUrl,
  setProspectStatus,
  unsubscribeProspect,
} from "./prospects";
import { marketingReport } from "./report";

const db = createPrismaClient();
const uid = () => Math.random().toString(36).slice(2, 10);
const phone = () => `+9733${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const mailEnv = { RESEND_API_KEY: "re_test", EMAIL_FROM: "GIK <sales@gik.example>" } as unknown as Env;

async function staff(roleKeys: string[]): Promise<Actor> {
  const id = await db.$transaction((tx) =>
    createStaffUser(tx, {
      email: `s5-${uid()}@example.test`,
      name: `S5 ${uid()}`,
      password: "a long test password",
      roleKeys,
      actorId: null,
      via: "test",
    }),
  );
  return resolveActor(await db.user.findUniqueOrThrow({ where: { id }, include: userWithRolesInclude }))!;
}

let owner: Actor;
let sales: Actor;
let editor: Actor;
beforeAll(async () => {
  [owner, sales, editor] = await Promise.all([
    staff(["owner"]),
    staff(["sales_manager"]),
    staff(["content_editor"]),
  ]);
});
afterAll(() => db.$disconnect());

describe("prospects", () => {
  it("are scored when added; duplicates by email, website domain or name are refused", async () => {
    const tag = uid();
    const p = await createProspect(db, sales, {
      companyName: `Studio ${tag}`,
      type: "interior_designer",
      country: "BH",
      email: `info@studio-${tag}.example`,
      website: `www.studio-${tag}.example`,
    });
    expect(p).toMatchObject({
      score: 25 + 25 + 15 + 5,
      priority: "high",
      status: "new",
      createdById: sales.id,
    });
    await expect(
      createProspect(db, sales, {
        companyName: "Other",
        type: "other",
        country: "BH",
        email: `INFO@studio-${tag}.example`,
      }),
    ).rejects.toThrow(/Already/);
    await expect(
      createProspect(db, sales, {
        companyName: "Other 2",
        type: "other",
        country: "BH",
        website: `https://studio-${tag}.example/contact`,
      }),
    ).rejects.toThrow(/Already/);
    await expect(
      createProspect(db, sales, { companyName: `studio ${tag}`, type: "other", country: "BH" }),
    ).rejects.toThrow(/Already/);
    // Same name in another country is a different business.
    await expect(
      createProspect(db, sales, { companyName: `Studio ${tag}`, type: "other", country: "KW" }),
    ).resolves.toBeTruthy();
    await expect(
      createProspect(db, editor, { companyName: "X", type: "other", country: "BH" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("import adds valid rows and reports the rest by row number", async () => {
    const tag = uid();
    const csv = [
      "Company,Type,Email,Phone,Country,Area",
      `Dev ${tag},Real estate developer,dev@${tag}.example,,Bahrain,Juffair`,
      `Arch ${tag},Architect,,${phone()},UAE,Dubai`,
      `Dev ${tag},Developer,,,Bahrain,`,
      `Far ${tag},Architect,,,USA,`,
      `Bad ${tag},Architect,not-an-email,,Bahrain,`,
    ].join("\n");
    const r = await importProspects(db, sales, csv);
    expect(r.created).toBe(2);
    expect(r.skipped.map((s) => s.row)).toEqual([4, 5, 6]);
    expect(r.skipped[1]!.reason).toMatch(/GCC/);
    const dev = await db.prospect.findFirstOrThrow({ where: { companyName: `Dev ${tag}` } });
    expect(dev).toMatchObject({
      type: "real_estate_developer",
      country: "BH",
      area: "Juffair",
      source: "import",
    });
  });

  it("status changes rescore; converting creates a customer and a GIK-P lead", async () => {
    const tag = uid();
    const p = await createProspect(db, sales, {
      companyName: `Builder ${tag}`,
      type: "construction_company",
      country: "BH",
      phone: phone(),
      notes: "Met at exhibition",
    });
    await setProspectStatus(db, sales, p.id, "interested", "Wants a meeting");
    const after = await db.prospect.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.score).toBe(p.score + 15);
    expect(after.lastContactedAt).not.toBeNull();
    expect(after.notes).toMatch(/Wants a meeting/);
    const lead = await convertProspect(db, sales, p.id);
    expect(lead.reference).toMatch(/^GIK-P-\d{4}-\d{5,}$/);
    expect(lead.source).toBe("prospecting");
    const customer = await db.customer.findUniqueOrThrow({ where: { id: lead.customerId } });
    expect(customer).toMatchObject({ type: "contractor", company: `Builder ${tag}` });
    expect((await db.prospect.findUniqueOrThrow({ where: { id: p.id } })).convertedLeadId).toBe(lead.id);
    await expect(convertProspect(db, sales, p.id)).rejects.toThrow(/Already converted/);
  });
});

describe("campaigns", () => {
  it("reach only eligible prospects, need approval, send with an unsubscribe link, and respect unsubscribes", async () => {
    const tag = uid();
    const make = (name: string, extra: object = {}) =>
      createProspect(db, sales, {
        companyName: `${name} ${tag}`,
        type: "architect",
        country: "OM",
        email: `${name.toLowerCase()}@${tag}-${name}.example`,
        ...extra,
      });
    const a = await make("Alpha", { contactName: "Huda" });
    const b = await make("Beta");
    const noEmail = await createProspect(db, sales, {
      companyName: `NoMail ${tag}`,
      type: "architect",
      country: "OM",
    });
    const dnc = await make("Gamma");
    await setProspectStatus(db, sales, dnc.id, "do_not_contact");

    const c = await createCampaign(db, sales, {
      name: `Oman architects ${tag}`,
      brief: "Introduce our factory to architects.",
      language: "en",
      audience: { type: "architect", country: "OM" },
    });
    await expect(prepareCampaign(db, sales, c.id)).rejects.toThrow(/Write the email/);
    await saveTemplate(db, sales, c.id, {
      subjectTemplate: "Kitchens for {company}",
      bodyTemplate: "We make fitted kitchens for projects in {area}. Could we send our profile?",
    });
    const prepared = await prepareCampaign(db, sales, c.id);
    expect(prepared.prepared).toBe(2);
    const msgs = await db.campaignMessage.findMany({
      where: { campaignId: c.id },
      orderBy: { subject: "asc" },
    });
    expect(msgs.map((m) => m.prospectId).sort()).toEqual([a.id, b.id].sort());
    expect(msgs.find((m) => m.prospectId === a.id)!.subject).toBe(`Kitchens for Alpha ${tag}`);
    expect(msgs.every((m) => m.prospectId !== noEmail.id && m.prospectId !== dnc.id)).toBe(true);

    await submitCampaign(db, sales, c.id);
    expect((await approvalQueue(db, owner)).items.some((i) => i.kind === "campaign" && i.id === c.id)).toBe(
      true,
    );
    await expect(decideCampaign(db, sales, c.id, { approve: true }, mailEnv)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(decideCampaign(db, owner, c.id, { approve: true }, {} as Env)).rejects.toThrow(
      /isn't set up/,
    );

    // Beta unsubscribes (from an earlier email) before approval: dropped at approval.
    const token = decodeURIComponent(prospectUnsubscribeUrl(b.id).split("token=")[1]!);
    expect(await unsubscribeProspect(db, token, null)).toBe(true);
    expect((await db.prospect.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("do_not_contact");

    const decided = await decideCampaign(db, owner, c.id, { approve: true }, mailEnv);
    expect(decided.queued).toBe(1);
    expect(
      await db.outboxEvent.count({
        where: { type: "campaign.message", payload: { path: ["campaignId"], equals: c.id } },
      }),
    ).toBe(1);

    const send = vi.fn(async () => {});
    const alpha = msgs.find((m) => m.prospectId === a.id)!;
    expect(await sendCampaignMessage(db, mailEnv as Env, alpha.id, send)).toBe("sent");
    const [, to, , text] = send.mock.calls[0] as unknown as [Env, string[], string, string];
    expect(to).toEqual([a.email]);
    expect(text).toMatch(/^Dear Huda,\n\nWe make fitted kitchens for projects in Oman\./);
    expect(text).toContain("unsubscribe?token=prospect.");
    expect((await db.prospect.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("contacted");
    expect((await db.campaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("sent");
    // Sent emails are final; a second campaign within 30 days doesn't reach Alpha again.
    await expect(
      db.campaignMessage.update({ where: { id: alpha.id }, data: { body: "changed" } }),
    ).rejects.toThrow();
    const c2 = await createCampaign(db, sales, {
      name: `Again ${tag}`,
      brief: "Follow up with architects.",
      language: "en",
      audience: { type: "architect", country: "OM", status: "contacted" },
    });
    await saveTemplate(db, sales, c2.id, {
      subjectTemplate: "Again",
      bodyTemplate: "Following up on our earlier email to you.",
    });
    await expect(prepareCampaign(db, sales, c2.id)).rejects.toThrow(/No prospect/);
  });
});

describe("Google Places search", () => {
  it("needs a key; marks results already in the list", async () => {
    await expect(
      searchPlaces(db, sales, { query: "interior design", country: "BH" }, { env: {} as Env }),
    ).rejects.toThrow(/isn't connected/);
    const tag = uid();
    await createProspect(db, sales, {
      companyName: `Known ${tag}`,
      type: "interior_designer",
      country: "BH",
      placeId: `place-${tag}`,
      source: "google_places",
    });
    const f = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            places: [
              {
                id: `place-${tag}`,
                displayName: { text: `Known ${tag}` },
                formattedAddress: "Seef, Bahrain",
                types: ["interior_designer"],
              },
              {
                id: `new-${tag}`,
                displayName: { text: "New Studio" },
                formattedAddress: "Road 1, Adliya, Bahrain",
                googleMapsUri: "https://maps.google.com/?cid=1",
              },
            ],
          }),
        ),
    ) as unknown as typeof fetch;
    const results = await searchPlaces(
      db,
      sales,
      { query: "interior design", country: "BH" },
      { env: { GOOGLE_PLACES_API_KEY: "AIza-test-key-0000000000" } as Env, fetch: f },
    );
    expect(results[0]!.prospectId).not.toBeNull();
    expect(results[1]).toMatchObject({
      prospectId: null,
      name: "New Studio",
      mapsUrl: "https://maps.google.com/?cid=1",
    });
  });
});

describe("report", () => {
  it("counts this period from the database", async () => {
    const before = await marketingReport(db, sales, "day");
    await createProspect(db, sales, { companyName: `Report ${uid()}`, type: "other", country: "BH" });
    const after = await marketingReport(db, sales, "day");
    expect(after.thisPeriod.added).toBe(before.thisPeriod.added + 1);
    await expect(marketingReport(db, editor, "week")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
