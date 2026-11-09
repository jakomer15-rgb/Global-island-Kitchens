import { parseSetting } from "@/lib/site-settings";
import type { Db } from "@/server/db/client";
import type { Env } from "@/server/env";
import type { ChannelResult } from "@/server/outbox/deliver";
import type { ChatLead } from "@/server/outbox/events";
import { loadChatLeadDetails } from "./notify";

/**
 * New-lead alerts to the sales team's own WhatsApp numbers, through the WhatsApp Business Cloud API.
 * PREPARED, NOT YET TESTED AGAINST META: it needs the owner's WhatsApp Business account, a permanent
 * access token, the sending number's id and an approved "utility" template. Until all of that is set
 * (env) and staff numbers are entered (Admin → AI agent), it reports "not_configured" and sends
 * nothing. It never messages customers: that stays with staff or an owner-approved n8n workflow that
 * checks consent first (docs/n8n/README.md).
 *
 * The template needs four body parameters, in this order:
 *   {{1}} rating (HOT / WARM / COLD), {{2}} reference, {{3}} what they want, {{4}} customer name and phone.
 * Suggested text: "New {{1}} website lead {{2}}: {{3}}. Customer: {{4}}. Open the admin to follow up."
 */

type WhatsAppEnv = Pick<
  Env,
  | "WHATSAPP_ACCESS_TOKEN"
  | "WHATSAPP_PHONE_NUMBER_ID"
  | "WHATSAPP_LEAD_TEMPLATE"
  | "WHATSAPP_TEMPLATE_LANGUAGE"
  | "WHATSAPP_GRAPH_VERSION"
>;

export function whatsappAlertsConfigured(e: WhatsAppEnv): boolean {
  return Boolean(e.WHATSAPP_ACCESS_TOKEN && e.WHATSAPP_PHONE_NUMBER_ID && e.WHATSAPP_LEAD_TEMPLATE);
}

/** WhatsApp template parameters can't hold new lines or long text. */
const param = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 200) || "-";

/** The Cloud API request for one alert (a template message). */
export function leadAlertRequest(e: WhatsAppEnv, to: string, values: [string, string, string, string]) {
  return {
    url: `https://graph.facebook.com/${e.WHATSAPP_GRAPH_VERSION}/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    init: {
      method: "POST",
      headers: {
        authorization: `Bearer ${e.WHATSAPP_ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: e.WHATSAPP_LEAD_TEMPLATE,
          language: { code: e.WHATSAPP_TEMPLATE_LANGUAGE },
          components: [
            { type: "body", parameters: values.map((text) => ({ type: "text", text: param(text) })) },
          ],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    } satisfies RequestInit,
  };
}

export async function alertSalesTeamOnWhatsApp(
  db: Db,
  e: WhatsAppEnv,
  event: ChatLead,
  send: typeof fetch = fetch,
): Promise<ChannelResult> {
  if (!whatsappAlertsConfigured(e)) return "not_configured";
  const row = await db.siteSetting.findUnique({ where: { key: "chatAgent" } });
  const numbers = parseSetting("chatAgent", row?.value).notifyWhatsApp;
  if (numbers.length === 0) return "not_configured";
  const d = await loadChatLeadDetails(db, event);
  const wants = [d.requirements?.productCategory, d.requirements?.location, d.requirements?.budget]
    .filter(Boolean)
    .join(", ");
  const values: [string, string, string, string] = [
    d.temperature ? d.temperature.toUpperCase() : "new",
    event.reference,
    wants || "see the admin",
    `${event.customer.name} ${event.customer.phone}`,
  ];
  for (const to of numbers) {
    const { url, init } = leadAlertRequest(e, to, values);
    const res = await send(url, init);
    // Meta's error body can echo the request: only the status is reported.
    if (!res.ok) throw new Error(`WhatsApp responded ${res.status}`);
  }
  return "sent";
}
