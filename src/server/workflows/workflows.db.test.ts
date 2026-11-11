import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contactSchema } from "@/lib/forms/contact";
import { settingDefaults } from "@/lib/site-settings";
import { createStaffUser } from "@/server/auth/accounts";
import { ForbiddenError, resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { createPrismaClient } from "@/server/db/client";
import { submitContact } from "@/server/enquiries/submit";
import type { Env } from "@/server/env";
import { updateSetting } from "@/server/settings/update";
import { sendReportEmail } from "@/server/analytics/report";
import { QUALIFIED_NOTE } from "./tasks";
import {
  didWork,
  runDueWorkflows,
  runWorkflow,
  runWorkflowNow,
  setWorkflow,
  workflowOverview,
  workflows,
} from "./registry";

const db = createPrismaClient();
const uid = () => Math.random().toString(36).slice(2, 10);
const digits = () => String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
const mailEnv = {
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "GIK <sales@gik.example>",
  AI_PROVIDER: "mock",
  WHATSAPP_GRAPH_VERSION: "v21.0",
  META_GRAPH_VERSION: "v21.0",
} as unknown as Env;

async function staff(roleKeys: string[]): Promise<Actor> {
  const id = await db.$transaction((tx) =>
    createStaffUser(tx, {
      email: `s8-${uid()}@example.test`,
      name: `S8 ${uid()}`,
      password: "a long test password",
      roleKeys,
      actorId: null,
      via: "test",
    }),
  );
  return resolveActor(await db.user.findUniqueOrThrow({ where: { id }, include: userWithRolesInclude }))!;
}

async function enquiry(consentEmail: boolean) {
  const { reference } = await submitContact(
    db,
    contactSchema.parse({
      website: "",
      startedAt: Date.now() - 60_000,
      locale: "en",
      consentEmail,
      consentWhatsapp: false,
      privacyAccepted: true,
      name: "Workflow Customer",
      phone: `3${digits()}`,
      email: `wf-${uid()}@example.test`,
      message: "Kitchen for a new villa in Riffa.",
    }),
    { ipHash: null },
  );
  return db.lead.findUniqueOrThrow({ where: { reference } });
}

let owner: Actor;
let sales: Actor;
beforeAll(async () => {
  process.env.AI_PROVIDER = "mock";
  [owner, sales] = await Promise.all([staff(["owner"]), staff(["sales_manager"])]);
  await updateSetting(db, owner, "ai", {
    enabled: true,
    leadAssistant: true,
    contentAssistant: true,
    furnitureAssistant: false,
  });
});
afterAll(async () => {
  for (const key of [
    "website_enquiry_reply",
    "qualified_follow_up",
    "project_photo_social",
    "weekly_campaign_report",
  ])
    await setWorkflow(db, owner, key, { enabled: false });
  await setWorkflow(db, owner, "approved_post_publishing", { enabled: true });
  await updateSetting(db, owner, "salesFollowUp", settingDefaults.salesFollowUp);
  await updateSetting(db, owner, "analyticsReports", settingDefaults.analyticsReports);
  await db.$disconnect();
});

describe("workflow registry", () => {
  it("has the brief's nine workflows, each with steps", async () => {
    expect(workflows).toHaveLength(9);
    const list = await workflowOverview(db, sales, mailEnv);
    expect(list.map((w) => w.key)).toEqual(workflows.map((w) => w.key));
    expect(list.find((w) => w.key === "whatsapp_enquiry")).toMatchObject({
      switchable: false,
      notBuilt: expect.stringMatching(/Stage 4/),
    });
    expect(list.find((w) => w.key === "approved_post_publishing")!.enabled).toBe(true); // on by default, as before
    expect(list.find((w) => w.key === "qualified_follow_up")!.enabled).toBe(false);
  });

  it("only the owner and general manager change workflows", async () => {
    await expect(setWorkflow(db, sales, "qualified_follow_up", { enabled: true })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(runWorkflowNow(db, sales, "qualified_follow_up")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setWorkflow(db, owner, "new_lead_alert", { enabled: false })).rejects.toThrow(
      /can't be switched off/,
    );
    await expect(
      setWorkflow(db, owner, "qualified_follow_up", { enabled: true, config: { days: 99 } }),
    ).rejects.toThrow(/options/);
  });

  it("a workflow that is off is skipped (and logged when started by hand)", async () => {
    await setWorkflow(db, owner, "weekly_campaign_report", { enabled: false });
    expect(await runWorkflow(db, "weekly_campaign_report", { trigger: "schedule", e: mailEnv })).toBeNull();
    const run = await runWorkflowNow(db, owner, "weekly_campaign_report");
    expect(run).toMatchObject({ status: "skipped", trigger: "manual", triggeredById: owner.id });
  });

  it("counts a run as work only when it did something", () => {
    expect(didWork({ created: 0, skipped: "aiOff" })).toBe(false);
    expect(didWork({ created: 2 })).toBe(true);
  });
});

describe("workflows at work", () => {
  it("qualified lead → one follow-up per lead, for its salesperson, after the chosen days", async () => {
    const lead = await enquiry(false);
    await db.lead.update({ where: { id: lead.id }, data: { status: "qualified", assignedToId: sales.id } });
    await setWorkflow(db, owner, "qualified_follow_up", { enabled: true, config: { days: 3 } });
    const now = new Date();
    const run = await runWorkflowNow(db, owner, "qualified_follow_up");
    expect(run?.status).toBe("succeeded");
    const fu = await db.followUp.findFirstOrThrow({ where: { leadId: lead.id, note: QUALIFIED_NOTE } });
    expect(fu.assignedToId).toBe(sales.id);
    expect(Math.round((fu.dueAt.getTime() - now.getTime()) / 86_400_000)).toBe(3);
    // Done once, even after the follow-up is completed.
    await db.followUp.update({ where: { id: fu.id }, data: { doneAt: new Date() } });
    await runWorkflowNow(db, owner, "qualified_follow_up");
    expect(await db.followUp.count({ where: { leadId: lead.id } })).toBe(1);
  });

  it("website enquiry → an AI reply draft waiting for approval, only with email consent, once", async () => {
    await setWorkflow(db, owner, "website_enquiry_reply", { enabled: true });
    const withConsent = await enquiry(true);
    const without = await enquiry(false);
    const run = await runWorkflow(db, "website_enquiry_reply", { trigger: "manual", e: mailEnv });
    expect(run?.status).toBe("succeeded");
    const drafts = await db.customerMessage.findMany({ where: { leadId: withConsent.id } });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ origin: "ai", status: "pending_approval", sentAt: null });
    expect(await db.customerMessage.count({ where: { leadId: without.id } })).toBe(0);
    await runWorkflow(db, "website_enquiry_reply", { trigger: "manual", e: mailEnv });
    expect(await db.customerMessage.count({ where: { leadId: withConsent.id } })).toBe(1);
    // Without email sending set up, nothing is drafted.
    const r = await runWorkflow(db, "website_enquiry_reply", {
      trigger: "manual",
      e: { AI_PROVIDER: "mock" } as Env,
    });
    expect(r?.result).toMatchObject({ drafted: 0, skipped: "emailOff" });
  });

  it("new project photo → a draft post with that photo; photos from before switching on are left alone", async () => {
    const project = await db.portfolioProject.findFirstOrThrow({ where: { published: true } });
    const photo = async () => {
      const file = await db.fileAsset.create({
        data: {
          storageKey: `media/wf-${uid()}`,
          originalName: "project.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1000,
          kind: "project_photo",
          visibility: "public",
          status: "verified",
          verifiedAt: new Date(),
          credit: "GIK own photo",
        },
      });
      await db.portfolioImage.create({
        data: {
          projectId: project.id,
          fileId: file.id,
          altEn: "Island kitchen",
          altAr: "مطبخ",
          usagePermission: true,
        },
      });
      return file;
    };
    await setWorkflow(db, owner, "project_photo_social", { enabled: false });
    const before = await photo();
    await new Promise((r) => setTimeout(r, 20));
    await setWorkflow(db, owner, "project_photo_social", { enabled: true, config: { aiWrite: false } });
    await new Promise((r) => setTimeout(r, 20));
    const after = await photo();
    await runWorkflowNow(db, owner, "project_photo_social");
    expect(await db.socialPost.count({ where: { imageFileId: before.id } })).toBe(0);
    const post = await db.socialPost.findFirstOrThrow({ where: { imageFileId: after.id } });
    expect(post).toMatchObject({ status: "draft", type: "image", createdById: null });
    await runWorkflowNow(db, owner, "project_photo_social");
    expect(await db.socialPost.count({ where: { imageFileId: after.id } })).toBe(1);
  });

  it("weekly campaign report: queued once a week and emailed with the campaign results", async () => {
    await setWorkflow(db, owner, "weekly_campaign_report", { enabled: true });
    const first = await runWorkflowNow(db, owner, "weekly_campaign_report");
    const second = await runWorkflowNow(db, owner, "weekly_campaign_report");
    expect(
      (first?.result as { queued: number }).queued + (second?.result as { queued: number }).queued,
    ).toBeLessThanOrEqual(1);
    const event = await db.outboxEvent.findFirstOrThrow({
      where: { type: "analytics.report", payload: { path: ["kind"], equals: "campaigns" } },
      orderBy: { createdAt: "desc" },
    });
    const sent: string[] = [];
    const result = await sendReportEmail(
      db,
      { ...mailEnv, NOTIFY_EMAILS: "boss@gik.example" } as Env,
      "campaigns",
      (event.payload as { periodStart: string }).periodStart,
      "https://gik.example",
      async (_e, to, subject, text) => {
        sent.push(to.join(","), subject, text);
      },
    );
    expect(result).toBe("sent");
    expect(sent[1]).toMatch(/^Weekly campaign report: \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}$/);
    expect(sent[2]).toContain("EMAIL CAMPAIGNS TO PROSPECTS");
  });

  it("switches stored on other screens follow the workflow switch", async () => {
    await setWorkflow(db, owner, "no_response_follow_up", { enabled: true, config: { afterDays: 7 } });
    const row = await db.siteSetting.findUniqueOrThrow({ where: { key: "salesFollowUp" } });
    expect(row.value).toMatchObject({ autoDraft: true, afterDays: 7 });
    await setWorkflow(db, owner, "management_reports", { enabled: true });
    const reports = await db.siteSetting.findUniqueOrThrow({ where: { key: "analyticsReports" } });
    expect(reports.value).toMatchObject({ daily: true });
  });

  it("the scheduler runs each due workflow once, even when called twice at the same time", async () => {
    // Only the default workflows on; everything due.
    for (const key of ["website_enquiry_reply", "qualified_follow_up", "project_photo_social"])
      await setWorkflow(db, owner, key, { enabled: false });
    await db.workflowSetting.updateMany({ data: { lastCheckedAt: null } });
    const now = new Date();
    const [a, b] = await Promise.all([
      runDueWorkflows(db, { e: mailEnv, now }),
      runDueWorkflows(db, { e: mailEnv, now }),
    ]);
    // The two calls share the work: every timer workflow is checked exactly once.
    for (const key of Object.keys(a)) expect(b[key]).toBeUndefined();
    const timers = workflows.filter((w) => w.kind === "timer").map((w) => w.key);
    expect([...Object.keys(a), ...Object.keys(b)].sort()).toEqual([...timers].sort());
    expect({ ...a, ...b }.new_lead_alert).toBeUndefined(); // event workflows aren't on a timer
    // Right after, nothing is due.
    expect(await runDueWorkflows(db, { e: mailEnv, now: new Date(now.getTime() + 60_000) })).toEqual({});
  });
});
