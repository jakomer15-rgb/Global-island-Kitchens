import { parseSetting } from "@/lib/site-settings";
import type { Db } from "@/server/db/client";
import type { Env } from "@/server/env";
import { sendEmail, type ChannelResult } from "@/server/outbox/deliver";
import type { ChatLead } from "@/server/outbox/events";
import { reasonLabel } from "./leads";

/**
 * The sales team's email for a chat lead. Built when the outbox sends it, from the lead as it is
 * then: the AI reading (requirements, rating, summary) normally finishes a moment after the form.
 * Plain text, so it reads well in any mail app and on a phone.
 */

export interface ChatLeadDetails {
  temperature: "hot" | "warm" | "cold" | null;
  requirements: {
    productCategory: string | null;
    dimensions: string | null;
    designPreferences: string | null;
    materialPreferences: string | null;
    location: string | null;
    budget: string | null;
    timeline: string | null;
  } | null;
  summary: string | null;
  language: string | null;
  photos: number;
  assignedTo: string | null;
}

export async function loadChatLeadDetails(db: Db, event: ChatLead): Promise<ChatLeadDetails> {
  const [lead, chat] = await Promise.all([
    db.lead.findUnique({
      where: { id: event.leadId },
      select: { temperature: true, requirements: true, assignedTo: { select: { name: true } } },
    }),
    db.chatConversation.findUnique({
      where: { id: event.conversationId },
      select: {
        summary: true,
        language: true,
        _count: { select: { files: { where: { status: "verified" } } } },
      },
    }),
  ]);
  return {
    temperature: lead?.temperature ?? null,
    requirements: lead?.requirements ?? null,
    summary: chat?.summary ?? null,
    language: chat?.language ?? null,
    photos: chat?._count.files ?? 0,
    assignedTo: lead?.assignedTo?.name ?? null,
  };
}

const languageName: Record<string, string> = { en: "English", ar: "Arabic", hi: "Hindi", ur: "Urdu" };
const contactLabel = { whatsapp: "WhatsApp", call: "a phone call", email: "email" } as const;

export function chatLeadEmail(event: ChatLead, d: ChatLeadDetails, siteUrl: string) {
  const base = siteUrl.replace(/\/$/, "");
  const rating = d.temperature ? d.temperature.toUpperCase() : "Not rated yet";
  const r = d.requirements;
  const product = r?.productCategory ?? null;
  const subject = [
    event.newLead ? `New ${d.temperature ? `${rating} ` : ""}chat lead` : "Returning customer in the chat",
    event.reference,
    product,
    r?.location,
  ]
    .filter(Boolean)
    .join(" · ");
  const row = (label: string, value: string | null | undefined) => `${label}: ${value?.trim() || "—"}`;
  const digits = event.customer.phone.replace(/\D/g, "");
  const text = [
    event.newLead
      ? "A visitor to the website's AI chat (GIK Smart Assistant) asked our team to contact them."
      : "A customer with an open lead chatted again on the website and sent the contact form. It was added to their lead.",
    "",
    row("Reference", event.reference),
    row("Rating", rating),
    row("Request", reasonLabel[event.reason]),
    "",
    "CUSTOMER",
    row("Name", event.customer.name),
    row("Phone", event.customer.phone),
    `WhatsApp: https://wa.me/${digits}`,
    row("Email", event.customer.email),
    row("Prefers", contactLabel[event.preferredContact]),
    row("Chat language", d.language ? (languageName[d.language] ?? "Other") : null),
    "",
    "WHAT THEY WANT",
    row("Product", product),
    row("Location", r?.location),
    row("Dimensions", r?.dimensions),
    row("Budget", r?.budget),
    row("Timeline", r?.timeline),
    row("Design", r?.designPreferences),
    row("Materials", r?.materialPreferences),
    row("Reference photos", d.photos ? String(d.photos) : "none"),
    "",
    "CHAT SUMMARY",
    d.summary ?? "Not available yet: read the conversation in the admin.",
    "",
    "The rating, requirements and summary were noted by the AI assistant from the chat. Check them with the customer.",
    `Assigned to: ${d.assignedTo ?? "nobody yet"}`,
    "",
    `Open the lead: ${base}/admin/leads/${event.leadId}`,
    `Read the conversation: ${base}/admin/ai-sales/chats/${event.conversationId}`,
  ].join("\n");
  return { subject, text };
}

/** Admin → AI agent addresses, or the server's NOTIFY_EMAILS when none are set there. */
export async function chatLeadRecipients(db: Db, e: Pick<Env, "NOTIFY_EMAILS">): Promise<string[]> {
  const row = await db.siteSetting.findUnique({ where: { key: "chatAgent" } });
  const fromAdmin = parseSetting("chatAgent", row?.value).notifyEmails;
  if (fromAdmin.length) return fromAdmin;
  return (e.NOTIFY_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function notifyChatLeadByEmail(
  db: Db,
  e: Env,
  event: ChatLead,
  siteUrl: string,
  send: typeof sendEmail = sendEmail,
): Promise<ChannelResult> {
  if (!e.RESEND_API_KEY || !e.EMAIL_FROM) return "not_configured";
  const to = await chatLeadRecipients(db, e);
  if (to.length === 0) return "not_configured";
  const { subject, text } = chatLeadEmail(event, await loadChatLeadDetails(db, event), siteUrl);
  await send(e, to, subject, text);
  return "sent";
}
