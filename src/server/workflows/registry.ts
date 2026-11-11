import { z } from "zod";
import type { Prisma, WorkflowRun } from "@/generated/prisma/client";
import { parseSetting } from "@/lib/site-settings";
import { aiAvailable } from "@/server/ai/drafts";
import { aiConfigured } from "@/server/ai/provider";
import { queueCampaignReport, queueDueReports } from "@/server/analytics/report";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import type { Db } from "@/server/db/client";
import { env as readEnv, type Env } from "@/server/env";
import { NotFoundError, RuleError } from "@/server/errors";
import { draftNewEnquiryReplies, draftNoResponseFollowUps } from "@/server/outreach/messages";
import { updateSetting } from "@/server/settings/update";
import { instagramReady, metaReady } from "@/server/social/meta";
import { queueDuePosts, refreshEngagement } from "@/server/social/posts";
import { projectPhotoDrafts, qualifiedFollowUps } from "./tasks";

/**
 * The nine automation workflows of the owner's brief (Stage 8). Each one is real code in this app; n8n can
 * start them through a signed request and receives every event through the signed webhook. Workflows with
 * work to do on a timer run when the scheduler is called (`/api/cron/outbox`: daily on the current Vercel
 * plan, every few minutes with an n8n timer or a paid plan), each at most every `everyMinutes`. A run that
 * did something or failed is logged; nothing a person must approve is ever sent or published by a workflow.
 */

export type WorkflowKey =
  | "website_enquiry_reply"
  | "whatsapp_enquiry"
  | "new_lead_alert"
  | "qualified_follow_up"
  | "no_response_follow_up"
  | "project_photo_social"
  | "approved_post_publishing"
  | "weekly_campaign_report"
  | "management_reports";

type Ctx = { db: Db; e: Env; now: Date; config: Record<string, unknown> };

export interface WorkflowState {
  enabled: boolean;
  /** What's missing for it to do its job (shown to the owner). */
  needs: string[];
}

export interface ConfigField {
  name: string;
  label: string;
  type: "number" | "boolean";
  min?: number;
  max?: number;
  hint?: string;
}

interface WorkflowDef {
  key: WorkflowKey;
  name: string;
  trigger: string;
  steps: string[];
  /** "timer": runs from the scheduler; "event": runs as the app receives things (always on when set up). */
  kind: "timer" | "event";
  everyMinutes?: number;
  /** Has its own switch here; otherwise it is always on, or follows another screen's setting. */
  switchable: boolean;
  /** Switch stored in another screen's setting (shown there too). */
  settingKey?: "salesFollowUp" | "analyticsReports";
  defaultOn?: boolean;
  config?: { fields: ConfigField[]; schema: z.ZodType<Record<string, unknown>> };
  /** Built partly: the part not built yet and why. */
  notBuilt?: string;
  /** Outbox event types delivered for this workflow (shown as its activity). */
  events?: string[];
  state(ctx: Ctx, own: boolean): Promise<WorkflowState>;
  run?(ctx: Ctx): Promise<Record<string, unknown>>;
}

const email = (e: Env) => Boolean(e.RESEND_API_KEY && e.EMAIL_FROM);
const needAi = async (db: Db, e: Env, feature: "leadAssistant" | "contentAssistant") =>
  !aiConfigured(e)
    ? ["Claude API key (ANTHROPIC_API_KEY)"]
    : !(await aiAvailable(db, feature))
      ? [
          `AI assistant switched on (Settings → AI, ${feature === "leadAssistant" ? "lead" : "content"} assistant)`,
        ]
      : [];
const needEmail = (e: Env) => (email(e) ? [] : ["Email sending (Resend)"]);
const since = (config: Record<string, unknown>, now: Date, days: number) => {
  const s = typeof config.since === "string" ? new Date(config.since) : null;
  const floor = new Date(now.getTime() - days * 86_400_000);
  return s && s > floor ? s : floor;
};

async function setting<K extends "salesFollowUp" | "analyticsReports">(db: Db, key: K) {
  const row = await db.siteSetting.findUnique({ where: { key } });
  return parseSetting(key, row?.value);
}

export const workflows: readonly WorkflowDef[] = [
  {
    key: "website_enquiry_reply",
    name: "Website enquiry → AI response → CRM record",
    trigger: "A customer sends a form or chats on the website",
    steps: [
      "The enquiry is saved as a customer and lead (always)",
      "The website chat answers with the AI (its own switch: AI agent)",
      "For forms: the AI drafts a first reply email (this switch)",
      "The reply waits for approval, then is sent by email",
    ],
    kind: "timer",
    everyMinutes: 10,
    switchable: true,
    async state({ db, e }, own) {
      return { enabled: own, needs: [...(await needAi(db, e, "leadAssistant")), ...needEmail(e)] };
    },
    async run({ db, e, now, config }) {
      return draftNewEnquiryReplies(db, { since: since(config, now, 2), now, env: e });
    },
  },
  {
    key: "whatsapp_enquiry",
    name: "WhatsApp enquiry → AI response → CRM record",
    trigger: "A customer messages the company's WhatsApp Business number",
    steps: [
      "The message is saved on the customer's lead (a new lead if needed)",
      "The sales team is alerted",
      "AI reply on WhatsApp (not built yet)",
    ],
    kind: "event",
    switchable: false,
    notBuilt:
      "AI replies on WhatsApp are Stage 4 part B: they need the WhatsApp Business account and Meta-approved message templates.",
    events: ["whatsapp.received"],
    async state({ e }) {
      const ready = Boolean(e.WHATSAPP_ACCESS_TOKEN && e.WHATSAPP_PHONE_NUMBER_ID && e.WHATSAPP_APP_SECRET);
      return { enabled: ready, needs: ready ? [] : ["WhatsApp Business account (WHATSAPP_* settings)"] };
    },
  },
  {
    key: "new_lead_alert",
    name: "New lead → sales team notification",
    trigger: "Any new enquiry (forms, chat, WhatsApp, designers)",
    steps: [
      "The sales team gets an email with the details and a link to the lead",
      "Chat leads also get a WhatsApp alert when WhatsApp is set up",
      "Every event also goes to n8n (signed) when n8n is connected",
    ],
    kind: "event",
    switchable: false,
    events: ["enquiry.received", "chat.lead"],
    async state({ e }) {
      return { enabled: true, needs: needEmail(e) };
    },
  },
  {
    key: "qualified_follow_up",
    name: "Qualified lead → follow-up",
    trigger: "A lead reaches the Qualified stage",
    steps: [
      "A follow-up is added, due after the number of days below",
      "It is given to the lead's salesperson and shows in Follow-ups",
      "Once per lead",
    ],
    kind: "timer",
    everyMinutes: 10,
    switchable: true,
    config: {
      fields: [{ name: "days", label: "Follow up after (days)", type: "number", min: 1, max: 14 }],
      schema: z.object({ days: z.number().int().min(1).max(14).default(2) }).passthrough(),
    },
    async state(_ctx, own) {
      return { enabled: own, needs: [] };
    },
    async run({ db, now, config }) {
      return qualifiedFollowUps(db, Number(config.days ?? 2), now);
    },
  },
  {
    key: "no_response_follow_up",
    name: "No customer response → scheduled follow-up",
    trigger: "An open lead with no contact for a number of days",
    steps: [
      "The AI drafts a follow-up email (customers who agreed to email only)",
      "It waits on the lead and in Approvals",
      "Sent by email only after approval",
    ],
    kind: "timer",
    everyMinutes: 360,
    switchable: true,
    settingKey: "salesFollowUp",
    config: {
      fields: [
        { name: "afterDays", label: "After how many days without contact", type: "number", min: 2, max: 60 },
      ],
      schema: z.object({ afterDays: z.number().int().min(2).max(60).default(4) }).passthrough(),
    },
    async state({ db, e }) {
      const s = await setting(db, "salesFollowUp");
      return { enabled: s.autoDraft, needs: [...(await needAi(db, e, "leadAssistant")), ...needEmail(e)] };
    },
    async run({ db, e, now }) {
      return draftNoResponseFollowUps(db, { now, env: e });
    },
  },
  {
    key: "project_photo_social",
    name: "New project image → social media content draft",
    trigger: "A project photo with usage permission is added to the portfolio",
    steps: [
      "A photo post for Instagram and Facebook is drafted with it",
      "The AI writes the captions and hashtags (option below)",
      "It waits in the content calendar for approval; nothing is published",
    ],
    kind: "timer",
    everyMinutes: 30,
    switchable: true,
    config: {
      fields: [{ name: "aiWrite", label: "Have the AI write the captions", type: "boolean" }],
      schema: z.object({ aiWrite: z.boolean().default(true) }).passthrough(),
    },
    async state({ db, e, config }, own) {
      return { enabled: own, needs: config.aiWrite === false ? [] : await needAi(db, e, "contentAssistant") };
    },
    async run({ db, now, config }) {
      return projectPhotoDrafts(db, { since: since(config, now, 30), aiWrite: config.aiWrite !== false });
    },
  },
  {
    key: "approved_post_publishing",
    name: "Approved post → social media publishing",
    trigger: "An approved post's scheduled time arrives",
    steps: [
      "Facebook and Instagram: published through Meta's official API",
      "Other platforms: marked “post by hand” for the team",
      "Likes, comments and shares are read back every few hours",
    ],
    kind: "timer",
    everyMinutes: 5,
    switchable: true,
    defaultOn: true,
    events: ["social.publish"],
    async state({ e }, own) {
      return {
        enabled: own,
        needs: metaReady(e)
          ? instagramReady(e)
            ? []
            : ["Instagram account id (META_INSTAGRAM_ACCOUNT_ID); Facebook works"]
          : ["Meta connection (META_* settings); until then posts are marked “post by hand”"],
      };
    },
    async run({ db, e, now }) {
      const posts = await queueDuePosts(db, now);
      const engagement = await refreshEngagement(db, e, { now });
      return {
        postsQueued: posts.queued,
        figuresUpdated: engagement.updated,
        figuresFailed: engagement.failed ?? 0,
      };
    },
  },
  {
    key: "weekly_campaign_report",
    name: "Weekly campaign → performance report",
    trigger: "Every Saturday morning, for the week before",
    steps: [
      "Email and social campaign results of the last week are counted",
      "Emailed to the report addresses (Business analytics) or NOTIFY_EMAILS",
      "Once per week",
    ],
    kind: "timer",
    everyMinutes: 60,
    switchable: true,
    events: ["analytics.report"],
    async state({ e }, own) {
      return { enabled: own, needs: needEmail(e) };
    },
    async run({ db, now }) {
      return queueCampaignReport(db, now);
    },
  },
  {
    key: "management_reports",
    name: "Daily sales activity → management report",
    trigger: "Every morning (and weekly / monthly when switched on in Business analytics)",
    steps: [
      "Yesterday's figures are counted from the database",
      "Emailed to the report addresses; weekly on Saturday and monthly on the 1st when switched on",
      "Once per period",
    ],
    kind: "timer",
    everyMinutes: 60,
    switchable: true,
    settingKey: "analyticsReports",
    events: ["analytics.report"],
    async state({ db, e }) {
      const s = await setting(db, "analyticsReports");
      return { enabled: s.daily || s.weekly || s.monthly, needs: needEmail(e) };
    },
    async run({ db, now }) {
      return queueDueReports(db, now);
    },
  },
];

const byKey = new Map(workflows.map((w) => [w.key, w]));
export const isWorkflowKey = (k: string): k is WorkflowKey => byKey.has(k as WorkflowKey);

async function rows(db: Db) {
  await db.workflowSetting.createMany({
    data: workflows.map((w) => ({ key: w.key, enabled: Boolean(w.defaultOn) })),
    skipDuplicates: true,
  });
  return new Map((await db.workflowSetting.findMany()).map((r) => [r.key, r]));
}

const configOf = (def: WorkflowDef, raw: unknown) => {
  const base = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return def.config ? { ...base, ...def.config.schema.parse(base) } : base;
};

/** Did the run do anything? (any positive count in its result) */
export function didWork(result: Record<string, unknown> | null | undefined): boolean {
  return Object.values(result ?? {}).some((v) => typeof v === "number" && v > 0);
}

/**
 * Runs one workflow now and logs it. From the scheduler, runs with nothing to do aren't logged. A workflow
 * that is off is skipped (and logged as skipped when a person or n8n started it).
 */
export async function runWorkflow(
  db: Db,
  key: WorkflowKey,
  options: {
    trigger: "schedule" | "manual" | "n8n" | "retry";
    actorId?: string | null;
    retryOfId?: string;
    e?: Env;
    now?: Date;
  },
): Promise<WorkflowRun | null> {
  const def = byKey.get(key);
  if (!def) throw new NotFoundError("Workflow");
  const e = options.e ?? readEnv();
  const now = options.now ?? new Date();
  const row = (await rows(db)).get(key)!;
  const ctx: Ctx = { db, e, now, config: configOf(def, row.config) };
  const state = await def.state(ctx, row.enabled);
  const log = (data: Omit<Prisma.WorkflowRunUncheckedCreateInput, "workflow" | "trigger">) =>
    db.workflowRun.create({
      data: {
        workflow: key,
        trigger: options.trigger,
        triggeredById: options.actorId ?? null,
        retryOfId: options.retryOfId ?? null,
        startedAt: now,
        finishedAt: new Date(),
        ...data,
      },
    });
  if (!def.run) {
    if (options.trigger === "schedule") return null;
    return log({
      status: "skipped",
      result: { reason: "Runs by itself as the app receives things; nothing to start." },
    });
  }
  if (!state.enabled) {
    if (options.trigger === "schedule") return null;
    return log({ status: "skipped", result: { reason: "Switched off." } });
  }
  let result: Record<string, unknown>;
  try {
    result = await def.run(ctx);
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    console.error("Workflow failed", key, message);
    return log({ status: "failed", error: message });
  } finally {
    await db.workflowSetting.update({ where: { key }, data: { lastCheckedAt: now } });
  }
  if (options.trigger === "schedule" && !didWork(result)) return null;
  return log({ status: "succeeded", result: JSON.parse(JSON.stringify(result)) });
}

/**
 * The scheduler: every switched-on timer workflow whose interval has passed. Each workflow is claimed with
 * one atomic update, so overlapping calls (the daily job and an n8n timer) never run it twice.
 */
export async function runDueWorkflows(db: Db, options: { e?: Env; now?: Date } = {}) {
  const now = options.now ?? new Date();
  await rows(db);
  const summary: Record<string, string> = {};
  for (const def of workflows) {
    if (def.kind !== "timer" || !def.everyMinutes) continue;
    const cutoff = new Date(now.getTime() - def.everyMinutes * 60_000 + 30_000);
    const claimed = await db.workflowSetting.updateMany({
      where: { key: def.key, OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: cutoff } }] },
      data: { lastCheckedAt: now },
    });
    if (!claimed.count) continue;
    try {
      const run = await runWorkflow(db, def.key, { trigger: "schedule", e: options.e, now });
      summary[def.key] = run ? run.status : "nothing to do";
    } catch (error) {
      summary[def.key] = "error";
      console.error("Workflow scheduler error", def.key, error instanceof Error ? error.message : error);
    }
  }
  return summary;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function workflowOverview(db: Db, actor: Actor, e: Env = readEnv(), now = new Date()) {
  assertCan(actor, "automation.read");
  const settings = await rows(db);
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const [runCounts, lastRuns, deliveries] = await Promise.all([
    db.workflowRun.groupBy({
      by: ["workflow", "status"],
      where: { startedAt: { gte: since } },
      _count: { _all: true },
    }),
    db.$queryRaw<WorkflowRun[]>`
      SELECT DISTINCT ON ("workflow") "id", "workflow", "trigger", "status", "started_at" AS "startedAt", "error"
      FROM "workflow_runs" ORDER BY "workflow", "started_at" DESC`,
    db.outboxEvent.groupBy({
      by: ["type", "status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  return Promise.all(
    workflows.map(async (def) => {
      const row = settings.get(def.key)!;
      const config = configOf(def, row.config);
      if (def.settingKey === "salesFollowUp")
        config.afterDays = (await setting(db, "salesFollowUp")).afterDays;
      const state = await def.state({ db, e, now, config }, row.enabled);
      const count = (s: string) =>
        runCounts.find((r) => r.workflow === def.key && r.status === s)?._count._all ?? 0;
      const delivered = (s: string) =>
        deliveries
          .filter((d) => def.events?.includes(d.type) && d.status === s)
          .reduce((n, d) => n + d._count._all, 0);
      return {
        key: def.key,
        name: def.name,
        trigger: def.trigger,
        steps: def.steps,
        kind: def.kind,
        everyMinutes: def.everyMinutes ?? null,
        switchable: def.switchable,
        settingKey: def.settingKey ?? null,
        notBuilt: def.notBuilt ?? null,
        configFields: def.config?.fields ?? [],
        config,
        canRun: Boolean(def.run),
        ...state,
        lastCheckedAt: row.lastCheckedAt,
        lastRun: lastRuns.find((r) => r.workflow === def.key) ?? null,
        runs7: { succeeded: count("succeeded"), failed: count("failed"), skipped: count("skipped") },
        events7: def.events
          ? { done: delivered("done"), failed: delivered("failed"), pending: delivered("pending") }
          : null,
      };
    }),
  );
}

/** Switches a workflow on or off and saves its options (audited). */
export async function setWorkflow(
  db: Db,
  actor: Actor,
  key: string,
  input: { enabled: boolean; config?: Record<string, unknown> },
  now = new Date(),
) {
  assertCan(actor, "workflows.manage");
  if (!isWorkflowKey(key)) throw new NotFoundError("Workflow");
  const def = byKey.get(key)!;
  if (!def.switchable) throw new RuleError("notSwitchable", "This workflow can't be switched off here.");
  const row = (await rows(db)).get(key)!;
  const old = configOf(def, row.config);
  // Only the workflow's own options are accepted from the form (never `since` or other keys).
  const allowed = new Set(def.config?.fields.map((f) => f.name) ?? []);
  const changes = Object.fromEntries(Object.entries(input.config ?? {}).filter(([k]) => allowed.has(k)));
  const parsed = def.config ? def.config.schema.safeParse({ ...old, ...changes }) : null;
  if (parsed && !parsed.success) throw new RuleError("config", "Check the workflow's options.");
  const config: Record<string, unknown> = { ...old, ...(parsed?.data ?? {}) };
  // Work before switching on isn't picked up (e.g. every existing portfolio photo).
  if (input.enabled && !row.enabled) config.since = now.toISOString();

  if (def.settingKey === "salesFollowUp") {
    await updateSetting(db, actor, "salesFollowUp", {
      autoDraft: input.enabled,
      afterDays: Number(config.afterDays ?? 4),
    });
  } else if (def.settingKey === "analyticsReports") {
    const s = await setting(db, "analyticsReports");
    await updateSetting(db, actor, "analyticsReports", { ...s, daily: input.enabled });
  }
  await db.$transaction(async (tx) => {
    await tx.workflowSetting.update({
      where: { key },
      data: { enabled: input.enabled, config: config as Prisma.InputJsonValue, updatedById: actor.id },
    });
    await audit(tx, {
      actorId: actor.id,
      action: input.enabled ? "workflow.enabled" : "workflow.disabled",
      entityType: "workflow",
      entityId: key,
      changes: { config: def.config ? (parsed?.data as Prisma.InputJsonValue) : null },
    });
  });
}

/** "Run now" or "Run again" from the admin (audited). */
export async function runWorkflowNow(db: Db, actor: Actor, key: string, retryOfId?: string) {
  assertCan(actor, "workflows.manage");
  if (!isWorkflowKey(key)) throw new NotFoundError("Workflow");
  // "Run again" only for a failed run of this same workflow.
  if (
    retryOfId &&
    !(await db.workflowRun.findFirst({ where: { id: retryOfId, workflow: key, status: "failed" } }))
  )
    throw new NotFoundError("Failed run");
  const run = await runWorkflow(db, key, {
    trigger: retryOfId ? "retry" : "manual",
    actorId: actor.id,
    retryOfId,
  });
  await db.$transaction((tx) =>
    audit(tx, {
      actorId: actor.id,
      action: "workflow.run",
      entityType: "workflow",
      entityId: key,
      changes: { status: run?.status ?? null },
    }),
  );
  return run;
}

export async function workflowRuns(
  db: Db,
  actor: Actor,
  filters: { workflow?: string; status?: string; page?: number },
) {
  assertCan(actor, "automation.read");
  const where: Prisma.WorkflowRunWhereInput = {
    ...(filters.workflow && isWorkflowKey(filters.workflow) ? { workflow: filters.workflow } : {}),
    ...(filters.status && ["succeeded", "failed", "skipped"].includes(filters.status)
      ? { status: filters.status }
      : {}),
  };
  const page = Math.max(1, filters.page ?? 1);
  const [items, total] = await Promise.all([
    db.workflowRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * 50,
      take: 50,
      include: { triggeredBy: { select: { name: true } } },
    }),
    db.workflowRun.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / 50)) };
}

export const workflowNames: Record<string, string> = Object.fromEntries(
  workflows.map((w) => [w.key, w.name]),
);
