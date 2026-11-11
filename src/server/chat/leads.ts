import type { ChatContact, ContactReason } from "@/lib/chat";
import { audit } from "@/server/audit";
import { consentFields } from "@/server/consent";
import { enqueue } from "@/server/outbox/events";
import type { Db } from "@/server/db/client";
import { createLead, findOrCreateCustomer, inTransaction, recordConsent } from "@/server/enquiries/submit";
import { RuleError } from "@/server/errors";
import { applyAnalysisToLead, storedAnalysis } from "./analysis";
import { saveVisitorTurn } from "./conversation";
import { HANDOVER_REASONS, requestHandover } from "./handover";

/**
 * The sales chat's contact form → the CRM. One transaction: customer (found by phone, then email),
 * lead, consent, photos, a note on the lead and an event in the transcript. Duplicates are avoided:
 * a second form from the same conversation, or from a customer who already has an open lead from the
 * last 60 days, is added to that lead instead of creating another.
 */

export const reasonLabel: Record<ContactReason, string> = {
  quotation: "Wants a quotation",
  callback: "Asked for a callback",
  showroom_visit: "Wants to visit the showroom",
  human: "Wants to talk to the sales team",
};
const contactLabel = { whatsapp: "WhatsApp", call: "Phone call", email: "Email" } as const;

/** Leads still being worked: a new chat from the same customer joins them. */
const OPEN_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "site_visit",
  "measurement",
  "quoted",
  "negotiation",
] as const;
const REUSE_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

export async function submitChatContact(
  db: Db,
  input: ChatContact,
  ctx: {
    conversationId: string;
    /** The conversation was opened for this form: save everything the window showed. */
    newConversation?: boolean;
    ipHash: string | null;
    verifiedFileIds: string[];
  },
  now = new Date(),
): Promise<{ reference: string | null; created: boolean }> {
  return inTransaction(db, async (tx) => {
    const conversation = await tx.chatConversation.findUnique({ where: { id: ctx.conversationId } });
    if (!conversation) throw new RuleError("noConversation");
    // Quick options and cards shown since the last reply, in the same transaction (a retried form
    // can't save them twice).
    await saveVisitorTurn(tx, conversation.id, input, Boolean(ctx.newConversation));

    // Nobody's phone or email is verified in a chat: a form that matches an existing customer must not
    // change what we hold for them (consent, an open lead's rating and requirements) or tell the
    // visitor that customer's reference. Staff see the details and confirm them.
    const knownCustomer = await tx.customer.findFirst({
      where: { OR: [{ phone: input.phone }, ...(input.email ? [{ email: input.email }] : [])] },
      select: { id: true },
    });
    const customer = await findOrCreateCustomer(tx, {
      name: input.name,
      phone: input.phone,
      email: input.email,
      locale: input.locale,
    });

    // 1. This conversation already has a lead; 2. the customer has a recent open lead; 3. a new one.
    const linked = conversation.leadId
      ? await tx.lead.findFirst({ where: { id: conversation.leadId, archivedAt: null } })
      : null;
    const joined = linked
      ? conversation.leadJoined
        ? linked
        : null
      : await tx.lead.findFirst({
          where: {
            customerId: customer.id,
            archivedAt: null,
            status: { in: [...OPEN_STATUSES] },
            createdAt: { gte: new Date(now.getTime() - REUSE_WINDOW_MS) },
          },
          orderBy: { createdAt: "desc" },
        });
    const existing = linked ?? joined;

    const analysis = storedAnalysis(conversation);
    const headline = `${reasonLabel[input.reason]} (AI chat)`;
    const lead =
      existing ??
      (await createLead(tx, {
        prefix: "A",
        source: "website_chat",
        customerId: customer.id,
        category: analysis?.productKey ?? undefined,
        summary: analysis?.summary ? `${headline}: ${analysis.summary}`.slice(0, 500) : headline,
        locale: input.locale,
      }));

    await tx.chatConversation.update({
      where: { id: conversation.id },
      data: { leadId: lead.id, customerId: customer.id, leadJoined: Boolean(joined) },
    });
    // Another conversation's lead keeps its own reading; this chat's summary goes in the note below.
    if (analysis && !joined) await applyAnalysisToLead(tx, lead.id, analysis);

    if (ctx.verifiedFileIds.length) {
      const { count } = await tx.fileAsset.updateMany({
        where: {
          id: { in: ctx.verifiedFileIds },
          status: "verified",
          quotationRequestId: null,
          chatConversationId: null,
        },
        data: { chatConversationId: conversation.id, ticketHash: null },
      });
      if (count !== ctx.verifiedFileIds.length) throw new RuleError("fileMissing");
    }

    // What the visitor typed, kept verbatim on the lead (the customer record may predate it).
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        kind: "message",
        internal: false,
        body: [
          `${headline}${joined ? " — from a new chat, added to this lead" : ""}`,
          knownCustomer
            ? "Matches an existing customer by phone or email. Chat details are not verified: confirm with the customer before sharing anything about their project."
            : null,
          `Name: ${input.name}`,
          `Phone: ${input.phone}`,
          input.email ? `Email: ${input.email}` : null,
          input.area ? `Area: ${input.area}` : null,
          `Prefers: ${contactLabel[input.preferredContact]}`,
          ctx.verifiedFileIds.length ? `Reference photos: ${ctx.verifiedFileIds.length}` : null,
          input.message ? `\n${input.message}` : null,
          analysis?.summary ? `\nChat summary (AI): ${analysis.summary}` : null,
          knownCustomer && (input.consentEmail || input.consentWhatsapp)
            ? `\nTicked: ${[input.consentEmail && "email updates", input.consentWhatsapp && "WhatsApp updates"].filter(Boolean).join(" and ")}. Not recorded, because the details are not verified: ask the customer.`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
    // "Talk to a person" / "call me back": the team is alerted and a follow-up is due within two hours.
    if ((HANDOVER_REASONS as readonly string[]).includes(input.reason))
      await requestHandover(tx, lead, input.reason, now);
    // Consent is recorded only for a customer this form created.
    if (!knownCustomer) await recordConsent(tx, customer.id, input, "website_chat", ctx.ipHash);
    // Sales-team email (and WhatsApp alert, once set up) and the n8n event, delivered by the outbox.
    await enqueue(tx, "chat.lead", {
      leadId: lead.id,
      reference: lead.reference,
      conversationId: conversation.id,
      reason: input.reason,
      newLead: !existing,
      locale: input.locale,
      customer: { name: input.name, phone: input.phone, email: input.email ?? null },
      preferredContact: input.preferredContact,
      ...(await consentFields(tx, customer.id)),
    });
    // The transcript shows that the form was sent, without the details.
    await tx.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: "event",
        content: `Contact form sent (${reasonLabel[input.reason].toLowerCase()}), reference ${lead.reference}${ctx.verifiedFileIds.length ? `, ${ctx.verifiedFileIds.length} photo(s)` : ""}.`,
      },
    });
    await audit(tx, {
      actorId: null,
      action: existing ? "enquiry.updated_from_chat" : "enquiry.received",
      entityType: "lead",
      entityId: lead.id,
      changes: { kind: "chat", reference: lead.reference, reason: input.reason },
      ipHash: ctx.ipHash,
    });
    // The visitor sees the reference only for a lead this conversation started.
    return { reference: joined ? null : lead.reference, created: !existing };
  });
}
