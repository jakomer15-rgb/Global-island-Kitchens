import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chatContactSchema } from "@/lib/chat";
import { settingDefaults } from "@/lib/site-settings";
import { createStaffUser } from "@/server/auth/accounts";
import { resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { createPrismaClient } from "@/server/db/client";
import type { Env } from "@/server/env";
import type { ChatLead } from "@/server/outbox/events";
import { defaultDelivery } from "@/server/outbox/worker";
import { updateSetting } from "@/server/settings/update";
import { analyseConversation, type Analysis } from "./analysis";
import { openConversation, saveVisitorTurn } from "./conversation";
import { submitChatContact } from "./leads";
import { chatLeadEmail, chatLeadRecipients, notifyChatLeadByEmail } from "./notify";
import { alertSalesTeamOnWhatsApp, leadAlertRequest, whatsappAlertsConfigured } from "./whatsapp-alert";

const db = createPrismaClient();
const uid = () => Math.random().toString(36).slice(2, 10);
const digits = () => String(Math.floor(Math.random() * 1e7)).padStart(7, "0");

let owner: Actor;
beforeAll(async () => {
  process.env.AI_PROVIDER = "mock";
  const id = await db.$transaction((tx) =>
    createStaffUser(tx, {
      email: `owner-${uid()}@example.test`,
      name: `Owner ${uid()}`,
      password: "a long test password",
      roleKeys: ["owner"],
      actorId: null,
      via: "test",
    }),
  );
  owner = resolveActor(await db.user.findUniqueOrThrow({ where: { id }, include: userWithRolesInclude }))!;
});
afterAll(async () => {
  await updateSetting(db, owner, "chatAgent", { ...settingDefaults.chatAgent, enabled: false });
  await db.$disconnect();
});

const setChat = (over: object = {}) =>
  updateSetting(db, owner, "chatAgent", { ...settingDefaults.chatAgent, enabled: true, ...over });

const reading: Analysis = {
  language: "ar",
  productKey: "woodenKitchens",
  productCategory: "L-shaped kitchen",
  dimensions: "4 m wall",
  designPreferences: "modern",
  materialPreferences: "white EGGER décor",
  location: "Riffa",
  budget: "about 3,000 BHD",
  timeline: "next month",
  summary: "Wants a modern L-shaped kitchen in Riffa next month.",
  temperature: "hot",
  temperatureReason: "Clear project, budget and timeline.",
};

const baseEnv = {
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "GIK <noreply@example.test>",
  NOTIFY_EMAILS: "fallback@example.test",
} as Env;

/** A chat lead whose chat was read, and the chat.lead event it queued. */
async function chatLead() {
  const { conversation } = await openConversation(db, { locale: "ar", ipHash: null });
  await saveVisitorTurn(db, conversation.id, { messages: [{ role: "user", text: "مطبخ" }] }, true);
  await analyseConversation(db, conversation.id, { force: true }, async () => reading);
  const phone = `+9733${digits()}`;
  const { reference } = await submitChatContact(
    db,
    chatContactSchema.parse({
      locale: "ar",
      reason: "quotation",
      name: "Fatima Test",
      phone,
      email: `fatima-${uid()}@example.test`,
      preferredContact: "whatsapp",
      consentWhatsapp: true,
      privacyAccepted: true,
      startedAt: Date.now() - 60_000,
    }),
    { conversationId: conversation.id, ipHash: null, verifiedFileIds: [] },
  );
  const lead = await db.lead.findUniqueOrThrow({ where: { reference: reference! } });
  const outbox = await db.outboxEvent.findFirstOrThrow({
    where: { type: "chat.lead", payload: { path: ["leadId"], equals: lead.id } },
  });
  return { lead, phone, event: outbox.payload as unknown as ChatLead, outboxId: outbox.id };
}

describe("sales team email for a chat lead", () => {
  it("is queued with the lead, with the customer's consent and no message to the customer", async () => {
    await setChat();
    const { event, lead, phone } = await chatLead();
    expect(event).toMatchObject({
      reference: lead.reference,
      reason: "quotation",
      newLead: true,
      preferredContact: "whatsapp",
      customer: { name: "Fatima Test", phone },
      consent: { email: false, whatsapp: true },
    });
  });

  it("has the customer, requirements, rating and summary, and links to the lead and chat", async () => {
    await setChat();
    const { event, lead, phone } = await chatLead();
    const sent: { to: string[]; subject: string; text: string }[] = [];
    const result = await notifyChatLeadByEmail(
      db,
      baseEnv,
      event,
      "https://gik.example/",
      async (_e, to, subject, text) => {
        sent.push({ to, subject, text });
      },
    );
    expect(result).toBe("sent");
    const [mail] = sent;
    expect(mail!.to).toEqual(["fallback@example.test"]);
    expect(mail!.subject).toBe(`New HOT chat lead · ${lead.reference} · L-shaped kitchen · Riffa`);
    for (const part of [
      "Name: Fatima Test",
      `Phone: ${phone}`,
      `WhatsApp: https://wa.me/${phone.slice(1)}`,
      "Rating: HOT",
      "Product: L-shaped kitchen",
      "Location: Riffa",
      "Dimensions: 4 m wall",
      "Budget: about 3,000 BHD",
      "Timeline: next month",
      "Prefers: WhatsApp",
      "Chat language: Arabic",
      "Wants a modern L-shaped kitchen in Riffa next month.",
      `https://gik.example/admin/leads/${lead.id}`,
      `https://gik.example/admin/ai-sales/chats/${event.conversationId}`,
    ])
      expect(mail!.text).toContain(part);
  });

  it("goes to the addresses set in the admin, else NOTIFY_EMAILS, and waits until email is set up", async () => {
    await setChat({ notifyEmails: ["sales@example.test", "gm@example.test"] });
    expect(await chatLeadRecipients(db, baseEnv)).toEqual(["sales@example.test", "gm@example.test"]);
    await setChat({ notifyEmails: [] });
    expect(await chatLeadRecipients(db, baseEnv)).toEqual(["fallback@example.test"]);
    const { event } = await chatLead();
    expect(
      await notifyChatLeadByEmail(db, { ...baseEnv, RESEND_API_KEY: undefined }, event, "https://x"),
    ).toBe("not_configured");
    expect(
      await notifyChatLeadByEmail(db, { ...baseEnv, NOTIFY_EMAILS: undefined }, event, "https://x"),
    ).toBe("not_configured");
  });

  it("is delivered by the outbox once, even when another channel fails and is retried", async () => {
    await setChat();
    const { event, outboxId } = await chatLead();
    // No real service is contacted: no mail key, no WhatsApp account, no n8n.
    const deliver = defaultDelivery(
      { ...baseEnv, RESEND_API_KEY: undefined, N8N_WEBHOOK_URL: undefined } as Env,
      "https://gik.example",
      db,
    );
    // Without a mail provider the email is reported as not configured, and the event still completes.
    const result = await deliver({ id: outboxId, type: "chat.lead", payload: event }, {});
    expect(result.staffEmail).toBe("not_configured");
    expect(result.staffWhatsApp).toBe("not_configured");
    expect(result.n8n).toBe("not_configured");
    // A channel already sent is never repeated on a retry.
    const again = await deliver({ id: outboxId, type: "chat.lead", payload: event }, { staffEmail: "sent" });
    expect(again.staffEmail).toBe("sent");
  });

  it("says when it is a returning customer", () => {
    const { subject, text } = chatLeadEmail(
      {
        leadId: "l1",
        reference: "GIK-Q-2026-00001",
        conversationId: "c1",
        reason: "callback",
        newLead: false,
        locale: "en",
        customer: { name: "Ali", phone: "+97334597636", email: null },
        preferredContact: "call",
        customerId: "x",
        consent: { email: false, whatsapp: false },
        unsubscribeUrl: null,
      },
      { temperature: null, requirements: null, summary: null, language: null, photos: 0, assignedTo: "Sara" },
      "https://gik.example",
    );
    expect(subject).toBe("Returning customer in the chat · GIK-Q-2026-00001");
    expect(text).toContain("Rating: Not rated yet");
    expect(text).toContain("Email: —");
    expect(text).toContain("Assigned to: Sara");
  });
});

describe("WhatsApp alerts to the sales team (prepared)", () => {
  const waEnv = {
    WHATSAPP_ACCESS_TOKEN: "token-for-tests-1234567890",
    WHATSAPP_PHONE_NUMBER_ID: "1234567890",
    WHATSAPP_LEAD_TEMPLATE: "new_lead_alert",
    WHATSAPP_TEMPLATE_LANGUAGE: "en",
    WHATSAPP_GRAPH_VERSION: "v21.0",
  };

  it("are off until the account, template and staff numbers are set", async () => {
    expect(whatsappAlertsConfigured({ ...waEnv, WHATSAPP_LEAD_TEMPLATE: undefined })).toBe(false);
    await setChat({ notifyWhatsApp: [] });
    const { event } = await chatLead();
    let calls = 0;
    const fake = (async () => {
      calls++;
      return new Response("{}");
    }) as typeof fetch;
    expect(await alertSalesTeamOnWhatsApp(db, waEnv, event, fake)).toBe("not_configured");
    expect(calls).toBe(0);
  });

  it("send the approved template to each staff number, one line per parameter", async () => {
    await setChat({ notifyWhatsApp: ["97334597636", "97377901988"] });
    const { event, lead } = await chatLead();
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return new Response("{}");
    }) as unknown as typeof fetch;
    expect(await alertSalesTeamOnWhatsApp(db, waEnv, event, fake)).toBe("sent");
    expect(calls.map((c) => c.body.to)).toEqual(["97334597636", "97377901988"]);
    expect(calls[0]!.url).toBe("https://graph.facebook.com/v21.0/1234567890/messages");
    expect(calls[0]!.body).toMatchObject({
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: "new_lead_alert",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "HOT" },
              { type: "text", text: lead.reference },
              { type: "text", text: "L-shaped kitchen, Riffa, about 3,000 BHD" },
              { type: "text", text: `Fatima Test ${event.customer.phone}` },
            ],
          },
        ],
      },
    });
  });

  it("report a refusal without Meta's response text", async () => {
    await setChat({ notifyWhatsApp: ["97334597636"] });
    const { event } = await chatLead();
    const fake = (async () => new Response("secret details", { status: 401 })) as typeof fetch;
    await expect(alertSalesTeamOnWhatsApp(db, waEnv, event, fake)).rejects.toThrow("WhatsApp responded 401");
  });

  it("keep parameters on one line", () => {
    const { init } = leadAlertRequest(waEnv, "97334597636", ["HOT", "R", "a\nb\tc", "x".repeat(300)]);
    const params = JSON.parse(init.body).template.components[0].parameters;
    expect(params[2].text).toBe("a b c");
    expect(params[3].text).toHaveLength(200);
  });
});
