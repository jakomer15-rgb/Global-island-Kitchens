import { z } from "zod";
import { company } from "@/config/company";
import { AUTOPILOT_HELD, AUTOPILOT_NOTE, heldReasons, holdText } from "@/lib/autopilot";
import { parseSetting } from "@/lib/site-settings";
import { aiAvailable } from "@/server/ai/drafts";
import { groundingFacts, hardRules } from "@/server/ai/grounding";
import { aiConfigured, aiGenerate, parseAiJson, type AiGenerate } from "@/server/ai/provider";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import type { Db } from "@/server/db/client";
import { env as readEnv, type Env } from "@/server/env";
import { RuleError } from "@/server/errors";
import { eligibleWhere, fillTemplate } from "@/server/marketing/campaigns";
import { emailReady } from "@/server/outreach/messages";
import { rateLimit } from "@/server/rate-limit";
import { updateSetting } from "@/server/settings/update";
import { setWorkflow } from "@/server/workflows/registry";
import { socialNeeds } from "./social";
import { readAutopilot, type AutopilotSettings } from "./state";

/**
 * The Autopilot page (Automation Centre → Autopilot): one switch to turn it on (with everything it needs),
 * one to stop it, its limits, the prospect email template the owner approves once, and what it did.
 */

const DAY = 24 * 60 * 60 * 1000;

export async function autopilotOverview(db: Db, actor: Actor, e: Env = readEnv(), now = new Date()) {
  assertCan(actor, "automation.read");
  const s = await readAutopilot(db);
  const since = new Date(now.getTime() - 7 * DAY);
  const replyNeeds: string[] = [];
  if (!aiConfigured(e)) replyNeeds.push("Claude API key (ANTHROPIC_API_KEY)");
  else if (!(await aiAvailable(db, "leadAssistant")))
    replyNeeds.push("AI lead assistant (switched on with Autopilot)");
  if (!emailReady(e)) replyNeeds.push("Email sending (Resend)");
  const prospectNeeds: string[] = [];
  if (!emailReady(e)) prospectNeeds.push("Email sending (Resend)");
  if (!s.prospectTemplate?.approvedAt) prospectNeeds.push("Approve the email template below");
  const [prospectsWithEmail, sentByAi, prospectSent, postsScheduled, heldMessages, heldPosts] =
    await Promise.all([
      db.prospect.count({ where: eligibleWhere({ status: "new" }, now) }),
      db.customerMessage.count({ where: { decisionNote: AUTOPILOT_NOTE, sentAt: { gte: since } } }),
      db.campaignMessage.count({
        where: { status: "sent", sentAt: { gte: since }, campaign: { decisionNote: AUTOPILOT_NOTE } },
      }),
      db.socialPost.count({ where: { decisionNote: AUTOPILOT_NOTE, approvedAt: { gte: since } } }),
      db.customerMessage.findMany({
        where: { status: "pending_approval", decisionNote: { startsWith: AUTOPILOT_HELD } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          subject: true,
          decisionNote: true,
          createdAt: true,
          lead: { select: { id: true, reference: true } },
        },
      }),
      db.socialPost.findMany({
        where: { status: "pending_approval", decisionNote: { startsWith: AUTOPILOT_HELD } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, title: true, decisionNote: true, createdAt: true },
      }),
    ]);
  if (prospectsWithEmail === 0)
    prospectNeeds.push("Prospects with an email address (Marketing → add or import)");
  return {
    settings: s,
    needs: { replies: replyNeeds, prospects: prospectNeeds, social: await socialNeeds(db, e) },
    prospectsWithEmail,
    last7: { sentByAi, prospectSent, postsScheduled, held: heldMessages.length + heldPosts.length },
    held: [
      ...heldMessages.map((m) => ({
        kind: "message" as const,
        id: m.id,
        title: `${m.lead.reference}: ${m.subject ?? ""}`,
        reason: (m.decisionNote ?? "").replace(`${AUTOPILOT_HELD}: `, ""),
        href: `/admin/leads/${m.lead.id}#messages`,
        at: m.createdAt,
      })),
      ...heldPosts.map((p) => ({
        kind: "post" as const,
        id: p.id,
        title: p.title,
        reason: (p.decisionNote ?? "").replace(`${AUTOPILOT_HELD}: `, ""),
        href: `/admin/social/${p.id}`,
        at: p.createdAt,
      })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime()),
  };
}

export const optionsInput = z.object({
  mode: z.enum(["approve", "auto"]),
  approvalEmails: z.boolean(),
  copyEmails: z.boolean(),
  replies: z.boolean(),
  customerEmailsPerDay: z.number().int().min(1).max(100),
  followUpsPerLead: z.number().int().min(0).max(5),
  prospectEmails: z.boolean(),
  prospectEmailsPerDay: z.number().int().min(1).max(50),
  social: z.boolean(),
  postsPerWeek: z.number().int().min(1).max(7),
  socialPlatforms: z.array(z.enum(["instagram", "facebook"])).min(1, "Choose at least one platform."),
  socialLanguage: z.enum(["en", "ar", "both"]),
  dailySummary: z.boolean(),
});

/** Saves the switches and limits (not the master switch, not the template). */
export async function saveAutopilotOptions(db: Db, actor: Actor, input: z.input<typeof optionsInput>) {
  assertCan(actor, "workflows.manage");
  const o = optionsInput.parse(input);
  const s = await readAutopilot(db);
  if (o.prospectEmails && !s.prospectTemplate?.approvedAt)
    throw new RuleError(
      "template",
      "Approve the prospect email template before switching prospect emails on.",
    );
  // Switching prospect emails on again clears a safety pause.
  const paused = o.prospectEmails && !s.prospectEmails ? null : s.prospectPausedReason;
  await updateSetting(db, actor, "autopilot", { ...s, ...o, prospectPausedReason: paused });
}

export const templateInput = z.object({
  subject: z.string().trim().min(3, "Write a subject.").max(200),
  body: z.string().trim().min(20, "Write the email (at least 20 characters).").max(3000),
  language: z.enum(["en", "ar"]),
});

/** The owner (or general manager) approves the prospect template once; it is checked like any AI text. */
export async function approveProspectTemplate(db: Db, actor: Actor, input: z.input<typeof templateInput>) {
  assertCan(actor, "workflows.manage");
  assertCan(actor, "outreach.approve");
  const t = templateInput.parse(input);
  const sample = {
    companyName: "Example Interiors",
    contactName: "Sara",
    area: "Seef",
    type: "interior_designer",
  };
  const unsafe = heldReasons(
    `${fillTemplate(t.subject, sample, t.language)}\n${fillTemplate(t.body, sample, t.language)}`,
  );
  if (unsafe.length)
    throw new RuleError(
      "unsafe",
      `The template ${holdText(unsafe)}. Change it so it can be sent automatically.`,
    );
  const s = await readAutopilot(db);
  await updateSetting(db, actor, "autopilot", {
    ...s,
    prospectTemplate: {
      ...t,
      approvedById: actor.id,
      approvedByName: actor.name ?? null,
      approvedAt: new Date().toISOString(),
    },
  });
}

const aiTemplate = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(20).max(3000),
});

/** The AI drafts the prospect template from a short brief; the owner reads and approves it. */
export async function writeProspectTemplateWithAi(
  db: Db,
  actor: Actor,
  input: { brief: string; language: "en" | "ar" },
  generate: AiGenerate = aiGenerate,
) {
  assertCan(actor, "workflows.manage");
  assertCan(actor, "ai.use");
  if (!aiConfigured()) throw new RuleError("aiOff", "The Claude API key isn't set.");
  if (!(await rateLimit(db, `ai:${actor.id}`, 30, 60 * 60))) throw new RuleError("tooMany");
  const brief = input.brief.trim().slice(0, 1000);
  const { text } = await generate({
    task: "customer_message",
    maxTokens: 1200,
    system: [
      `You write business-to-business introduction emails for ${company.legalName}, a kitchen and interior joinery manufacturer in Bahrain. They are sent automatically to many businesses, so follow the rules exactly.`,
      `Write one short, professional email (100–160 words) in ${input.language === "ar" ? "Arabic" : "English"}. Use these placeholders where useful: {company} (their company), {area} (their area), {type} (their kind of business). Do not write a greeting line, signature or unsubscribe text: they are added automatically. No links, email addresses, phone numbers, prices, offers or time promises. Offer a short call or a showroom visit and invite them to reply. Reply with JSON only: {"subject":"...","body":"..."}.`,
      "Facts you may use:",
      groundingFacts(),
      "Rules:",
      hardRules,
    ].join("\n\n"),
    user: brief
      ? `What the owner wants the email to say: ${brief}`
      : "A general introduction to the company.",
  });
  return parseAiJson(text, aiTemplate);
}

/**
 * Turns Autopilot on together with what it relies on: the AI assistants, the enquiry reply and follow-up
 * workflows and the post publishing workflow. Audited.
 */
export async function turnOnAutopilot(db: Db, actor: Actor) {
  assertCan(actor, "workflows.manage");
  const ai = parseSetting("ai", (await db.siteSetting.findUnique({ where: { key: "ai" } }))?.value);
  if (!ai.enabled || !ai.leadAssistant || !ai.contentAssistant)
    await updateSetting(db, actor, "ai", {
      ...ai,
      enabled: true,
      leadAssistant: true,
      contentAssistant: true,
    });
  const rows = new Map((await db.workflowSetting.findMany()).map((r) => [r.key, r]));
  const config = (key: string) => (rows.get(key)?.config ?? {}) as Record<string, unknown>;
  for (const key of ["website_enquiry_reply", "no_response_follow_up", "approved_post_publishing"])
    if (!rows.get(key)?.enabled || key === "no_response_follow_up")
      await setWorkflow(db, actor, key, { enabled: true, config: config(key) });
  const s = await readAutopilot(db);
  await updateSetting(db, actor, "autopilot", { ...s, enabled: true });
  await db.$transaction((tx) =>
    audit(tx, {
      actorId: actor.id,
      action: "autopilot.turned_on",
      entityType: "setting",
      entityId: "autopilot",
    }),
  );
}

/**
 * The OFF switch: Autopilot stops at once, and what it approved but hasn't sent or published yet goes back
 * to a person (messages and posts to Approvals; prospect emails are dropped and can be sent again later).
 */
export async function stopAutopilot(db: Db, actor: Actor) {
  assertCan(actor, "workflows.manage");
  const s: AutopilotSettings = await readAutopilot(db);
  await updateSetting(db, actor, "autopilot", { ...s, enabled: false });
  const note = `${AUTOPILOT_HELD}: Autopilot was stopped before it was sent`;
  return db.$transaction(async (tx) => {
    const messages = await tx.customerMessage.updateMany({
      where: { status: "approved", decisionNote: AUTOPILOT_NOTE },
      data: { status: "pending_approval", decidedAt: null, decisionNote: note },
    });
    const prospects = await tx.campaignMessage.updateMany({
      where: { status: "queued", campaign: { decisionNote: AUTOPILOT_NOTE } },
      data: { status: "skipped", error: "Autopilot was stopped before it was sent." },
    });
    const posts = await tx.socialPost.findMany({
      where: {
        status: { in: ["approved", "scheduled"] },
        decisionNote: AUTOPILOT_NOTE,
        targets: { none: { status: "published" } },
      },
      select: { id: true },
    });
    for (const p of posts) {
      await tx.socialPostTarget.deleteMany({ where: { postId: p.id } });
      await tx.socialPost.update({
        where: { id: p.id },
        data: { status: "pending_approval", approvedAt: null, decisionNote: note },
      });
    }
    const counts = { messages: messages.count, prospectEmails: prospects.count, posts: posts.length };
    await audit(tx, {
      actorId: actor.id,
      action: "autopilot.stopped",
      entityType: "setting",
      entityId: "autopilot",
      changes: counts,
    });
    return counts;
  });
}
