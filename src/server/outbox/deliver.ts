import { company } from "@/config/company";
import { parseSetting } from "@/lib/site-settings";
import type { Db, Tx } from "@/server/db/client";
import type { Env } from "@/server/env";
import type { EnquiryReceived } from "./events";
import { signWebhook } from "./signature";

export type ChannelResult = "sent" | "not_configured" | "skipped";

const kindLabel = {
  quote: { en: "quotation request", ar: "طلب عرض السعر" },
  consultation: { en: "consultation request", ar: "طلب الاستشارة" },
  contact: { en: "message", ar: "رسالتكم" },
} as const;

export type SendEmail = (
  e: Env,
  to: string[],
  subject: string,
  text: string,
  options?: { replyTo?: string | null },
) => Promise<void>;

/**
 * Sends one email through Resend. Emails to customers and prospects set Reply-To to the company's own
 * inbox (the sending address has no mailbox), so answers reach the team.
 */
export const sendEmail: SendEmail = async (e, to, subject, text, options) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: e.EMAIL_FROM,
      to,
      subject,
      text,
      ...(options?.replyTo ? { reply_to: options.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Email provider responded ${res.status}`);
};

/** Where customers' replies go: the company email in Settings → Contact (the public company address). */
export async function replyToAddress(db?: Db | Tx): Promise<string> {
  if (!db) return company.email;
  const row = await db.siteSetting.findUnique({ where: { key: "contact" } });
  return parseSetting("contact", row?.value).email;
}

const emailReady = (e: Env) => Boolean(e.RESEND_API_KEY && e.EMAIL_FROM);

/** Notifies staff of a new enquiry (NOTIFY_EMAILS). No personal data beyond what staff need. */
export async function notifyStaff(e: Env, event: EnquiryReceived, siteUrl: string): Promise<ChannelResult> {
  const to = (e.NOTIFY_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!emailReady(e) || to.length === 0) return "not_configured";
  const text = [
    `New ${kindLabel[event.kind].en}: ${event.reference}`,
    "",
    `Name: ${event.customer.name}`,
    event.customer.phone ? `Phone: ${event.customer.phone}` : null,
    event.customer.email ? `Email: ${event.customer.email}` : null,
    `Language: ${event.locale === "ar" ? "Arabic" : "English"}`,
    "",
    event.summary,
    "",
    `Open in the admin: ${siteUrl}/admin?ref=${encodeURIComponent(event.reference)}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
  await sendEmail(e, to, `New ${kindLabel[event.kind].en} ${event.reference}`, text);
  return "sent";
}

/** Confirms receipt to the customer when they gave an email address. */
export async function confirmToCustomer(
  e: Env,
  event: EnquiryReceived,
  replyTo: string = company.email,
): Promise<ChannelResult> {
  if (!event.customer.email) return "skipped";
  if (!emailReady(e)) return "not_configured";
  const ar = event.locale === "ar";
  const label = kindLabel[event.kind][event.locale];
  const subject = ar
    ? `استلمنا ${label} – ${event.reference}`
    : `We received your ${label} – ${event.reference}`;
  const text = ar
    ? `مرحبًا،\n\nشكرًا لتواصلكم مع Global Island Kitchens. استلمنا ${label} برقم المرجع ${event.reference}، وسيتواصل معكم فريقنا قريبًا.\n\nللاستفسار: 3459 7636 / 7790 1988\nglobalkitchen.bh@gmail.com`
    : `Hello,\n\nThank you for contacting Global Island Kitchens. We received your ${label}, reference ${event.reference}, and our team will be in touch.\n\nQuestions: 3459 7636 / 7790 1988\nglobalkitchen.bh@gmail.com`;
  await sendEmail(e, [event.customer.email], subject, text, { replyTo });
  return "sent";
}

/** Signed webhook for n8n: X-GIK-Signature = HMAC-SHA256(secret, `${timestamp}.${body}`). */
export async function postToN8n(
  e: Env,
  type: string,
  eventId: string,
  payload: unknown,
): Promise<ChannelResult> {
  if (!e.N8N_WEBHOOK_URL || !e.N8N_WEBHOOK_SECRET) return "not_configured";
  const body = JSON.stringify({ id: eventId, type, payload });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signWebhook(e.N8N_WEBHOOK_SECRET, timestamp, body);
  const res = await fetch(e.N8N_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-gik-event": type,
      "x-gik-timestamp": timestamp,
      "x-gik-signature": signature,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`n8n responded ${res.status}`);
  return "sent";
}
