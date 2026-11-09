import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chatContactSchema } from "@/lib/chat";
import { settingDefaults } from "@/lib/site-settings";
import { createStaffUser } from "@/server/auth/accounts";
import { ForbiddenError, resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { createPrismaClient } from "@/server/db/client";
import { listLeads } from "@/server/crm/leads";
import { fileDownloadUrl } from "@/server/leads/queries";
import { updateSetting } from "@/server/settings/update";
import type { StorageDriver } from "@/server/storage/driver";
import {
  chatStats,
  csvCell,
  CsvPhone,
  estimateCost,
  exportLeadsCsv,
  getChat,
  listChats,
  saveLeadRequirements,
  setLeadTemperature,
  toCsv,
} from "./admin";
import { analyseConversation, type Analysis } from "./analysis";
import { openConversation, saveAssistantReply, saveVisitorTurn } from "./conversation";
import { submitChatContact } from "./leads";

const db = createPrismaClient();
const uid = () => Math.random().toString(36).slice(2, 10);
const digits = () => String(Math.floor(Math.random() * 1e7)).padStart(7, "0");

async function staff(roleKeys: string[]): Promise<Actor> {
  const id = await db.$transaction((tx) =>
    createStaffUser(tx, {
      email: `${roleKeys[0]}-${uid()}@example.test`,
      name: `${roleKeys[0]} ${uid()}`,
      password: "a long test password",
      roleKeys,
      actorId: null,
      via: "test",
    }),
  );
  return resolveActor(await db.user.findUniqueOrThrow({ where: { id }, include: userWithRolesInclude }))!;
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
  await updateSetting(db, owner, "chatAgent", { ...settingDefaults.chatAgent, enabled: true });
});
afterAll(async () => {
  await updateSetting(db, owner, "chatAgent", { ...settingDefaults.chatAgent, enabled: false });
  await db.$disconnect();
});

const reading = (temperature: Analysis["temperature"], marker: string): Analysis => ({
  language: "ar",
  productKey: "wardrobes",
  productCategory: `sliding wardrobe ${marker}`,
  dimensions: "3 m",
  designPreferences: null,
  materialPreferences: null,
  location: "Muharraq",
  budget: '=HYPERLINK("http://x")',
  timeline: "this month",
  summary: `Summary ${marker}`,
  temperature,
  temperatureReason: "Test.",
});

/** A chat with two visitor messages, read by the assistant, optionally turned into a lead. */
async function chatLead(temperature: Analysis["temperature"], withLead = true) {
  const marker = uid();
  const { conversation } = await openConversation(db, { locale: "ar", ipHash: null });
  await saveVisitorTurn(
    db,
    conversation.id,
    { messages: [{ role: "user", text: `wardrobe ${marker}` }] },
    true,
  );
  // The assistant's reply is saved by the server as it streams, never taken from the browser.
  await saveAssistantReply(db, conversation.id, "Tell me more", undefined);
  await saveVisitorTurn(
    db,
    conversation.id,
    { messages: [{ role: "user", text: "3 m in Muharraq" }] },
    false,
  );
  await db.chatConversation.update({
    where: { id: conversation.id },
    data: { model: "claude-sonnet-5-5", inputTokens: 1000, outputTokens: 100 },
  });
  await analyseConversation(db, conversation.id, {}, async () => reading(temperature, marker));
  let reference: string | null = null;
  if (withLead) {
    ({ reference } = await submitChatContact(
      db,
      chatContactSchema.parse({
        locale: "ar",
        reason: "quotation",
        name: `Chat ${marker}`,
        phone: `3${digits()}`,
        preferredContact: "call",
        privacyAccepted: true,
        startedAt: Date.now() - 60_000,
      }),
      { conversationId: conversation.id, ipHash: null, verifiedFileIds: [] },
    ));
  }
  const lead = reference ? await db.lead.findUniqueOrThrow({ where: { reference } }) : null;
  return { marker, conversationId: conversation.id, lead };
}

describe("AI sales dashboard", () => {
  it("lists conversations, filtered by rating, contact and words", async () => {
    const hot = await chatLead("hot");
    const anon = await chatLead("cold", false);
    const ids = async (f: object) => (await listChats(db, sales, f)).items.map((c) => c.id);

    expect(await ids({ q: hot.marker })).toEqual([hot.conversationId]);
    expect(await ids({ q: hot.marker, temperature: "cold" })).toEqual([]);
    expect(await ids({ q: anon.marker, contact: "no" })).toEqual([anon.conversationId]);
    expect(await ids({ q: anon.marker, contact: "yes" })).toEqual([]);
    // Lead reference and customer name are searchable too.
    expect(await ids({ q: hot.lead!.reference })).toEqual([hot.conversationId]);
  });

  it("shows a conversation with its transcript and lead to staff who read leads only", async () => {
    const { conversationId, lead } = await chatLead("warm");
    const chat = await getChat(db, sales, conversationId);
    expect(chat.lead?.reference).toBe(lead!.reference);
    expect(chat.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "event"]);
    await expect(getChat(db, editor, conversationId)).rejects.toThrow(ForbiddenError);
    await expect(listChats(db, editor, {})).rejects.toThrow(ForbiddenError);
    await expect(chatStats(db, editor)).rejects.toThrow(ForbiddenError);
  });

  it("counts conversations, leads by rating and status, conversion and cost", async () => {
    const before = await chatStats(db, sales, 1);
    const a = await chatLead("hot");
    await chatLead("cold", false);
    await db.lead.update({ where: { id: a.lead!.id }, data: { status: "won" } });
    const after = await chatStats(db, sales, 1);
    expect(after.chats - before.chats).toBe(2);
    expect(after.withContact - before.withContact).toBe(1);
    expect(after.leads - before.leads).toBe(1);
    expect((after.leadsByTemperature.hot ?? 0) - (before.leadsByTemperature.hot ?? 0)).toBe(1);
    expect(after.won - before.won).toBe(1);
    expect(after.costUsd).toBeGreaterThan(before.costUsd);
  });

  it("filters the leads list by rating", async () => {
    const { lead, marker } = await chatLead("hot");
    const find = async (temperature: "hot" | "cold") =>
      (await listLeads(db, sales, { q: `Chat ${marker}`, temperature })).items.map((l) => l.id);
    expect(await find("hot")).toEqual([lead!.id]);
    expect(await find("cold")).toEqual([]);
  });
});

describe("staff changes on a chat lead", () => {
  it("rating: staff choice sticks; handing it back lets the assistant rate again", async () => {
    const { lead, conversationId, marker } = await chatLead("warm");
    await setLeadTemperature(db, sales, { leadId: lead!.id, temperature: "hot" });
    await analyseConversation(db, conversationId, { force: true }, async () => reading("cold", marker));
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead!.id } })).temperature).toBe("hot");

    await setLeadTemperature(db, sales, { leadId: lead!.id, temperature: null });
    await analyseConversation(db, conversationId, { force: true }, async () => reading("cold", marker));
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead!.id }, include: { activities: true } });
    expect(after.temperature).toBe("cold");
    expect(after.temperatureByStaff).toBe(false);
    expect(after.activities.map((a) => a.body)).toContain("Rating: WARM → HOT");
    await expect(setLeadTemperature(db, editor, { leadId: lead!.id, temperature: "hot" })).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("requirements: staff edits stick and are audited", async () => {
    const { lead, conversationId, marker } = await chatLead("warm");
    await saveLeadRequirements(db, sales, lead!.id, {
      productCategory: "Sliding wardrobe, 2 doors",
      dimensions: "2.4 m",
      designPreferences: null,
      materialPreferences: null,
      location: "Muharraq",
      budget: "agreed on site",
      timeline: null,
      notes: "Measured on 10 Nov",
    });
    await analyseConversation(db, conversationId, { force: true }, async () => reading("hot", marker));
    const r = await db.leadRequirement.findUniqueOrThrow({ where: { leadId: lead!.id } });
    expect(r).toMatchObject({ dimensions: "2.4 m", budget: "agreed on site", editedByStaff: true });
    expect(
      await db.auditLog.count({ where: { entityId: lead!.id, action: "lead.requirements_updated" } }),
    ).toBe(1);
  });
});

describe("CSV export", () => {
  it("never lets a customer's text become a spreadsheet formula, and quotes what needs quoting", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+973 3459")).toBe("'+973 3459");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell('He said "hi", then left')).toBe('"He said ""hi"", then left"');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(null)).toBe("");
    expect(toCsv([["a", "مرحبا"]])).toBe("﻿a,مرحبا\r\n");
    // Validated phone numbers stay readable in Excel; anything else is treated as text.
    expect(csvCell(new CsvPhone("+97334597636"))).toBe('"=""+97334597636"""');
    expect(csvCell(new CsvPhone("+973=1+1"))).toBe("'+973=1+1");
    // Times are Bahrain time (UTC+3).
    expect(csvCell(new Date("2026-11-09T11:05:00Z"))).toBe("2026-11-09 14:05");
  });

  it("exports leads with requirements and rating, needs customer.read, and is audited", async () => {
    const { lead } = await chatLead("hot");
    const supervisor = await staff(["production_supervisor"]);
    await expect(exportLeadsCsv(db, editor, {}, null)).rejects.toThrow(ForbiddenError);

    const { csv, rows } = await exportLeadsCsv(
      db,
      sales,
      { source: "website_chat", temperature: "hot" },
      null,
    );
    expect(rows).toBeGreaterThan(0);
    const line = csv.split("\r\n").find((l) => l.startsWith(lead!.reference))!;
    expect(line).toContain("HOT");
    expect(line).toContain("Muharraq");
    // The budget the visitor typed was a formula: exported as text.
    expect(line).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(await db.auditLog.count({ where: { actorId: sales.id, action: "leads.exported" } })).toBe(1);
    // A production supervisor reads leads and customers, so may export.
    await expect(exportLeadsCsv(db, supervisor, {}, null)).resolves.toBeTruthy();
  });

  it("prices tokens per model", () => {
    const row = { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    expect(estimateCost([{ ...row, model: "claude-sonnet-5-5" }])).toBeCloseTo(2);
    expect(estimateCost([{ ...row, model: "claude-haiku-5-5" }])).toBeCloseTo(0.1);
    expect(estimateCost([{ ...row, model: "claude-opus-5-5" }])).toBeCloseTo(4);
  });
});

describe("chat photos", () => {
  it("can be downloaded by staff with file.read", async () => {
    const { conversationId } = await chatLead("warm");
    const file = await db.fileAsset.create({
      data: {
        storageKey: `files/test-${uid()}`,
        originalName: "room.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 10,
        status: "verified",
        verifiedAt: new Date(),
        chatConversationId: conversationId,
      },
    });
    const storage = {
      downloadUrl: async () => "https://signed.example/room.jpg",
    } as unknown as StorageDriver;
    expect(await fileDownloadUrl(db, storage, sales, file.id, null)).toBe("https://signed.example/room.jpg");
  });
});
