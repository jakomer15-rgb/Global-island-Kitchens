import { z } from "zod";
import { company } from "@/config/company";
import type { CampaignStatus, Prisma, ProspectPriority } from "@/generated/prisma/client";
import { gccCountries, prospectTypeNames, prospectTypes, type ProspectTypeKey } from "@/lib/prospect-score";
import { aiAvailable } from "@/server/ai/drafts";
import { groundingFacts, hardRules } from "@/server/ai/grounding";
import { aiGenerate, parseAiJson, type AiGenerate } from "@/server/ai/provider";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import { notify } from "@/server/crm/shared";
import type { Db, Tx } from "@/server/db/client";
import { env as readEnv, type Env } from "@/server/env";
import { NotFoundError, RuleError } from "@/server/errors";
import { sendEmail, type ChannelResult } from "@/server/outbox/deliver";
import { enqueue } from "@/server/outbox/events";
import { emailReady } from "@/server/outreach/messages";
import { rateLimit } from "@/server/rate-limit";
import { prospectUnsubscribeUrl } from "./prospects";

/**
 * Email campaigns to prospects (Stage 5). Business-to-business emails to the work addresses businesses
 * publish, with rules enforced here:
 * - an approver (`outreach.approve`) approves the whole campaign, after seeing every email;
 * - never to prospects who are not interested, do-not-contact or unsubscribed, nor to anyone emailed by
 *   another campaign in the last 30 days, and at most 100 emails per campaign;
 * - every email says who sent it and why, and carries an unsubscribe link that works without sign-in;
 * - sent by the outbox 20 at a time (each run of the scheduled job, and right after approval);
 * - a sent email can't be changed (trigger).
 * WhatsApp introductions are not sent: WhatsApp only allows messages to people who opted in.
 */

export const MAX_PER_CAMPAIGN = 100;
export const RECONTACT_DAYS = 30;

export const audienceSchema = z.object({
  type: z.enum(prospectTypes).optional(),
  country: z.enum(Object.keys(gccCountries) as [string, ...string[]]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  status: z.enum(["new", "contacted", "interested"]).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
});
export type Audience = z.infer<typeof audienceSchema>;

export const campaignInput = z.object({
  name: z.string().trim().min(2, "Name the campaign.").max(120),
  brief: z.string().trim().min(10, "Describe what the emails should say (at least 10 characters).").max(2000),
  language: z.enum(["en", "ar"]),
  audience: audienceSchema,
});

export const templateInput = z.object({
  subjectTemplate: z.string().trim().min(3, "Write a subject.").max(200),
  bodyTemplate: z.string().trim().min(20, "Write the email.").max(5000),
});

export const campaignStatusNames: Record<CampaignStatus, string> = {
  draft: "Draft",
  pending_approval: "Waiting for approval",
  approved: "Approved, sending",
  sent: "Sent",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** Prospects a campaign may email now. */
export function eligibleWhere(audience: Audience, now = new Date()): Prisma.ProspectWhereInput {
  const cutoff = new Date(now.getTime() - RECONTACT_DAYS * 24 * 60 * 60 * 1000);
  return {
    email: { not: null },
    unsubscribedAt: null,
    status: audience.status ? audience.status : { in: ["new", "contacted", "interested"] },
    ...(audience.type ? { type: audience.type } : {}),
    ...(audience.country ? { country: audience.country } : {}),
    ...(audience.priority ? { priority: audience.priority as ProspectPriority } : {}),
    ...(audience.minScore !== undefined ? { score: { gte: audience.minScore } } : {}),
    messages: { none: { OR: [{ sentAt: { gte: cutoff } }, { status: "queued" }] } },
  };
}

const countryAr: Record<string, string> = {
  BH: "البحرين",
  SA: "المملكة العربية السعودية",
  AE: "الإمارات",
  KW: "الكويت",
  QA: "قطر",
  OM: "عُمان",
};

/** Fills {company}, {contact}, {area} and {type}. Unknown values read naturally. Pure (unit-tested). */
export function fillTemplate(
  template: string,
  p: { companyName: string; contactName: string | null; area: string | null; type: string; country?: string },
  language: "en" | "ar",
) {
  const country = gccCountries[(p.country ?? "BH") as keyof typeof gccCountries] ?? "Bahrain";
  const values: Record<string, string> = {
    company: p.companyName,
    contact: p.contactName ?? (language === "ar" ? `فريق ${p.companyName}` : `${p.companyName} team`),
    // Without an area, their country (Arabic emails: the country name as written in English is avoided).
    area: p.area ?? (language === "ar" ? (countryAr[p.country ?? "BH"] ?? "البحرين") : country),
    type: (prospectTypeNames[p.type as ProspectTypeKey] ?? "business").toLowerCase(),
  };
  return template.replace(/\{(company|contact|area|type)\}/g, (_, k: string) => values[k]!);
}

/** The email a prospect receives: greeting, the approved text, signature, why they got it, unsubscribe. */
export function composeProspectEmail(
  body: string,
  prospect: { id: string; companyName: string; contactName: string | null },
  language: "en" | "ar",
  base?: string,
) {
  const name = prospect.contactName ?? prospect.companyName;
  const link = prospectUnsubscribeUrl(prospect.id, base);
  return language === "ar"
    ? `مرحبًا ${name}،\n\n${body.trim()}\n\nمع أطيب التحيات،\nGlobal Island Kitchens W.L.L، مملكة البحرين\n\nوصلتكم هذه الرسالة لأن عنوان بريدكم منشور كجهة اتصال للأعمال. لعدم تلقي رسائل منا: ${link}`
    : `Dear ${name},\n\n${body.trim()}\n\nKind regards,\n${company.legalName}, Kingdom of Bahrain\n\nYou received this email because your address is published as a business contact. To receive no further emails from us: ${link}`;
}

export async function createCampaign(db: Db, actor: Actor, input: z.infer<typeof campaignInput>) {
  assertCan(actor, "marketing.manage");
  return db.$transaction(async (tx) => {
    const c = await tx.campaign.create({
      data: {
        name: input.name,
        brief: input.brief,
        language: input.language,
        audience: input.audience,
        createdById: actor.id,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "campaign.created",
      entityType: "campaign",
      entityId: c.id,
      changes: { name: c.name },
    });
    return c;
  });
}

async function draftCampaign(tx: Tx, id: string) {
  const c = await tx.campaign.findUnique({ where: { id } });
  if (!c) throw new NotFoundError("Campaign");
  if (c.status !== "draft") throw new RuleError("notDraft", "Only a draft campaign can be changed.");
  return c;
}

export async function saveTemplate(db: Db, actor: Actor, id: string, input: z.infer<typeof templateInput>) {
  assertCan(actor, "marketing.manage");
  await db.$transaction(async (tx) => {
    await draftCampaign(tx, id);
    await tx.campaign.update({ where: { id }, data: input });
    await audit(tx, {
      actorId: actor.id,
      action: "campaign.template_saved",
      entityType: "campaign",
      entityId: id,
    });
  });
}

const aiTemplate = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(20).max(3000),
});

/** The AI writes the template from the brief (no prospect data is sent). Staff edit it before preparing. */
export async function writeTemplateWithAi(
  db: Db,
  actor: Actor,
  id: string,
  generate: AiGenerate = aiGenerate,
) {
  assertCan(actor, "marketing.manage");
  assertCan(actor, "ai.use");
  if (!(await aiAvailable(db, "contentAssistant")))
    throw new RuleError("aiOff", "The AI assistant is switched off.");
  if (!(await rateLimit(db, `ai:${actor.id}`, 30, 60 * 60))) throw new RuleError("tooMany");
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c) throw new NotFoundError("Campaign");
  if (c.status !== "draft") throw new RuleError("notDraft", "Only a draft campaign can be changed.");
  const audience = audienceSchema.parse(c.audience);
  const { text } = await generate({
    task: "customer_message",
    maxTokens: 1200,
    system: [
      `You write business-to-business introduction emails for ${company.legalName}, a kitchen and interior joinery manufacturer in Bahrain. A person reviews and approves every email before it is sent.`,
      `Write one short, professional email (120–180 words) in ${c.language === "ar" ? "Arabic" : "English"} that can be sent to many businesses. Use these placeholders where useful: {company} (their company), {area} (their area), {type} (their kind of business). Do not write a greeting line, signature or unsubscribe text: they are added automatically. Offer a short call, a showroom visit or the company profile. Reply with JSON only: {"subject":"...","body":"..."}.`,
      "Facts you may use:",
      groundingFacts(),
      "Rules:",
      hardRules,
    ].join("\n\n"),
    user: `Campaign brief from the team: ${c.brief.slice(0, 2000)}\nAudience: ${audience.type ? prospectTypeNames[audience.type] : "mixed businesses"} in ${audience.country ? gccCountries[audience.country as keyof typeof gccCountries] : "Bahrain and the GCC"}.`,
  });
  const draft = parseAiJson(text, aiTemplate);
  await saveTemplate(db, actor, id, { subjectTemplate: draft.subject, bodyTemplate: draft.body });
  return draft;
}

/**
 * Creates one email per eligible prospect from the template (replacing earlier drafts). Returns how many
 * were prepared and how many matched but were left out by the per-campaign limit.
 */
export async function prepareCampaign(db: Db, actor: Actor, id: string, now = new Date()) {
  assertCan(actor, "marketing.manage");
  return db.$transaction(async (tx) => {
    const c = await draftCampaign(tx, id);
    if (!c.subjectTemplate || !c.bodyTemplate) throw new RuleError("noTemplate", "Write the email first.");
    const audience = audienceSchema.parse(c.audience);
    await tx.campaignMessage.deleteMany({ where: { campaignId: id, status: "draft" } });
    const where = eligibleWhere(audience, now);
    const [prospects, matching] = await Promise.all([
      tx.prospect.findMany({
        where,
        orderBy: [{ score: "desc" }, { createdAt: "asc" }],
        take: MAX_PER_CAMPAIGN,
      }),
      tx.prospect.count({ where }),
    ]);
    if (prospects.length === 0)
      throw new RuleError("nobody", "No prospect with an email address matches this audience now.");
    await tx.campaignMessage.createMany({
      data: prospects.map((p) => ({
        campaignId: id,
        prospectId: p.id,
        subject: fillTemplate(c.subjectTemplate!, p, c.language),
        body: fillTemplate(c.bodyTemplate!, p, c.language),
      })),
    });
    await audit(tx, {
      actorId: actor.id,
      action: "campaign.prepared",
      entityType: "campaign",
      entityId: id,
      changes: { emails: prospects.length },
    });
    return { prepared: prospects.length, leftOut: matching - prospects.length };
  });
}

export async function editCampaignMessage(
  db: Db,
  actor: Actor,
  messageId: string,
  input: { subject: string; body: string },
) {
  assertCan(actor, "marketing.manage");
  await db.$transaction(async (tx) => {
    const m = await tx.campaignMessage.findUnique({ where: { id: messageId }, include: { campaign: true } });
    if (!m) throw new NotFoundError("Email");
    if (m.campaign.status !== "draft" || m.status !== "draft")
      throw new RuleError("notDraft", "Only emails of a draft campaign can be edited.");
    await tx.campaignMessage.update({
      where: { id: messageId },
      data: { subject: input.subject.trim(), body: input.body.trim() },
    });
  });
}

export async function removeCampaignMessage(db: Db, actor: Actor, messageId: string) {
  assertCan(actor, "marketing.manage");
  await db.$transaction(async (tx) => {
    const m = await tx.campaignMessage.findUnique({ where: { id: messageId }, include: { campaign: true } });
    if (!m) throw new NotFoundError("Email");
    if (m.campaign.status !== "draft")
      throw new RuleError("notDraft", "Only emails of a draft campaign can be removed.");
    await tx.campaignMessage.delete({ where: { id: messageId } });
  });
}

export async function submitCampaign(db: Db, actor: Actor, id: string) {
  assertCan(actor, "marketing.manage");
  await db.$transaction(async (tx) => {
    const c = await draftCampaign(tx, id);
    const count = await tx.campaignMessage.count({ where: { campaignId: id } });
    if (count === 0) throw new RuleError("empty", "Prepare the emails first.");
    await tx.campaign.update({ where: { id }, data: { status: "pending_approval" } });
    const approvers = await tx.user.findMany({
      where: {
        kind: "staff",
        status: "active",
        roles: { some: { role: { permissions: { some: { permissionKey: "outreach.approve" } } } } },
      },
      select: { id: true },
    });
    for (const a of approvers)
      if (a.id !== actor.id)
        await notify(
          tx,
          a.id,
          `Campaign to approve: ${c.name}`,
          `/admin/marketing/campaigns/${id}`,
          `${count} email(s)`,
        );
    await audit(tx, {
      actorId: actor.id,
      action: "campaign.submitted",
      entityType: "campaign",
      entityId: id,
      changes: { emails: count },
    });
  });
}

/** Back to draft (by its author or an approver) to change it. */
export async function reopenCampaign(db: Db, actor: Actor, id: string) {
  assertCan(actor, "marketing.manage");
  await db.$transaction(async (tx) => {
    const c = await tx.campaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundError("Campaign");
    if (c.status !== "pending_approval" && c.status !== "rejected")
      throw new RuleError("state", "Only a campaign waiting for approval or rejected can go back to draft.");
    await tx.campaign.update({
      where: { id },
      data: { status: "draft", decidedAt: null, decidedById: null },
    });
    await audit(tx, { actorId: actor.id, action: "campaign.reopened", entityType: "campaign", entityId: id });
  });
}

/**
 * Approve (queue every email) or reject. Approval needs email sending set up, and drops emails to
 * prospects who became ineligible since preparing (unsubscribed, not interested, emailed elsewhere).
 */
export async function decideCampaign(
  db: Db,
  actor: Actor,
  id: string,
  input: { approve: boolean; note?: string },
  e: Pick<Env, "RESEND_API_KEY" | "EMAIL_FROM"> = readEnv(),
  now = new Date(),
) {
  assertCan(actor, "outreach.approve");
  if (input.approve && !emailReady(e))
    throw new RuleError(
      "emailOff",
      "Email sending isn't set up yet (Automation Centre → Integrations), so nothing can be sent.",
    );
  return db.$transaction(async (tx) => {
    const c = await tx.campaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundError("Campaign");
    if (c.status !== "pending_approval")
      throw new RuleError("state", "This campaign isn't waiting for approval.");
    let queued = 0;
    if (input.approve) {
      const stillEligible = await tx.prospect.findMany({
        where: { ...eligibleWhere({}, now), messages: { some: { campaignId: id } } },
        select: { id: true },
      });
      const ok = new Set(stillEligible.map((p) => p.id));
      const messages = await tx.campaignMessage.findMany({
        where: { campaignId: id, status: "draft" },
        select: { id: true, prospectId: true },
      });
      for (const m of messages) {
        if (ok.has(m.prospectId)) {
          await tx.campaignMessage.update({ where: { id: m.id }, data: { status: "queued" } });
          await enqueue(tx, "campaign.message", { campaignMessageId: m.id, campaignId: id });
          queued++;
        } else {
          await tx.campaignMessage.update({
            where: { id: m.id },
            data: { status: "skipped", error: "No longer eligible when approved." },
          });
        }
      }
    }
    await tx.campaign.update({
      where: { id },
      data: {
        status: input.approve ? (queued ? "approved" : "sent") : "rejected",
        decidedById: actor.id,
        decidedAt: now,
        decisionNote: input.note?.trim() || null,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: input.approve ? "campaign.approved" : "campaign.rejected",
      entityType: "campaign",
      entityId: id,
      changes: { queued, note: input.note?.trim() || null },
    });
    return { queued };
  });
}

/** Outbox delivery of one queued campaign email; marks the prospect contacted. */
export async function sendCampaignMessage(
  db: Db,
  e: Env,
  messageId: string,
  send = sendEmail,
): Promise<ChannelResult> {
  const m = await db.campaignMessage.findUnique({
    where: { id: messageId },
    include: { prospect: true, campaign: { select: { id: true, language: true } } },
  });
  if (!m || m.status !== "queued") return "skipped";
  if (!emailReady(e)) throw new Error("email not configured");
  const p = m.prospect;
  if (!p.email || p.unsubscribedAt || !["new", "contacted", "interested"].includes(p.status)) {
    await db.campaignMessage.update({
      where: { id: m.id },
      data: { status: "skipped", error: "No longer eligible." },
    });
    return "skipped";
  }
  try {
    await send(e, [p.email], m.subject, composeProspectEmail(m.body, p, m.campaign.language));
  } catch (error) {
    await db.campaignMessage.update({
      where: { id: m.id },
      data: { error: (error instanceof Error ? error.message : String(error)).slice(0, 300) },
    });
    throw error;
  }
  const sentAt = new Date();
  await db.$transaction(async (tx) => {
    await tx.campaignMessage.update({ where: { id: m.id }, data: { status: "sent", sentAt, error: null } });
    await tx.prospect.update({
      where: { id: p.id },
      data: {
        lastContactedAt: sentAt,
        ...(p.status === "new" ? { status: "contacted", score: Math.min(100, p.score + 5) } : {}),
      },
    });
    // The campaign is sent once nothing is left in the queue.
    const left = await tx.campaignMessage.count({ where: { campaignId: m.campaignId, status: "queued" } });
    if (left === 0)
      await tx.campaign.updateMany({
        where: { id: m.campaignId, status: "approved" },
        data: { status: "sent" },
      });
  });
  return "sent";
}

export async function listCampaigns(db: Db, actor: Actor) {
  assertCan(actor, "marketing.manage");
  const campaigns = await db.campaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { createdBy: { select: { name: true } } },
  });
  const counts = await db.campaignMessage.groupBy({
    by: ["campaignId", "status"],
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
    _count: { _all: true },
  });
  return campaigns.map((c) => ({
    ...c,
    counts: Object.fromEntries(
      counts.filter((x) => x.campaignId === c.id).map((x) => [x.status, x._count._all]),
    ) as Record<string, number>,
  }));
}

export async function getCampaign(db: Db, actor: Actor, id: string) {
  assertCan(actor, "marketing.manage");
  const c = await db.campaign.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      decidedBy: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          prospect: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
              email: true,
              type: true,
              area: true,
              score: true,
            },
          },
        },
      },
    },
  });
  if (!c) throw new NotFoundError("Campaign");
  return c;
}

/** How many prospects the audience reaches now (shown while choosing it). */
export async function audienceSize(db: Db, actor: Actor, audience: Audience) {
  assertCan(actor, "marketing.manage");
  return db.prospect.count({ where: eligibleWhere(audience) });
}
