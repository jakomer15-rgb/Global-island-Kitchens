import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { settingDefaults } from "@/lib/site-settings";
import { createStaffUser } from "@/server/auth/accounts";
import { ForbiddenError, resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { AiError, type AiGenerate, type AiRequest } from "@/server/ai/provider";
import { createPrismaClient } from "@/server/db/client";
import type { Env } from "@/server/env";
import { updateSetting } from "@/server/settings/update";
import { askAnalytics } from "./ask";
import { buildReport, queueDueReports, reportEmail, sendReportEmail } from "./report";

const db = createPrismaClient();
const uid = () => Math.random().toString(36).slice(2, 10);
const rand = (n: number) => Math.floor(Math.random() * n);
const HOUR = 3_600_000;

// A random Wednesday long ago, so this test's figures never mix with other tests' data.
const anchor = (() => {
  const d = new Date(Date.UTC(1995 + rand(20), rand(12), 10, 7));
  d.setUTCDate(d.getUTCDate() + ((3 - d.getUTCDay() + 7) % 7));
  return d;
})();
const weekStart = (() => {
  const d = new Date(anchor.getTime());
  d.setUTCDate(d.getUTCDate() - 4); // Saturday
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - 3 * HOUR); // midnight in Bahrain
})();
const at = (dayOfWeek: number, hour: number) =>
  new Date(weekStart.getTime() + dayOfWeek * 24 * HOUR + hour * HOUR);

async function staff(roleKeys: string[]): Promise<Actor> {
  const id = await db.$transaction((tx) =>
    createStaffUser(tx, {
      email: `s7-${uid()}@example.test`,
      name: `S7 ${uid()}`,
      password: "a long test password",
      roleKeys,
      actorId: null,
      via: "test",
    }),
  );
  return resolveActor(await db.user.findUniqueOrThrow({ where: { id }, include: userWithRolesInclude }))!;
}

const SECRET_NAME = `Mariam Confidential ${uid()}`;
const ref = () => `GIK-T-2020-${String(1_000_000 + rand(8_999_999))}`;

async function lead(created: Date, data: Record<string, unknown>) {
  const customer = await db.customer.create({
    data: { name: SECRET_NAME, phone: `+9733${String(rand(1e7)).padStart(7, "0")}`, createdAt: created },
  });
  return db.lead.create({
    data: {
      reference: ref(),
      customerId: customer.id,
      summary: "Test enquiry",
      createdAt: created,
      source: "other",
      ...data,
    },
  });
}

let owner: Actor;
let sales: Actor;
let supervisor: Actor;
let refs: { hot: string; followUp: string };
beforeAll(async () => {
  process.env.AI_PROVIDER = "mock";
  [owner, sales, supervisor] = await Promise.all([
    staff(["owner"]),
    staff(["sales_manager"]),
    staff(["production_supervisor"]),
  ]);
  // This week: three enquiries; the week before: one.
  const hot = await lead(at(0, 9), { source: "website_chat", temperature: "hot", status: "won" });
  await lead(at(1, 9), {
    source: "website_chat",
    temperature: "warm",
    status: "lost",
    lostReason: "Chose another supplier",
  });
  const cold = await lead(at(2, 9), { source: "whatsapp", temperature: "cold", category: "woodenKitchens" });
  await lead(new Date(weekStart.getTime() - 2 * 24 * HOUR), { source: "phone" });
  // Staff called the hot lead 2 hours after it came in; the others weren't contacted.
  await db.leadActivity.create({
    data: { leadId: hot.id, kind: "call", body: "Called", authorId: owner.id, createdAt: at(0, 11) },
  });
  // Due on the Sunday of that week: overdue both then and now.
  await db.followUp.create({ data: { leadId: cold.id, dueAt: at(1, 12) } });
  refs = { hot: hot.reference, followUp: cold.reference };
  await updateSetting(db, owner, "ai", {
    enabled: true,
    leadAssistant: true,
    contentAssistant: true,
    furnitureAssistant: false,
  });
});
afterAll(async () => {
  await updateSetting(db, owner, "analyticsReports", settingDefaults.analyticsReports);
  await db.$disconnect();
});

describe("business reports", () => {
  it("counts the brief's figures from the database, with the previous period", async () => {
    const r = await buildReport(db, "weekly", new Date(), 0, anchor);
    expect(r.current).toMatchObject({
      inquiries: 3,
      newCustomers: 3,
      hotLeads: 1,
      warmLeads: 1,
      coldLeads: 1,
      conversion: { won: 1, lost: 1, open: 1, winRatePercent: 50 },
      responseTime: { enquiries: 3, contacted: 1, medianHours: 2, within24h: 1, notYetContacted: 2 },
    });
    expect(r.previous.inquiries).toBe(1);
    expect(r.sources.rows).toEqual([
      { source: "Website chat (AI assistant)", leads: 2 },
      { source: "WhatsApp", leads: 1 },
    ]);
    expect(r.productsAsked.rows).toContainEqual({ product: "Customised wooden kitchens", leads: 1 });
    expect(r.followUps.rows.some((x) => x.lead === refs.followUp && x.overdue)).toBe(true);
    // Figures only: no customer names in the report or its email.
    const email = reportEmail(r, "https://gik.example");
    expect(JSON.stringify(r)).not.toContain(SECRET_NAME);
    expect(email.text).not.toContain(SECRET_NAME);
    expect(email.text).toContain("Total enquiries: 3 (+2 vs previous)");
  });

  it("emails each switched-on report once per period", async () => {
    const now = new Date(anchor.getTime() + 7 * 24 * HOUR); // the next Wednesday
    expect((await queueDueReports(db, now)).queued).toBe(0); // all off
    await expect(
      updateSetting(db, sales, "analyticsReports", { daily: true, weekly: true, monthly: false, emails: [] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await updateSetting(db, owner, "analyticsReports", {
      daily: true,
      weekly: true,
      monthly: false,
      emails: ["owner@gik.example"],
    });
    expect((await queueDueReports(db, now)).queued).toBe(2);
    expect((await queueDueReports(db, now)).queued).toBe(0);

    const sent: { to: string[]; subject: string; text: string }[] = [];
    const e = { RESEND_API_KEY: "re_test", EMAIL_FROM: "GIK <reports@gik.example>" } as unknown as Env;
    const result = await sendReportEmail(
      db,
      e,
      "weekly",
      weekStart.toISOString(),
      "https://gik.example",
      async (_e, to, subject, text) => {
        sent.push({ to, subject, text });
      },
    );
    expect(result).toBe("sent");
    expect(sent[0]!.to).toEqual(["owner@gik.example"]);
    expect(sent[0]!.text).toContain("Total enquiries: 3");
    expect(await sendReportEmail(db, {} as Env, "weekly", weekStart.toISOString(), "x")).toBe(
      "not_configured",
    );
  });
});

describe("management questions", () => {
  function fake(plan: object, answer = "Website chat brought the most leads (2).") {
    const calls: AiRequest[] = [];
    const generate: AiGenerate = async (req) => {
      calls.push(req);
      return { text: JSON.stringify(req.task === "analytics_plan" ? plan : { answer }), model: "test" };
    };
    return { calls, generate };
  }

  it("answers from the queries it chose, and keeps the figures used", async () => {
    const { calls, generate } = fake({
      queries: [{ name: "leads_by_source", period: "this_week" }, { name: "follow_ups_due" }],
    });
    const q = await askAnalytics(
      db,
      sales,
      { question: "Which channel brought the most leads this week?" },
      generate,
      anchor,
    );
    expect(calls.map((c) => c.task)).toEqual(["analytics_plan", "analytics_answer"]);
    expect(calls[1]!.user).toContain("Website chat (AI assistant)");
    expect(calls[1]!.user).toContain(refs.followUp);
    // The AI never receives customer names or phone numbers.
    expect(calls.map((c) => c.user).join(" ")).not.toContain(SECRET_NAME);
    expect(calls[1]!.user).not.toMatch(/\+9733\d{7}/);
    expect(q).toMatchObject({ answer: "Website chat brought the most leads (2).", askedById: sales.id });
    expect(q.queries).toEqual([{ name: "leads_by_source", period: "this_week" }, { name: "follow_ups_due" }]);
    const results = q.results as { query: string; rows?: unknown[] }[];
    expect(results[0]).toMatchObject({ query: "leads_by_source", total: 3 });
  });

  it("says it can't answer what the system doesn't record, without a second AI call", async () => {
    const { calls, generate } = fake({ queries: [], cannotAnswer: "No weather data." });
    const q = await askAnalytics(db, owner, { question: "Will it rain tomorrow?" }, generate, anchor);
    expect(calls).toHaveLength(1);
    expect(q.answer).toMatch(/can't answer it from the figures/);
  });

  it("refuses queries outside the catalogue and people without the permission", async () => {
    const { generate } = fake({ queries: [{ name: "drop_table" }] });
    await expect(
      askAnalytics(db, owner, { question: "Delete everything" }, generate, anchor),
    ).rejects.toBeInstanceOf(AiError);
    await expect(
      askAnalytics(db, supervisor, { question: "How many leads?" }, generate, anchor),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("is unavailable while the AI assistant is off", async () => {
    await updateSetting(db, owner, "ai", { ...settingDefaults.ai, enabled: false });
    try {
      await expect(
        askAnalytics(db, owner, { question: "How many leads?" }, fake({}).generate),
      ).rejects.toThrow(/switched off/);
    } finally {
      await updateSetting(db, owner, "ai", {
        enabled: true,
        leadAssistant: true,
        contentAssistant: true,
        furnitureAssistant: false,
      });
    }
  });
});
