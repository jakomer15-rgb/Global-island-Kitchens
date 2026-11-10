import { z } from "zod";
import { company } from "@/config/company";
import type { CustomerMessageStatus } from "@/generated/prisma/client";
import { parseSetting } from "@/lib/site-settings";
import { aiAvailable, leadContext } from "@/server/ai/drafts";
import { groundingFacts, hardRules, redactContact } from "@/server/ai/grounding";
import { aiConfigured, aiGenerate, parseAiJson, type AiGenerate } from "@/server/ai/provider";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import { consentSnapshot, unsubscribeUrl } from "@/server/consent";
import { notify } from "@/server/crm/shared";
import type { Db, Tx } from "@/server/db/client";
import { env as readEnv, type Env } from "@/server/env";
import { NotFoundError, RuleError } from "@/server/errors";
import { sendEmail, type ChannelResult } from "@/server/outbox/deliver";
import { enqueue } from "@/server/outbox/events";
import { rateLimit } from "@/server/rate-limit";

/**
 * Messages to customers (Stage 4). Staff write one, or ask the AI to draft it; it waits for someone
 * with `outreach.approve`; approving queues it and the outbox sends it by email. Rules enforced here
 * and checked again at sending time:
 * - only to customers with an email address and email consent on record (latest record wins);
 * - every email carries an unsubscribe link;
 * - nothing is sent without a person's approval; a sent message can't be changed (DB trigger).
 * WhatsApp messages to customers need Meta-approved templates and are not sent from here yet.
 */

export const OPEN_FOR_FOLLOW_UP = [
  "contacted",
  "qualified",
  "site_visit",
  "measurement",
  "quoted",
  "negotiation",
] as const;

export function emailReady(e: Pick<Env, "RESEND_API_KEY" | "EMAIL_FROM">): boolean {
  return Boolean(e.RESEND_API_KEY && e.EMAIL_FROM);
}

/** Can this customer be emailed? The reason is shown to staff when not. */
export async function emailEligibility(
  tx: Tx,
  customerId: string,
): Promise<{ ok: true; email: string } | { ok: false; reason: string }> {
  const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { email: true } });
  if (!customer?.email) return { ok: false, reason: "The customer has no email address." };
  const consent = await consentSnapshot(tx, customerId);
  if (!consent.email) return { ok: false, reason: "The customer hasn't agreed to email (or withdrew it)." };
  return { ok: true, email: customer.email };
}

async function approvers(tx: Tx) {
  return tx.user.findMany({
    where: {
      kind: "staff",
      status: "active",
      roles: { some: { role: { permissions: { some: { permissionKey: "outreach.approve" } } } } },
    },
    select: { id: true },
  });
}

async function createMessage(
  tx: Tx,
  input: {
    leadId: string;
    subject: string;
    body: string;
    language: "en" | "ar";
    origin: "staff" | "ai" | "auto_follow_up";
    createdById: string | null;
  },
) {
  const lead = await tx.lead.findFirst({
    where: { id: input.leadId, archivedAt: null },
    select: { id: true, reference: true, customerId: true },
  });
  if (!lead) throw new NotFoundError("Lead");
  const eligible = await emailEligibility(tx, lead.customerId);
  if (!eligible.ok) throw new RuleError("noConsent", eligible.reason);
  const message = await tx.customerMessage.create({
    data: {
      leadId: lead.id,
      customerId: lead.customerId,
      channel: "email",
      subject: input.subject.trim(),
      body: input.body.trim(),
      language: input.language,
      origin: input.origin,
      createdById: input.createdById,
    },
  });
  for (const a of await approvers(tx))
    if (a.id !== input.createdById)
      await notify(
        tx,
        a.id,
        `Message to approve: ${lead.reference}`,
        `/admin/leads/${lead.id}#messages`,
        input.subject,
      );
  await audit(tx, {
    actorId: input.createdById,
    action: "customer_message.created",
    entityType: "customer_message",
    entityId: message.id,
    changes: { leadId: lead.id, origin: input.origin, subject: message.subject },
  });
  return message;
}

export const messageInput = z.object({
  subject: z.string().trim().min(3, "Write a subject.").max(200),
  body: z.string().trim().min(10, "Write the message.").max(5000),
  language: z.enum(["en", "ar"]),
});

/** Staff write a message; it waits for approval. */
export async function writeMessage(
  db: Db,
  actor: Actor,
  leadId: string,
  input: z.infer<typeof messageInput>,
) {
  assertCan(actor, "lead.update");
  return db.$transaction((tx) =>
    createMessage(tx, { leadId, ...input, origin: "staff", createdById: actor.id }),
  );
}

const aiMessageSchema = z.object({
  language: z.enum(["en", "ar"]),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(2500),
});

async function generateMessage(db: Db, leadId: string, instruction: string, generate: AiGenerate) {
  const { lead, text } = await leadContext(db, leadId);
  const { text: answer } = await generate({
    task: "customer_message",
    maxTokens: 900,
    system: [
      `You write emails for the sales team of ${company.legalName} in Bahrain. A person reviews every email before it is sent.`,
      'Write a short, warm, professional follow-up email to the customer in their preferred language: remind them of their enquiry, offer the next step (a call, a showroom, site or online consultation, or sending measurements or drawings) and invite them to reply. Do not start with a greeting line or end with a signature: they are added automatically. Reply with JSON only: {"language":"en"|"ar","subject":"...","body":"..."}.',
      "Facts you may use:",
      groundingFacts(),
      "Rules:",
      hardRules,
    ].join("\n\n"),
    user: `${text}${instruction ? `\n\nStaff instruction: ${redactContact(instruction.replace(/\s+/g, " ").slice(0, 300))}` : ""}`,
  });
  return { lead, draft: parseAiJson(answer, aiMessageSchema) };
}

/** Staff ask the AI for a draft; it is saved as a message waiting for approval (staff can edit or reject it). */
export async function draftMessageWithAi(
  db: Db,
  actor: Actor,
  leadId: string,
  instruction = "",
  generate: AiGenerate = aiGenerate,
) {
  assertCan(actor, "lead.update");
  assertCan(actor, "ai.use");
  if (!(await aiAvailable(db, "leadAssistant")))
    throw new RuleError("aiOff", "The AI assistant is switched off.");
  if (!(await rateLimit(db, `ai:${actor.id}`, 30, 60 * 60))) throw new RuleError("tooMany");
  const lead = await db.lead.findFirst({
    where: { id: leadId, archivedAt: null },
    select: { customerId: true },
  });
  if (!lead) throw new NotFoundError("Lead");
  // Checked before paying for a draft that couldn't be sent.
  const eligible = await emailEligibility(db, lead.customerId);
  if (!eligible.ok) throw new RuleError("noConsent", eligible.reason);
  const { draft } = await generateMessage(db, leadId, instruction, generate);
  return db.$transaction((tx) =>
    createMessage(tx, { leadId, ...draft, origin: "ai", createdById: actor.id }),
  );
}

/** The email as the customer receives it: greeting, the approved text, signature and unsubscribe link. */
export function composeEmail(
  m: { body: string; language: "en" | "ar"; customerId: string },
  customerName: string,
  base?: string,
) {
  const first = customerName.trim().split(/\s+/)[0] ?? "";
  const link = unsubscribeUrl(m.customerId, "email", base);
  return m.language === "ar"
    ? `مرحبًا ${first}،\n\n${m.body.trim()}\n\nمع أطيب التحيات،\nفريق المبيعات – Global Island Kitchens\n\nلإيقاف رسائل البريد الإلكتروني منا: ${link}`
    : `Dear ${first},\n\n${m.body.trim()}\n\nKind regards,\nThe sales team – Global Island Kitchens\n\nTo stop emails from us: ${link}`;
}

/**
 * Approve (queue for sending) or reject a message. Approval re-checks consent and needs email sending
 * to be set up, so an approved message is never left waiting silently.
 */
export async function decideMessage(
  db: Db,
  actor: Actor,
  id: string,
  input: { approve: boolean; note?: string; subject?: string; body?: string },
  e: Pick<Env, "RESEND_API_KEY" | "EMAIL_FROM"> = readEnv(),
) {
  assertCan(actor, "outreach.approve");
  if (input.approve && !emailReady(e))
    throw new RuleError(
      "emailOff",
      "Email sending isn't set up yet (Automation Centre → Integrations), so nothing can be sent.",
    );
  return db.$transaction(async (tx) => {
    const m = await tx.customerMessage.findUnique({ where: { id } });
    if (!m) throw new NotFoundError("Message");
    if (m.status !== "pending_approval") throw new RuleError("decided", "This message was already decided.");
    if (input.approve) {
      const eligible = await emailEligibility(tx, m.customerId);
      if (!eligible.ok) throw new RuleError("noConsent", eligible.reason);
    }
    const edited = input.approve && (input.subject !== undefined || input.body !== undefined);
    await tx.customerMessage.update({
      where: { id },
      data: {
        status: input.approve ? "approved" : "rejected",
        decidedById: actor.id,
        decidedAt: new Date(),
        decisionNote: input.note?.trim() || null,
        ...(edited
          ? { subject: input.subject?.trim() || m.subject, body: input.body?.trim() || m.body }
          : {}),
      },
    });
    if (input.approve) await enqueue(tx, "customer.message", { messageId: id, leadId: m.leadId });
    await audit(tx, {
      actorId: actor.id,
      action: input.approve ? "customer_message.approved" : "customer_message.rejected",
      entityType: "customer_message",
      entityId: id,
      changes: { edited, note: input.note?.trim() || null },
    });
  });
}

/** The writer (or an approver) withdraws a message before it is decided. */
export async function cancelMessage(db: Db, actor: Actor, id: string) {
  assertCan(actor, "lead.update");
  await db.$transaction(async (tx) => {
    const m = await tx.customerMessage.findUnique({ where: { id } });
    if (!m) throw new NotFoundError("Message");
    if (m.status !== "pending_approval") throw new RuleError("decided", "This message was already decided.");
    if (m.createdById !== actor.id && !actor.permissions.has("outreach.approve"))
      throw new RuleError("notYours", "Only the writer or an approver can cancel it.");
    await tx.customerMessage.update({ where: { id }, data: { status: "cancelled" } });
    await audit(tx, {
      actorId: actor.id,
      action: "customer_message.cancelled",
      entityType: "customer_message",
      entityId: id,
    });
  });
}

export async function messagesForLead(db: Db, actor: Actor, leadId: string) {
  assertCan(actor, "lead.read");
  return db.customerMessage.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } }, decidedBy: { select: { name: true } } },
  });
}

export async function pendingMessages(db: Db, actor: Actor, take = 100) {
  assertCan(actor, "outreach.approve");
  return db.customerMessage.findMany({
    where: { status: "pending_approval", lead: { archivedAt: null } },
    orderBy: { createdAt: "asc" },
    take,
    select: {
      id: true,
      subject: true,
      origin: true,
      createdAt: true,
      lead: { select: { id: true, reference: true } },
      customer: { select: { name: true } },
    },
  });
}

/**
 * Outbox delivery of an approved message. Consent is checked again (the customer may have
 * unsubscribed since); then the email is sent, the message marked sent and the email logged on the
 * lead (which updates its last contact).
 */
export async function sendCustomerMessage(
  db: Db,
  e: Env,
  messageId: string,
  send = sendEmail,
): Promise<ChannelResult> {
  const m = await db.customerMessage.findUnique({ where: { id: messageId }, include: { customer: true } });
  if (!m || m.status !== "approved") return "skipped";
  if (!emailReady(e)) throw new Error("email not configured");
  const eligible = await emailEligibility(db, m.customerId);
  if (!eligible.ok) {
    await db.customerMessage.update({
      where: { id: m.id },
      data: { status: "failed", error: eligible.reason },
    });
    return "skipped";
  }
  try {
    await send(e, [eligible.email], m.subject ?? "Global Island Kitchens", composeEmail(m, m.customer.name));
  } catch (error) {
    await db.customerMessage.update({
      where: { id: m.id },
      data: { error: (error instanceof Error ? error.message : String(error)).slice(0, 300) },
    });
    throw error;
  }
  await db.$transaction(async (tx) => {
    await tx.customerMessage.update({
      where: { id: m.id },
      data: { status: "sent", sentAt: new Date(), error: null },
    });
    await tx.leadActivity.create({
      data: {
        leadId: m.leadId,
        kind: "email",
        internal: false,
        authorId: m.decidedById,
        body: `Email sent (approved): ${m.subject}\n\n${m.body}`.slice(0, 6000),
      },
    });
  });
  return "sent";
}

/**
 * The daily job: for open leads with no contact for `afterDays` days, an email address and email
 * consent, the AI drafts a follow-up that waits for approval. Off unless the owner switched it on (and
 * the AI and email are set up). At most `limit` drafts per run; one waiting or recent message per lead.
 */
export async function draftNoResponseFollowUps(
  db: Db,
  options: { now?: Date; limit?: number; generate?: AiGenerate; env?: Env } = {},
) {
  const now = options.now ?? new Date();
  const e = options.env ?? readEnv();
  const row = await db.siteSetting.findUnique({ where: { key: "salesFollowUp" } });
  const setting = parseSetting("salesFollowUp", row?.value);
  if (!setting.autoDraft) return { drafted: 0, skipped: "off" as const };
  if (!aiConfigured(e) || !(await aiAvailable(db, "leadAssistant")))
    return { drafted: 0, skipped: "aiOff" as const };
  if (!emailReady(e)) return { drafted: 0, skipped: "emailOff" as const };
  const cutoff = new Date(now.getTime() - setting.afterDays * 24 * 60 * 60 * 1000);
  const candidates = await db.lead.findMany({
    where: {
      archivedAt: null,
      status: { in: [...OPEN_FOR_FOLLOW_UP] },
      lastContactAt: { lt: cutoff },
      customer: { email: { not: null }, archivedAt: null },
      messages: { none: { OR: [{ status: "pending_approval" }, { createdAt: { gte: cutoff } }] } },
    },
    orderBy: { lastContactAt: "asc" },
    take: (options.limit ?? 10) * 3,
    select: { id: true, customerId: true },
  });
  let drafted = 0;
  for (const lead of candidates) {
    if (drafted >= (options.limit ?? 10)) break;
    if (!(await emailEligibility(db, lead.customerId)).ok) continue;
    try {
      const { draft } = await generateMessage(db, lead.id, "", options.generate ?? aiGenerate);
      await db.$transaction((tx) =>
        createMessage(tx, { leadId: lead.id, ...draft, origin: "auto_follow_up", createdById: null }),
      );
      drafted++;
    } catch (error) {
      console.warn("Follow-up draft failed for a lead:", error instanceof Error ? error.message : "unknown");
    }
  }
  return { drafted, skipped: null };
}

export const messageStatusNames: Record<CustomerMessageStatus, string> = {
  pending_approval: "Waiting for approval",
  approved: "Approved, sending",
  sent: "Sent",
  failed: "Not sent",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
