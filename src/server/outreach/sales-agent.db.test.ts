import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { settingDefaults } from "@/lib/site-settings";
import type { AiGenerate } from "@/server/ai/provider";
import { createStaffUser } from "@/server/auth/accounts";
import { ForbiddenError, resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { approvalQueue, centreOverview } from "@/server/automation/overview";
import { requestHandover } from "@/server/chat/handover";
import { createPrismaClient } from "@/server/db/client";
import type { Env } from "@/server/env";
import { nextReference } from "@/server/enquiries/submit";
import {
  createDocument,
  searchKnowledge,
  setDocumentPublished,
  updateDocument,
} from "@/server/knowledge/documents";
import { updateSetting } from "@/server/settings/update";
import {
  cancelMessage,
  decideMessage,
  draftMessageWithAi,
  draftNoResponseFollowUps,
  sendCustomerMessage,
  writeMessage,
} from "./messages";

const db = createPrismaClient();
const uid = () => Math.random().toString(36).slice(2, 10);
const phone = () => `+9733${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const mailEnv = { RESEND_API_KEY: "re_test", EMAIL_FROM: "GIK <sales@gik.example>" } as unknown as Env;

async function staff(roleKeys: string[]): Promise<Actor> {
  const id = await db.$transaction((tx) =>
    createStaffUser(tx, {
      email: `s4-${uid()}@example.test`,
      name: `S4 ${uid()}`,
      password: "a long test password",
      roleKeys,
      actorId: null,
      via: "test",
    }),
  );
  return resolveActor(await db.user.findUniqueOrThrow({ where: { id }, include: userWithRolesInclude }))!;
}

async function leadFor(
  opts: { email?: string | null; consent?: boolean; status?: "contacted" | "new" } = {},
) {
  const c = await db.customer.create({
    data: {
      name: "Mariam Hasan",
      phone: phone(),
      email: opts.email === undefined ? `m-${uid()}@example.test` : opts.email,
    },
  });
  if (opts.consent !== false)
    await db.consentRecord.create({
      data: { customerId: c.id, channel: "email", granted: true, source: "website_quote" },
    });
  const lead = await db.lead.create({
    data: {
      reference: await nextReference(db, "M"),
      customerId: c.id,
      source: "phone",
      summary: "Kitchen",
      status: opts.status ?? "contacted",
    },
  });
  return { customer: c, lead };
}

let owner: Actor;
let sales: Actor;
let editor: Actor;
beforeAll(async () => {
  process.env.AI_PROVIDER = "mock";
  [owner, sales, editor] = await Promise.all([
    staff(["owner"]),
    staff(["sales_manager"]),
    staff(["content_editor"]),
  ]);
  await updateSetting(db, owner, "ai", { ...settingDefaults.ai, enabled: true, leadAssistant: true });
});
afterAll(async () => {
  await updateSetting(db, owner, "ai", settingDefaults.ai);
  await updateSetting(db, owner, "salesFollowUp", settingDefaults.salesFollowUp);
  await db.$disconnect();
});

describe("hand-over to a person", () => {
  it("flags the lead, adds a follow-up due within two hours and alerts the managers", async () => {
    const { lead } = await leadFor({ status: "new" });
    const now = new Date();
    await db.$transaction((tx) => requestHandover(tx, { ...lead, assignedToId: null }, "human", now));
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.handoverRequestedAt).toEqual(now);
    expect(after.nextFollowUpAt).toEqual(new Date(now.getTime() + 2 * 3600_000));
    expect(
      await db.notification.count({ where: { userId: sales.id, link: `/admin/leads/${lead.id}` } }),
    ).toBe(1);
    expect(
      await db.notification.count({ where: { userId: editor.id, link: `/admin/leads/${lead.id}` } }),
    ).toBe(0);
    expect((await centreOverview(db, owner)).handoversWaiting).toBeGreaterThan(0);
  });
});

describe("knowledge documents", () => {
  it("are searched only once published, never for pricing, and follow edits", async () => {
    const word = `zebrawood${uid()}`;
    const id = await createDocument(db, sales, {
      title: "Wardrobe brochure",
      kind: "brochure",
      fileName: "b.txt",
      mimeType: "text/plain",
      sizeBytes: 100,
      text: `Sliding wardrobes with ${word} décor.\n\nخزائن ملابس منزلقة ${word}`,
      extractedWith: "text",
      truncated: false,
    });
    expect(await searchKnowledge(db, `Do you have ${word}?`)).toEqual([]);
    expect(await setDocumentPublished(db, sales, id, true)).toBeGreaterThan(0);
    const hits = await searchKnowledge(db, `Do you have ${word} wardrobes?`);
    expect(hits[0]).toMatchObject({ title: "Wardrobe brochure" });
    expect(hits[0]!.content).toContain(word);

    const priceWord = `pricelist${uid()}`;
    const priceId = await createDocument(db, sales, {
      title: "Prices",
      kind: "pricing",
      fileName: "p.txt",
      mimeType: "text/plain",
      sizeBytes: 10,
      text: `Kitchen ${priceWord} 100 BHD per metre`,
      extractedWith: "text",
      truncated: false,
    });
    await setDocumentPublished(db, sales, priceId, true);
    expect(await searchKnowledge(db, priceWord)).toEqual([]);

    const newWord = `teakfree${uid()}`;
    await updateDocument(db, sales, id, {
      title: "Wardrobe brochure",
      kind: "brochure",
      text: `Now about ${newWord}.`,
    });
    expect(await searchKnowledge(db, word)).toEqual([]);
    expect((await searchKnowledge(db, newWord)).length).toBe(1);
    await setDocumentPublished(db, sales, id, false);
    expect(await searchKnowledge(db, newWord)).toEqual([]);

    await expect(setDocumentPublished(db, editor, id, true)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("messages to customers", () => {
  it("need an email address and consent", async () => {
    const none = await leadFor({ consent: false });
    await expect(
      writeMessage(db, sales, none.lead.id, {
        subject: "Your kitchen",
        body: "Can we book a visit?",
        language: "en",
      }),
    ).rejects.toThrow(/agreed to email/);
    const noEmail = await leadFor({ email: null });
    await expect(
      writeMessage(db, sales, noEmail.lead.id, {
        subject: "Your kitchen",
        body: "Can we book a visit?",
        language: "en",
      }),
    ).rejects.toThrow(/no email/);
  });

  it("wait for approval, are sent once approved, and logged on the lead", async () => {
    const { lead, customer } = await leadFor();
    const m = await writeMessage(db, sales, lead.id, {
      subject: "Your kitchen",
      body: "Can we book a site visit next week?",
      language: "en",
    });
    expect(m.status).toBe("pending_approval");
    expect(
      (await approvalQueue(db, owner)).items.some((i) => i.id === m.id && i.kind === "customer_message"),
    ).toBe(true);
    // The sales manager can't approve by default; nothing goes without email set up.
    await expect(decideMessage(db, sales, m.id, { approve: true }, mailEnv)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(decideMessage(db, owner, m.id, { approve: true }, {} as Env)).rejects.toThrow(
      /isn't set up/,
    );

    await decideMessage(
      db,
      owner,
      m.id,
      { approve: true, body: "Can we book a site visit on Sunday?" },
      mailEnv,
    );
    expect(
      await db.outboxEvent.count({
        where: { type: "customer.message", payload: { path: ["messageId"], equals: m.id } },
      }),
    ).toBe(1);
    await expect(decideMessage(db, owner, m.id, { approve: true }, mailEnv)).rejects.toThrow(
      /already decided/,
    );

    const send = vi.fn(async () => {});
    expect(await sendCustomerMessage(db, mailEnv as Env, m.id, send)).toBe("sent");
    const [, to, subject, text] = send.mock.calls[0] as unknown as [Env, string[], string, string];
    expect(to).toEqual([customer.email]);
    expect(subject).toBe("Your kitchen");
    expect(text).toMatch(/^Dear Mariam,\n\nCan we book a site visit on Sunday\?/);
    expect(text).toContain("/unsubscribe?token=");
    const sent = await db.customerMessage.findUniqueOrThrow({ where: { id: m.id } });
    expect(sent.status).toBe("sent");
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).lastContactAt).not.toBeNull();
    // Sending twice does nothing; a sent message can't be changed.
    expect(await sendCustomerMessage(db, mailEnv as Env, m.id, send)).toBe("skipped");
    await expect(
      db.customerMessage.update({ where: { id: m.id }, data: { body: "changed" } }),
    ).rejects.toThrow();
  });

  it("is not sent if the customer unsubscribed after approval", async () => {
    const { lead, customer } = await leadFor();
    const m = await writeMessage(db, sales, lead.id, {
      subject: "Hello",
      body: "Following up on your enquiry.",
      language: "en",
    });
    await decideMessage(db, owner, m.id, { approve: true }, mailEnv);
    await db.consentRecord.create({
      data: { customerId: customer.id, channel: "email", granted: false, source: "unsubscribe_link" },
    });
    const send = vi.fn(async () => {});
    expect(await sendCustomerMessage(db, mailEnv as Env, m.id, send)).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
    expect((await db.customerMessage.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("failed");
  });

  it("can be rejected or cancelled", async () => {
    const { lead } = await leadFor();
    const a = await writeMessage(db, sales, lead.id, {
      subject: "One",
      body: "First message text.",
      language: "en",
    });
    await decideMessage(db, owner, a.id, { approve: false, note: "Call instead" }, mailEnv);
    expect((await db.customerMessage.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("rejected");
    const b = await writeMessage(db, sales, lead.id, {
      subject: "Two",
      body: "Second message text.",
      language: "en",
    });
    await cancelMessage(db, sales, b.id);
    expect((await db.customerMessage.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("cancelled");
  });

  it("AI drafts wait for approval like any other message", async () => {
    const { lead } = await leadFor();
    const m = await draftMessageWithAi(db, owner, lead.id, "offer a showroom visit");
    expect(m).toMatchObject({
      origin: "ai",
      status: "pending_approval",
      subject: "Your enquiry with Global Island Kitchens",
    });
  });

  it("automatic follow-up drafts: off by default; when on, only stale leads with consent, once", async () => {
    const stale = await leadFor();
    await db.leadActivity.create({
      data: {
        leadId: stale.lead.id,
        kind: "call",
        body: "Called",
        createdAt: new Date(Date.now() - 10 * 86_400_000),
      },
    });
    const noConsent = await leadFor({ consent: false });
    await db.leadActivity.create({
      data: {
        leadId: noConsent.lead.id,
        kind: "call",
        body: "Called",
        createdAt: new Date(Date.now() - 10 * 86_400_000),
      },
    });
    const generate = vi.fn(async () => ({
      text: JSON.stringify({
        language: "en",
        subject: "Checking in",
        body: "Is there anything else we can help with?",
      }),
      model: "mock",
    })) as unknown as AiGenerate;
    const env = { ...mailEnv, AI_PROVIDER: "mock" } as unknown as Env;

    expect(await draftNoResponseFollowUps(db, { generate, env })).toEqual({ drafted: 0, skipped: "off" });
    await updateSetting(db, owner, "salesFollowUp", { autoDraft: true, afterDays: 4 });
    const first = await draftNoResponseFollowUps(db, { generate, env, limit: 50 });
    expect(first.drafted).toBeGreaterThanOrEqual(1);
    expect(
      await db.customerMessage.count({
        where: { leadId: stale.lead.id, origin: "auto_follow_up", status: "pending_approval" },
      }),
    ).toBe(1);
    expect(await db.customerMessage.count({ where: { leadId: noConsent.lead.id } })).toBe(0);
    await draftNoResponseFollowUps(db, { generate, env, limit: 50 });
    expect(await db.customerMessage.count({ where: { leadId: stale.lead.id } })).toBe(1);
  });
});
