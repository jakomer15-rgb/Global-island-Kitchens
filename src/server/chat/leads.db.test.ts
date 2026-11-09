import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chatCardText } from "@/content/chat";
import { chatContactSchema, readChatStream, type ChatEvent, type ChatRequest } from "@/lib/chat";
import { settingDefaults } from "@/lib/site-settings";
import { createStaffUser } from "@/server/auth/accounts";
import { resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { consentSnapshot } from "@/server/consent";
import { createPrismaClient } from "@/server/db/client";
import { RuleError } from "@/server/errors";
import { sweepStaleUploads } from "@/server/storage/files";
import { updateSetting } from "@/server/settings/update";
import { analyseConversation, transcriptOf, type Analysis, type AnalyseFn } from "./analysis";
import type { ChatCall, ChatModelFn } from "./claude";
import { hashToken, openConversation } from "./conversation";
import { submitChatContact } from "./leads";
import { startChatReply } from "./reply";

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
  await updateSetting(db, owner, "chatAgent", { ...settingDefaults.chatAgent, enabled: true });
});
afterAll(async () => {
  await updateSetting(db, owner, "chatAgent", { ...settingDefaults.chatAgent, enabled: false });
  await db.$disconnect();
});

const model = (
  pieces = ["Lovely, ", "tell me more."],
  form?: "quotation",
): ChatModelFn & { calls: ChatCall[] } => {
  const calls: ChatCall[] = [];
  const fn = async function* (call: ChatCall) {
    calls.push(call);
    for (const text of pieces) yield { type: "text" as const, text };
    if (form) yield { type: "form" as const, reason: form };
    yield { type: "end" as const, reason: "done" as const };
  };
  return Object.assign(fn, { calls });
};

async function chat(req: ChatRequest, fn: ChatModelFn = model()) {
  const reply = await startChatReply(db, req, null, fn);
  if (!reply.ok) throw new Error(reply.error);
  const seen: ChatEvent[] = [];
  await readChatStream(reply.stream, (e) => seen.push(e));
  const session = seen.find((e) => e.t === "session");
  return {
    seen,
    conversationId: reply.conversationId,
    session: session?.t === "session" ? session.v : undefined,
  };
}

const contact = (session: string, over: Record<string, unknown> = {}) =>
  chatContactSchema.parse({
    session,
    locale: "en",
    reason: "quotation",
    name: "Huda Visitor",
    phone: `3${digits()}`,
    email: `huda-${uid()}@example.test`,
    preferredContact: "whatsapp",
    consentWhatsapp: true,
    privacyAccepted: true,
    website: "",
    startedAt: Date.now() - 60_000,
    ...over,
  });

const reading = (over: Partial<Analysis> = {}): Analysis => ({
  language: "en",
  productKey: "woodenKitchens",
  productCategory: "L-shaped kitchen",
  dimensions: "4 m wall",
  designPreferences: "modern, light colours",
  materialPreferences: "EGGER white décor",
  location: "Riffa",
  budget: "about 3,000 BHD",
  timeline: "next month",
  summary: "Wants a modern L-shaped kitchen for a villa in Riffa next month.",
  temperature: "hot",
  temperatureReason: "Clear project, budget and timeline.",
  ...over,
});
const analyser =
  (a: Analysis): AnalyseFn =>
  async () =>
    a;

describe("chat conversations", () => {
  it("are saved with contact details removed, and continue with the token", async () => {
    const first = await chat({
      locale: "en",
      messages: [{ role: "user", text: "Hi, I'm at sara@example.com and 3459 1234" }],
    });
    expect(first.session).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const second = await chat({
      locale: "en",
      session: first.session,
      fresh: 1,
      messages: [
        { role: "user", text: "Hi, I'm at sara@example.com and 3459 1234" },
        { role: "assistant", text: "Lovely, tell me more." },
        { role: "user", text: "A wardrobe please" },
      ],
    });
    expect(second.conversationId).toBe(first.conversationId);
    expect(second.session).toBeUndefined();

    const messages = await db.chatMessage.findMany({
      where: { conversationId: first.conversationId },
      orderBy: { createdAt: "asc" },
    });
    expect(messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "Hi, I'm at [email removed] and [number removed]"],
      ["assistant", "Lovely, tell me more."],
      ["user", "A wardrobe please"],
      ["assistant", "Lovely, tell me more."],
    ]);
    const conversation = await db.chatConversation.findUniqueOrThrow({ where: { id: first.conversationId } });
    expect(conversation.messageCount).toBe(4);
    expect(conversation.tokenHash).toBe(hashToken(first.session!));
    expect(conversation.tokenHash).not.toContain(first.session!);
  });

  it("start a new conversation for an unknown token", async () => {
    const r = await chat({
      locale: "en",
      session: "x".repeat(43),
      messages: [{ role: "user", text: "Hello" }],
    });
    expect(r.session).toBeDefined();
    expect(r.session).not.toBe("x".repeat(43));
  });

  it("pass the assistant's request for the contact form to the window", async () => {
    const r = await chat(
      { locale: "en", messages: [{ role: "user", text: "Yes please" }] },
      model(["Sure."], "quotation"),
    );
    expect(r.seen).toContainEqual({ t: "form", reason: "quotation" });
  });

  it("are read every second visitor message, and the reading is stored", async () => {
    const r = await chat({ locale: "en", messages: [{ role: "user", text: "Kitchen" }] });
    expect(await analyseConversation(db, r.conversationId, {}, analyser(reading()))).toBeNull();
    await chat({
      locale: "en",
      session: r.session,
      fresh: 1,
      messages: [
        { role: "user", text: "Kitchen" },
        { role: "assistant", text: "Lovely, tell me more." },
        { role: "user", text: "4 m in Riffa, about 3,000 BHD" },
      ],
    });
    expect(await analyseConversation(db, r.conversationId, {}, analyser(reading()))).not.toBeNull();
    const c = await db.chatConversation.findUniqueOrThrow({ where: { id: r.conversationId } });
    expect(c.temperature).toBe("hot");
    expect(c.requirements).toMatchObject({ location: "Riffa", budget: "about 3,000 BHD" });
    expect(c.analysedAt).not.toBeNull();
  });

  it("give the analysis a transcript of the visitor and assistant only", () => {
    expect(
      transcriptOf([
        { role: "user", content: "Hi" },
        { role: "event", content: "Contact form sent" },
        { role: "assistant", content: "Hello\nthere" },
      ]),
    ).toBe("Visitor: Hi\nAssistant: Hello there");
  });
});

describe("chat contact form", () => {
  it("creates a website-chat lead with consent, the reading, and an event in the transcript", async () => {
    const r = await chat({ locale: "en", messages: [{ role: "user", text: "A kitchen for my villa" }] });
    await analyseConversation(db, r.conversationId, { force: true }, analyser(reading()));
    const input = contact(r.session!);
    const { reference, created } = await submitChatContact(db, input, {
      conversationId: r.conversationId,
      ipHash: null,
      verifiedFileIds: [],
    });
    expect(created).toBe(true);
    expect(reference).toMatch(/^GIK-A-\d{4}-\d{5}$/);

    const lead = await db.lead.findUniqueOrThrow({
      where: { reference: reference! },
      include: { customer: true, requirements: true, activities: true, chats: true },
    });
    expect(lead.source).toBe("website_chat");
    expect(lead.temperature).toBe("hot");
    expect(lead.category).toBe("woodenKitchens");
    expect(lead.requirements).toMatchObject({
      location: "Riffa",
      budget: "about 3,000 BHD",
      timeline: "next month",
    });
    expect(lead.customer.phone).toBe(input.phone);
    expect(lead.chats.map((c) => c.id)).toEqual([r.conversationId]);
    expect(lead.activities[0]!.body).toContain(`Phone: ${input.phone}`);
    expect(await consentSnapshot(db, lead.customerId)).toEqual({ email: false, whatsapp: true });

    const events = await db.chatMessage.findMany({
      where: { conversationId: r.conversationId, role: "event" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.content).toContain(reference);
    expect(events[0]!.content).not.toContain(input.phone);
  });

  it("doesn't create duplicates: the same conversation, or the same customer within 60 days, joins the lead", async () => {
    const a = await chat({ locale: "en", messages: [{ role: "user", text: "Wardrobe" }] });
    const first = contact(a.session!);
    const one = await submitChatContact(db, first, {
      conversationId: a.conversationId,
      ipHash: null,
      verifiedFileIds: [],
    });
    const again = await submitChatContact(
      db,
      contact(a.session!, { phone: first.phone, reason: "callback" }),
      {
        conversationId: a.conversationId,
        ipHash: null,
        verifiedFileIds: [],
      },
    );
    expect(again).toEqual({ reference: one.reference, created: false });

    // Another chat with the same phone joins the lead, but the phone isn't verified: the visitor
    // isn't told the reference, consent isn't changed, and that chat's reading leaves the lead alone.
    const b = await chat({ locale: "en", messages: [{ role: "user", text: "Also a TV unit" }] });
    const other = await submitChatContact(
      db,
      contact(b.session!, { phone: first.phone, consentWhatsapp: false, consentEmail: true }),
      { conversationId: b.conversationId, ipHash: null, verifiedFileIds: [] },
    );
    expect(other).toEqual({ reference: null, created: false });
    const lead = await db.lead.findUniqueOrThrow({
      where: { reference: one.reference! },
      include: { chats: true, activities: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    expect(lead.chats).toHaveLength(2);
    expect(lead.activities[0]!.body).toMatch(/not verified/);
    expect(lead.activities[0]!.body).toMatch(/Ticked: email updates\. Not recorded/);
    expect(await db.customer.count({ where: { phone: first.phone } })).toBe(1);
    expect(await consentSnapshot(db, lead.customerId)).toEqual({ email: false, whatsapp: true });
    await analyseConversation(
      db,
      b.conversationId,
      { force: true },
      analyser(reading({ temperature: "cold" })),
    );
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).temperature).not.toBe("cold");
    // ... and a second form from that chat still doesn't reveal it.
    const twice = await submitChatContact(db, contact(b.session!, { phone: `3${digits()}` }), {
      conversationId: b.conversationId,
      ipHash: null,
      verifiedFileIds: [],
    });
    expect(twice).toEqual({ reference: null, created: false });

    // A closed lead is not reused.
    await db.lead.update({ where: { id: lead.id }, data: { status: "won" } });
    const c = await chat({ locale: "en", messages: [{ role: "user", text: "New project" }] });
    const fresh = await submitChatContact(db, contact(c.session!, { phone: first.phone }), {
      conversationId: c.conversationId,
      ipHash: null,
      verifiedFileIds: [],
    });
    expect(fresh.created).toBe(true);
  });

  it("never overwrites what staff set on the lead", async () => {
    const r = await chat({ locale: "en", messages: [{ role: "user", text: "Kitchen" }] });
    const { reference } = await submitChatContact(db, contact(r.session!), {
      conversationId: r.conversationId,
      ipHash: null,
      verifiedFileIds: [],
    });
    const lead = await db.lead.findUniqueOrThrow({ where: { reference: reference! } });
    await db.lead.update({ where: { id: lead.id }, data: { temperature: "cold", temperatureByStaff: true } });
    await db.leadRequirement.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id, budget: "agreed by phone", editedByStaff: true },
      update: { budget: "agreed by phone", editedByStaff: true },
    });
    await analyseConversation(
      db,
      r.conversationId,
      { force: true },
      analyser(reading({ temperature: "hot" })),
    );
    const after = await db.lead.findUniqueOrThrow({
      where: { id: lead.id },
      include: { requirements: true },
    });
    expect(after.temperature).toBe("cold");
    expect(after.requirements?.budget).toBe("agreed by phone");
  });

  it("saves a conversation started from quick options, inside the same transaction", async () => {
    const { conversation, created } = await openConversation(db, { locale: "en", ipHash: null });
    const input = contact("y".repeat(43), {
      session: undefined,
      messages: [
        { role: "user", text: "Wooden Kitchens" },
        { role: "assistant", text: chatCardText({ card: "product", key: "woodenKitchens" }, "en") },
      ],
      fresh: 2,
    });
    await submitChatContact(db, input, {
      conversationId: conversation.id,
      newConversation: created,
      ipHash: null,
      verifiedFileIds: [],
    });
    const roles = (
      await db.chatMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "asc" },
      })
    ).map((m) => m.role);
    expect(roles).toEqual(["user", "assistant", "event"]);
  });

  it("attaches verified photos to the conversation, which the clean-up then keeps", async () => {
    const r = await chat({ locale: "en", messages: [{ role: "user", text: "Here is my room" }] });
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const file = await db.fileAsset.create({
      data: {
        storageKey: `files/test-${uid()}`,
        originalName: "room.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 10,
        status: "verified",
        verifiedAt: old,
        createdAt: old,
      },
    });
    await submitChatContact(db, contact(r.session!), {
      conversationId: r.conversationId,
      ipHash: null,
      verifiedFileIds: [file.id],
    });
    expect((await db.fileAsset.findUniqueOrThrow({ where: { id: file.id } })).chatConversationId).toBe(
      r.conversationId,
    );
    const storage = { delete: async () => {} } as unknown as Parameters<typeof sweepStaleUploads>[1];
    await sweepStaleUploads(db, storage);
    expect(await db.fileAsset.findUnique({ where: { id: file.id } })).not.toBeNull();

    // The same photo can't be attached twice.
    const other = await chat({ locale: "en", messages: [{ role: "user", text: "Me too" }] });
    await expect(
      submitChatContact(db, contact(other.session!), {
        conversationId: other.conversationId,
        ipHash: null,
        verifiedFileIds: [file.id],
      }),
    ).rejects.toThrow(RuleError);
  });

  it("checks the form's fields", () => {
    const base = {
      session: "z".repeat(43),
      locale: "en",
      reason: "callback",
      name: "Ali",
      phone: "3459 7636",
      preferredContact: "email",
      privacyAccepted: true,
      startedAt: Date.now(),
    };
    const noEmail = chatContactSchema.safeParse(base);
    expect(noEmail.success).toBe(false);
    expect(noEmail.error?.issues[0]?.message).toBe("emailForContact");
    expect(chatContactSchema.safeParse({ ...base, preferredContact: "call" }).success).toBe(true);
    expect(
      chatContactSchema.safeParse({ ...base, preferredContact: "call", privacyAccepted: false }).success,
    ).toBe(false);
    expect(chatContactSchema.safeParse({ ...base, preferredContact: "call", phone: "abc" }).success).toBe(
      false,
    );
  });
});
