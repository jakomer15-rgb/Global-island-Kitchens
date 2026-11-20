import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUTOPILOT_HELD, AUTOPILOT_NOTE } from "@/lib/autopilot";
import { settingDefaults, type Settings } from "@/lib/site-settings";
import type { AiGenerate, AiRequest } from "@/server/ai/provider";
import { createStaffUser } from "@/server/auth/accounts";
import { ForbiddenError, resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { createPrismaClient } from "@/server/db/client";
import type { Env } from "@/server/env";
import { nextReference } from "@/server/enquiries/submit";
import { RuleError } from "@/server/errors";
import { decideMessage, draftNewEnquiryReplies, sendCustomerMessage } from "@/server/outreach/messages";
import { sendApprovalRequest } from "./alerts";
import { updateSetting } from "@/server/settings/update";
import { approveProspectTemplate, saveAutopilotOptions, stopAutopilot } from "./admin";
import { runProspectAutopilot } from "./prospects";
import { runSocialAutopilot } from "./social";
import { autopilotDay, autopilotSummaryEmail, queueAutopilotSummary } from "./summary";

const db = createPrismaClient();
const uid = () => Math.random().toString(36).slice(2, 10);
const phone = () => `+9733${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const env = {
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "GIK <sales@gik.example>",
  AI_PROVIDER: "mock",
  META_PAGE_ID: "123",
  META_PAGE_ACCESS_TOKEN: "token",
  NOTIFY_EMAILS: "owner@gik.example",
} as unknown as Env;
/** A day of its own far in the future, so daily limits don't see other test runs. */
const freshDay = () =>
  new Date(
    Date.UTC(
      2100 + Math.floor(Math.random() * 800),
      Math.floor(Math.random() * 12),
      1 + Math.floor(Math.random() * 28),
      9,
    ),
  );

async function staff(roleKeys: string[]): Promise<Actor> {
  const id = await db.$transaction((tx) =>
    createStaffUser(tx, {
      email: `ap-${uid()}@example.test`,
      name: `AP ${uid()}`,
      password: "a long test password",
      roleKeys,
      actorId: null,
      via: "test",
    }),
  );
  return resolveActor(await db.user.findUniqueOrThrow({ where: { id }, include: userWithRolesInclude }))!;
}

async function websiteLead() {
  const c = await db.customer.create({
    data: { name: "Noor Ali", phone: phone(), email: `n-${uid()}@example.test` },
  });
  await db.consentRecord.create({
    data: { customerId: c.id, channel: "email", granted: true, source: "website_quote" },
  });
  return db.lead.create({
    data: {
      reference: await nextReference(db, "Q"),
      customerId: c.id,
      source: "website_quote",
      summary: "Kitchen",
      status: "new",
    },
  });
}

const reply =
  (body: string, extra: Record<string, unknown> = {}): AiGenerate =>
  async () => ({
    text: JSON.stringify({ language: "en", subject: "Your kitchen enquiry", body, ...extra }),
    model: "test",
  });
const SAFE =
  "Thank you for your enquiry. Could you send the room measurements and your area? You are welcome to visit our showroom.";

async function autopilot(patch: Partial<Settings["autopilot"]>) {
  const row = await db.siteSetting.findUnique({ where: { key: "autopilot" } });
  const current = (row?.value as Settings["autopilot"] | undefined) ?? settingDefaults.autopilot;
  await updateSetting(db, owner, "autopilot", { ...current, mode: "auto", ...patch });
}

/**
 * Takes what these tests create out of the way of the other suites (approval lists, campaign audiences,
 * the outbox), including leftovers of earlier runs: test customers are "n-…@example.test", prospects
 * "AP Studio …", posts "AP post …".
 */
async function cleanUp() {
  const messages = await db.customerMessage.findMany({
    where: { customer: { email: { startsWith: "n-", endsWith: "@example.test" } } },
    select: { id: true },
  });
  const ids = messages.map((m) => m.id);
  await db.customerMessage.updateMany({
    where: { id: { in: ids }, status: { in: ["pending_approval", "approved"] } },
    data: { status: "cancelled", decidedAt: new Date(), decisionNote: "Test cleanup" },
  });
  // The failed deliveries made up for the pause test (their payload is empty).
  await db.outboxEvent.updateMany({
    where: { type: "campaign.message", status: "failed", payload: { equals: {} } },
    data: { status: "done" },
  });
  for (const id of ids)
    await db.outboxEvent.updateMany({
      where: { type: "customer.message", status: "pending", payload: { path: ["messageId"], equals: id } },
      data: { status: "done" },
    });
  const prospects = await db.prospect.findMany({
    where: { companyName: { startsWith: "AP Studio " } },
    select: { id: true },
  });
  const queued = await db.campaignMessage.findMany({
    where: { prospectId: { in: prospects.map((p) => p.id) }, status: "queued" },
    select: { id: true },
  });
  for (const m of queued)
    await db.outboxEvent.updateMany({
      where: {
        type: "campaign.message",
        status: "pending",
        payload: { path: ["campaignMessageId"], equals: m.id },
      },
      data: { status: "done" },
    });
  await db.campaignMessage.updateMany({
    where: { id: { in: queued.map((m) => m.id) } },
    data: { status: "skipped" },
  });
  await db.prospect.updateMany({
    where: { id: { in: prospects.map((p) => p.id) } },
    data: { status: "not_interested" },
  });
  await db.campaign.updateMany({
    where: { name: { startsWith: "Autopilot " }, status: "pending_approval" },
    data: { status: "cancelled" },
  });
  await db.outboxEvent.updateMany({
    where: { type: "approval.requested", status: "pending" },
    data: { status: "done" },
  });
  await db.socialPost.deleteMany({
    where: { title: { startsWith: "AP post " }, status: { not: "published" } },
  });
}

let owner: Actor;
let sales: Actor;
beforeAll(async () => {
  await cleanUp();
  process.env.AI_PROVIDER = "mock";
  [owner, sales] = await Promise.all([staff(["owner"]), staff(["sales_manager"])]);
  await updateSetting(db, owner, "autopilot", settingDefaults.autopilot);
  await updateSetting(db, owner, "ai", {
    ...settingDefaults.ai,
    enabled: true,
    leadAssistant: true,
    contentAssistant: true,
  });
});
afterAll(async () => {
  await cleanUp();
  await updateSetting(db, owner, "autopilot", settingDefaults.autopilot);
  await updateSetting(db, owner, "ai", settingDefaults.ai);
  await db.$disconnect();
});

describe("Autopilot replies", () => {
  it("sends a safe AI reply by itself and holds the rest for a person", async () => {
    await autopilot({ enabled: true, replies: true, customerEmailsPerDay: 100 });
    const now = freshDay();
    const since = new Date(Date.now() - 50);
    const safe = await websiteLead();
    await draftNewEnquiryReplies(db, { since, now, env, generate: reply(SAFE), limit: 1 });
    const sent = await db.customerMessage.findFirstOrThrow({ where: { leadId: safe.id } });
    expect(sent.status).toBe("approved");
    expect(sent.decisionNote).toBe(AUTOPILOT_NOTE);
    expect(
      await db.outboxEvent.count({
        where: { type: "customer.message", payload: { path: ["messageId"], equals: sent.id } },
      }),
    ).toBe(1);

    const sincepriced = new Date(Date.now() - 50);
    const priced = await websiteLead();
    await draftNewEnquiryReplies(db, {
      since: sincepriced,
      now,
      env,
      generate: reply("Our kitchens start from 1,500 BHD and are installed within 3 weeks."),
      limit: 1,
    });
    const held = await db.customerMessage.findFirstOrThrow({ where: { leadId: priced.id } });
    expect(held.status).toBe("pending_approval");
    expect(held.decisionNote).toContain(AUTOPILOT_HELD);
    expect(held.decisionNote).toContain("price");

    const sinceasksPerson = new Date(Date.now() - 50);
    const asksPerson = await websiteLead();
    await draftNewEnquiryReplies(db, {
      since: sinceasksPerson,
      now,
      env,
      generate: reply(SAFE, { needsPerson: true, personReason: "complaint" }),
      limit: 1,
    });
    const person = await db.customerMessage.findFirstOrThrow({ where: { leadId: asksPerson.id } });
    expect(person.status).toBe("pending_approval");
    expect(person.decisionNote).toContain("complaint");
  });

  it("stops at the daily limit", async () => {
    await autopilot({ enabled: true, replies: true, customerEmailsPerDay: 1 });
    const now = freshDay();
    const since = new Date(Date.now() - 50);
    const a = await websiteLead();
    const b = await websiteLead();
    await draftNewEnquiryReplies(db, {
      since,
      now,
      env,
      generate: reply(SAFE),
      limit: 5,
    });
    const statuses = await db.customerMessage.findMany({ where: { leadId: { in: [a.id, b.id] } } });
    expect(statuses.filter((m) => m.status === "approved")).toHaveLength(1);
    const limited = statuses.find((m) => m.status === "pending_approval")!;
    expect(limited.decisionNote).toContain("limit");
  });

  it("leaves everything for a person while Autopilot is off, and takes back what it queued when stopped", async () => {
    await autopilot({ enabled: false, customerEmailsPerDay: 100 });
    const sinceoff = new Date(Date.now() - 50);
    const off = await websiteLead();
    await draftNewEnquiryReplies(db, {
      since: sinceoff,
      now: freshDay(),
      env,
      generate: reply(SAFE),
      limit: 1,
    });
    const waiting = await db.customerMessage.findFirstOrThrow({ where: { leadId: off.id } });
    expect(waiting.status).toBe("pending_approval");
    expect(waiting.decisionNote).toBeNull();

    await autopilot({ enabled: true });
    const sincelead = new Date(Date.now() - 50);
    const lead = await websiteLead();
    await draftNewEnquiryReplies(db, {
      since: sincelead,
      now: freshDay(),
      env,
      generate: reply(SAFE),
      limit: 1,
    });
    const queued = await db.customerMessage.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(queued.status).toBe("approved");
    await expect(stopAutopilot(db, sales)).rejects.toBeInstanceOf(ForbiddenError);
    const counts = await stopAutopilot(db, owner);
    expect(counts.messages).toBeGreaterThanOrEqual(1);
    const back = await db.customerMessage.findUniqueOrThrow({ where: { id: queued.id } });
    expect(back.status).toBe("pending_approval");
    expect(back.decisionNote).toContain("stopped");
  });

  it("doesn't send an Autopilot message once Autopilot is off, and sets Reply-To on what it sends", async () => {
    await autopilot({ enabled: true, replies: true, customerEmailsPerDay: 100 });
    const sincelead = new Date(Date.now() - 50);
    const lead = await websiteLead();
    await draftNewEnquiryReplies(db, {
      since: sincelead,
      now: freshDay(),
      env,
      generate: reply(SAFE),
      limit: 1,
    });
    const m = await db.customerMessage.findFirstOrThrow({ where: { leadId: lead.id } });
    const calls: { replyTo?: string | null }[] = [];
    const send = async (_e: Env, _to: string[], _s: string, _t: string, o?: { replyTo?: string | null }) => {
      calls.push(o ?? {});
    };
    expect(await sendCustomerMessage(db, env, m.id, send)).toBe("sent");
    expect(calls[0]!.replyTo).toMatch(/@/);

    const sinceother = new Date(Date.now() - 50);
    const other = await websiteLead();
    await draftNewEnquiryReplies(db, {
      since: sinceother,
      now: freshDay(),
      env,
      generate: reply(SAFE),
      limit: 1,
    });
    const later = await db.customerMessage.findFirstOrThrow({ where: { leadId: other.id } });
    await autopilot({ enabled: false });
    expect(await sendCustomerMessage(db, env, later.id, send)).toBe("skipped");
    expect((await db.customerMessage.findUniqueOrThrow({ where: { id: later.id } })).status).toBe(
      "pending_approval",
    );
  });
});

describe("Autopilot prospect emails", () => {
  it("needs an approved, safe template and sends up to the daily limit", async () => {
    await expect(
      approveProspectTemplate(db, owner, {
        subject: "Kitchens for {company}",
        body: "We offer kitchens from 900 BHD with a 10% discount for {type} partners in {area}.",
        language: "en",
      }),
    ).rejects.toBeInstanceOf(RuleError);
    await expect(
      saveAutopilotOptions(db, owner, { ...settingDefaults.autopilot, prospectEmails: true }),
    ).rejects.toBeInstanceOf(RuleError);
    await approveProspectTemplate(db, owner, {
      subject: "Kitchens and joinery for {company}",
      body: "We manufacture kitchens, wardrobes and interior joinery in Bahrain with EGGER boards and painted MDF. Would a short call or a showroom visit be useful for your projects in {area}?",
      language: "en",
    });
    const s = (await db.siteSetting.findUniqueOrThrow({ where: { key: "autopilot" } }))
      .value as Settings["autopilot"];
    await updateSetting(db, owner, "autopilot", {
      ...s,
      mode: "auto",
      enabled: true,
      prospectEmails: true,
      prospectEmailsPerDay: 2,
      prospectPausedReason: null,
    });
    for (let i = 0; i < 3; i++)
      await db.prospect.create({
        data: {
          companyName: `AP Studio ${uid()}`,
          email: `ap-${uid()}@studio.example`,
          type: "interior_designer",
          score: 99,
        },
      });
    const now = freshDay();
    expect(await runProspectAutopilot(db, { now, env })).toEqual({ queued: 2 });
    expect(await runProspectAutopilot(db, { now, env })).toMatchObject({ queued: 0 });
    const campaign = await db.campaign.findFirstOrThrow({
      where: { decisionNote: AUTOPILOT_NOTE },
      orderBy: { createdAt: "desc" },
    });
    expect(campaign.status).toBe("approved");
    expect(campaign.name).toMatch(/^Autopilot \d{4}-\d{2}-\d{2}$/);
  });

  it("pauses itself when emails keep failing", async () => {
    const now = freshDay();
    for (let i = 0; i < 3; i++)
      await db.outboxEvent.create({
        data: {
          type: "campaign.message",
          payload: {},
          status: "failed",
          createdAt: new Date(now.getTime() - 3600_000),
        },
      });
    expect(await runProspectAutopilot(db, { now, env })).toEqual({ queued: 0, paused: 1 });
    const s = (await db.siteSetting.findUniqueOrThrow({ where: { key: "autopilot" } }))
      .value as Settings["autopilot"];
    expect(s.prospectPausedReason).toContain("could not be delivered");
    expect((await runProspectAutopilot(db, { now, env })).skipped).toBe("off");
  });
});

describe("Autopilot social media", () => {
  const plan =
    (caption: string): AiGenerate =>
    async (r: AiRequest) =>
      r.task === "social_plan"
        ? {
            text: JSON.stringify({
              ideas: [
                {
                  dayOffset: 1,
                  time: "19:00",
                  title: `AP post ${uid()}`,
                  brief: "Showroom",
                  type: "text",
                  platforms: ["facebook"],
                },
              ],
            }),
            model: "test",
          }
        : {
            text: JSON.stringify({
              captionEn: caption,
              captionAr: "تفضلوا بزيارة صالة العرض لمشاهدة تشطيبات إيجر والإم دي إف المدهون.",
              hashtags: ["Bahrain"],
            }),
            model: "test",
          };

  it("writes and schedules a safe post, and holds an unsafe one", async () => {
    await autopilot({
      enabled: true,
      social: true,
      postsPerWeek: 1,
      socialPlatforms: ["facebook"],
      socialLanguage: "both",
    });
    const now = freshDay();
    const result = await runSocialAutopilot(db, {
      now,
      env,
      generate: plan("Visit our showroom to see EGGER décors and painted MDF fronts made in Bahrain."),
    });
    expect(result).toEqual({ scheduled: 1, held: 0, forApproval: 0 });
    const post = await db.socialPost.findFirstOrThrow({
      where: { decisionNote: AUTOPILOT_NOTE, plannedAt: { gte: now } },
      include: { targets: true },
    });
    expect(post.status).toBe("scheduled");
    expect(post.targets.map((t) => [t.platform, t.status])).toEqual([["facebook", "pending"]]);
    // A week already planned: nothing more.
    expect((await runSocialAutopilot(db, { now, env, generate: plan("x") })).scheduled).toBe(0);

    const later = new Date(now.getTime() + 60 * 86_400_000);
    const unsafe = await runSocialAutopilot(db, {
      now: later,
      env,
      generate: plan("Kitchens from 1,500 BHD this month only!"),
    });
    expect(unsafe).toEqual({ scheduled: 0, held: 1, forApproval: 0 });
  });

  it("does nothing without the Meta connection", async () => {
    const noMeta = { ...env, META_PAGE_ID: undefined, META_PAGE_ACCESS_TOKEN: undefined } as unknown as Env;
    expect((await runSocialAutopilot(db, { now: freshDay(), env: noMeta })).skipped).toBe("metaOff");
  });
});

describe("Autopilot in 'ask me first' mode", () => {
  const approvalEvents = (id: string) =>
    db.outboxEvent.count({
      where: { type: "approval.requested", payload: { path: ["id"], equals: id } },
    });

  it("prepares a reply that waits for approval, emails the owner, and copies the sent email", async () => {
    await autopilot({
      enabled: true,
      replies: true,
      mode: "approve",
      approvalEmails: true,
      copyEmails: true,
    });
    const since = new Date(Date.now() - 50);
    const lead = await websiteLead();
    const result = await draftNewEnquiryReplies(db, {
      since,
      now: freshDay(),
      env,
      generate: reply(SAFE),
      limit: 1,
    });
    expect(result).toMatchObject({ drafted: 1, sentAuto: 0 });
    const m = await db.customerMessage.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(m.status).toBe("pending_approval");
    expect(m.decisionNote).toBeNull();
    expect(await approvalEvents(m.id)).toBe(1);

    const sent: { to: string[]; subject: string; text: string; bcc?: string[] }[] = [];
    const send = async (_e: Env, to: string[], subject: string, text: string, o?: { bcc?: string[] }) => {
      sent.push({ to, subject, text, bcc: o?.bcc });
    };
    expect(
      await sendApprovalRequest(db, env, { kind: "customer_message", id: m.id }, "https://site.test", send),
    ).toBe("sent");
    expect(sent[0]!.subject).toBe(`Approval needed: email to customer ${lead.reference}`);
    expect(sent[0]!.text).toContain(SAFE);
    expect(sent[0]!.text).toContain(`https://site.test/admin/leads/${lead.id}#messages`);

    // Approved by the owner: sent with a hidden copy, and the approval email is no longer needed.
    await decideMessage(db, owner, m.id, { approve: true }, env);
    expect(
      await sendApprovalRequest(db, env, { kind: "customer_message", id: m.id }, "https://site.test", send),
    ).toBe("skipped");
    expect(await sendCustomerMessage(db, env, m.id, send)).toBe("sent");
    const copy = sent.at(-1)!;
    expect(copy.bcc?.length).toBeGreaterThan(0);
    expect(copy.bcc).not.toContain(copy.to[0]);

    await autopilot({ copyEmails: false, approvalEmails: false, mode: "approve" });
    expect(
      await sendApprovalRequest(db, env, { kind: "customer_message", id: m.id }, "https://site.test", send),
    ).toBe("skipped");
  });

  it("prepares a day's prospect emails as one campaign waiting for approval", async () => {
    const s = (await db.siteSetting.findUniqueOrThrow({ where: { key: "autopilot" } }))
      .value as Settings["autopilot"];
    await updateSetting(db, owner, "autopilot", {
      ...s,
      mode: "approve",
      enabled: true,
      prospectEmails: true,
      prospectEmailsPerDay: 2,
      prospectPausedReason: null,
    });
    for (let i = 0; i < 2; i++)
      await db.prospect.create({
        data: {
          companyName: `AP Studio ${uid()}`,
          email: `ap-${uid()}@studio.example`,
          type: "interior_designer",
          score: 99,
        },
      });
    const result = await runProspectAutopilot(db, { now: freshDay(), env });
    expect(result).toEqual({ prepared: 2 });
    const c = await db.campaign.findFirstOrThrow({
      where: { name: { startsWith: "Autopilot " }, status: "pending_approval" },
      orderBy: { createdAt: "desc" },
      include: { messages: true },
    });
    expect(c.messages.map((m) => m.status)).toEqual(["draft", "draft"]);
    expect(await approvalEvents(c.id)).toBe(1);
  });

  it("prepares a social post for approval, even before Meta is connected", async () => {
    await autopilot({
      enabled: true,
      social: true,
      mode: "approve",
      postsPerWeek: 1,
      socialPlatforms: ["facebook"],
    });
    const noMeta = { ...env, META_PAGE_ID: undefined, META_PAGE_ACCESS_TOKEN: undefined } as unknown as Env;
    const now = freshDay();
    const generate: AiGenerate = async (r) =>
      r.task === "social_plan"
        ? {
            text: JSON.stringify({
              ideas: [
                {
                  dayOffset: 2,
                  time: "19:00",
                  title: `AP post ${uid()}`,
                  brief: "Showroom",
                  type: "text",
                  platforms: ["facebook"],
                },
              ],
            }),
            model: "test",
          }
        : {
            text: JSON.stringify({
              captionEn: "Visit our Bahrain showroom to see EGGER décors and painted MDF fronts.",
              captionAr: "تفضلوا بزيارة صالة العرض في البحرين.",
              hashtags: ["Bahrain"],
            }),
            model: "test",
          };
    expect(await runSocialAutopilot(db, { now, env: noMeta, generate })).toEqual({
      scheduled: 0,
      held: 0,
      forApproval: 1,
    });
    const post = await db.socialPost.findFirstOrThrow({
      where: { status: "pending_approval", plannedAt: { gte: now }, title: { startsWith: "AP post " } },
    });
    expect(post.approvedAt).toBeNull();
    expect(await approvalEvents(post.id)).toBe(1);
  });
});

describe("Autopilot morning summary", () => {
  it("is queued once a day after 07:00 and lists what happened", async () => {
    await autopilot({ enabled: true, dailySummary: true });
    const early = new Date("2091-03-05T03:00:00Z"); // 06:00 in Bahrain
    expect((await queueAutopilotSummary(db, early)).queued).toBe(0);
    const morning = new Date("2091-03-05T05:00:00Z"); // 08:00
    const first = await queueAutopilotSummary(db, morning);
    const again = await queueAutopilotSummary(db, morning);
    expect(first.queued + again.queued).toBeLessThanOrEqual(1);
    const day = await autopilotDay(db, new Date("2091-03-03T21:00:00Z"));
    const { subject, text } = autopilotSummaryEmail(day, "2091-03-04", "https://example.test");
    expect(subject).toBe("Autopilot summary: 2091-03-04");
    expect(text).toContain("First replies to new enquiries: 0");
    expect(text).toContain("https://example.test/admin/automation/autopilot");
  });
});
