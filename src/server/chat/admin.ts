import type { LeadSource, LeadStatus, LeadTemperature, Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import { paged, pageArgs } from "@/server/crm/shared";
import type { Db } from "@/server/db/client";
import { NotFoundError } from "@/server/errors";

/**
 * Staff side of the sales chat (Admin → AI sales): conversations, figures, the rating and
 * requirements on a lead, and the CSV export. Everything needs `lead.read`; changes need
 * `lead.update`; the export, which carries contact details, also needs `customer.read`.
 */

export const temperatures: LeadTemperature[] = ["hot", "warm", "cold"];

export interface ChatFilters {
  temperature?: LeadTemperature;
  /** "yes": the visitor sent the contact form; "no": they didn't. */
  contact?: "yes" | "no";
  q?: string;
  page?: number;
}

export async function listChats(db: Db, actor: Actor, filters: ChatFilters) {
  assertCan(actor, "lead.read");
  const q = filters.q?.trim();
  const where: Prisma.ChatConversationWhereInput = {
    messageCount: { gt: 0 },
    ...(filters.temperature ? { temperature: filters.temperature } : {}),
    ...(filters.contact === "yes" ? { leadId: { not: null } } : {}),
    ...(filters.contact === "no" ? { leadId: null } : {}),
    ...(q
      ? {
          OR: [
            { summary: { contains: q, mode: "insensitive" } },
            { lead: { reference: { contains: q, mode: "insensitive" } } },
            { lead: { customer: { name: { contains: q, mode: "insensitive" } } } },
            { messages: { some: { content: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const { skip, take, page } = pageArgs(filters.page);
  const [items, total] = await Promise.all([
    db.chatConversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        startedAt: true,
        lastMessageAt: true,
        messageCount: true,
        language: true,
        temperature: true,
        summary: true,
        requirements: true,
        lead: { select: { id: true, reference: true, status: true, customer: { select: { name: true } } } },
        _count: { select: { files: { where: { status: "verified" } } } },
      },
    }),
    db.chatConversation.count({ where }),
  ]);
  return paged(items, total, page);
}

export async function getChat(db: Db, actor: Actor, id: string) {
  assertCan(actor, "lead.read");
  const chat = await db.chatConversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      files: {
        where: { status: "verified" },
        select: { id: true, originalName: true, sizeBytes: true, mimeType: true, createdAt: true },
      },
      lead: {
        select: {
          id: true,
          reference: true,
          status: true,
          temperature: true,
          customer: { select: { name: true, phone: true, email: true } },
          assignedTo: { select: { name: true } },
        },
      },
    },
  });
  if (!chat) throw new NotFoundError("Conversation");
  return chat;
}

/** USD per million tokens (input, output, cache read, 5-minute cache write), Anthropic list prices. */
const prices: Record<string, [number, number, number, number]> = {
  "claude-sonnet-5-5": [2, 10, 0.2, 2.5],
  "claude-haiku-5-5": [0.1, 0.5, 0.01, 0.125],
  "claude-opus-5-5": [4, 20, 0.2, 5],
};

/** Approximate provider cost in US dollars for the recorded tokens. */
export function estimateCost(
  rows: {
    model: string | null;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  }[],
): number {
  let usd = 0;
  for (const r of rows) {
    // Fallbacks report the model that served the turn; unknown models are priced as Sonnet.
    const [i, o, cr, cw] = prices[r.model ?? ""] ?? prices["claude-sonnet-5-5"]!;
    usd += (r.inputTokens * i + r.outputTokens * o + r.cacheReadTokens * cr + r.cacheWriteTokens * cw) / 1e6;
  }
  return usd;
}

const DAY = 24 * 60 * 60 * 1000;

/** Figures for the AI sales dashboard: the last `days` days, by when the chat started. */
export async function chatStats(db: Db, actor: Actor, days = 30, now = new Date()) {
  assertCan(actor, "lead.read");
  const since = new Date(now.getTime() - days * DAY);
  const chatWhere: Prisma.ChatConversationWhereInput = { messageCount: { gt: 0 }, startedAt: { gte: since } };
  const leadWhere: Prisma.LeadWhereInput = {
    archivedAt: null,
    source: "website_chat",
    createdAt: { gte: since },
  };
  const [chats, withContact, chatTemps, leadTemps, leadStatuses, usage, messages, assisted] =
    await Promise.all([
      db.chatConversation.count({ where: chatWhere }),
      db.chatConversation.count({ where: { ...chatWhere, leadId: { not: null } } }),
      db.chatConversation.groupBy({ by: ["temperature"], where: chatWhere, _count: { _all: true } }),
      db.lead.groupBy({ by: ["temperature"], where: leadWhere, _count: { _all: true } }),
      db.lead.groupBy({ by: ["status"], where: leadWhere, _count: { _all: true } }),
      db.chatConversation.findMany({
        where: { startedAt: { gte: since } },
        select: {
          model: true,
          inputTokens: true,
          outputTokens: true,
          cacheReadTokens: true,
          cacheWriteTokens: true,
        },
      }),
      db.chatMessage.count({ where: { role: "user", createdAt: { gte: since } } }),
      // Leads from other sources that a chat was later added to (a returning customer).
      db.lead.count({
        where: {
          archivedAt: null,
          source: { not: "website_chat" },
          chats: { some: { startedAt: { gte: since } } },
        },
      }),
    ]);
  const count = <K extends string>(rows: { _count: { _all: number } }[], key: (r: never) => K | null) =>
    Object.fromEntries(rows.map((r) => [key(r as never) ?? "none", r._count._all])) as Record<string, number>;
  const byLeadStatus = count(leadStatuses, (r: { status: LeadStatus }) => r.status);
  const leads = Object.values(byLeadStatus).reduce((a, b) => a + b, 0);
  const won = byLeadStatus.won ?? 0;
  const lost = byLeadStatus.lost ?? 0;
  return {
    days,
    chats,
    withContact,
    /** Share of chats in which the visitor left their details. */
    contactRate: chats > 0 ? Math.round((withContact / chats) * 100) : null,
    chatsByTemperature: count(chatTemps, (r: { temperature: LeadTemperature | null }) => r.temperature),
    leads,
    assisted,
    leadsByTemperature: count(leadTemps, (r: { temperature: LeadTemperature | null }) => r.temperature),
    byLeadStatus,
    won,
    /** Won out of chat leads that reached a decision. */
    conversion: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
    visitorMessages: messages,
    costUsd: estimateCost(usage),
  };
}

// ─── Staff changes on a lead ────────────────────────────────────────────────

/** HOT / WARM / COLD set by staff (the assistant then leaves it); null hands it back to the assistant. */
export async function setLeadTemperature(
  db: Db,
  actor: Actor,
  input: { leadId: string; temperature: LeadTemperature | null },
) {
  assertCan(actor, "lead.update");
  await db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id: input.leadId, archivedAt: null } });
    if (!lead) throw new NotFoundError("Lead");
    const byStaff = input.temperature !== null;
    if (lead.temperature === input.temperature && lead.temperatureByStaff === byStaff) return;
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        temperatureByStaff: byStaff,
        // Handing it back keeps the last value until the assistant's next reading.
        ...(byStaff ? { temperature: input.temperature } : {}),
      },
    });
    const show = (t: LeadTemperature | null) => (t ? t.toUpperCase() : "none");
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        kind: "status_change",
        authorId: actor.id,
        body: byStaff
          ? `Rating: ${show(lead.temperature)} → ${show(input.temperature)}`
          : "Rating handed back to the AI assistant",
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "lead.temperature_set",
      entityType: "lead",
      entityId: lead.id,
      changes: { from: lead.temperature, to: input.temperature, byStaff },
    });
  });
}

export const requirementFields = [
  ["productCategory", "Product", 200],
  ["dimensions", "Dimensions", 500],
  ["designPreferences", "Design", 500],
  ["materialPreferences", "Materials and colours", 500],
  ["location", "Location", 200],
  ["budget", "Budget", 200],
  ["timeline", "Timeline", 200],
  ["notes", "Notes", 2000],
] as const;
export type RequirementInput = Record<(typeof requirementFields)[number][0], string | null>;

/** Staff edit the requirements; from then on the assistant no longer changes them. */
export async function saveLeadRequirements(db: Db, actor: Actor, leadId: string, input: RequirementInput) {
  assertCan(actor, "lead.update");
  await db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({
      where: { id: leadId, archivedAt: null },
      include: { requirements: true },
    });
    if (!lead) throw new NotFoundError("Lead");
    await tx.leadRequirement.upsert({
      where: { leadId },
      create: { leadId, ...input, editedByStaff: true },
      update: { ...input, editedByStaff: true },
    });
    const before = lead.requirements;
    await audit(tx, {
      actorId: actor.id,
      action: "lead.requirements_updated",
      entityType: "lead",
      entityId: lead.id,
      changes: {
        before: before && Object.fromEntries(requirementFields.map(([k]) => [k, before[k]])),
        after: input,
      },
    });
  });
}

// ─── CSV export ────────────────────────────────────────────────────────────

export interface ExportFilters {
  source?: LeadSource;
  temperature?: LeadTemperature;
  status?: LeadStatus;
  from?: Date;
  to?: Date;
}

export const EXPORT_LIMIT = 5000;

/**
 * One CSV cell. Text that a spreadsheet would run as a formula (=, +, -, @, tab, CR) gets a leading
 * apostrophe, so a customer's message can never become a formula in Excel.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof CsvPhone) return value.cell;
  let text = value instanceof Date ? bahrainTime(value) : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * A validated phone number (+ and digits only, as stored). Written as ="+97333000001" so Excel shows
 * it as text with its + instead of turning it into a number; safe because nothing else can be in it.
 */
export class CsvPhone {
  readonly cell: string;
  constructor(e164: string | null) {
    this.cell = e164 && /^\+\d{6,15}$/.test(e164) ? `"=""${e164}"""` : csvCell(e164 ?? "");
  }
}

const bahrainParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bahrain",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "2026-11-09 14:05" in Bahrain time. */
export function bahrainTime(d: Date): string {
  const p = Object.fromEntries(bahrainParts.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** "website_chat" → "Website chat". */
const words = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Byte-order mark: makes Excel read Arabic and other non-Latin text correctly. */
const BOM = String.fromCharCode(0xfeff);

export function toCsv(rows: unknown[][]): string {
  return `${BOM}${rows.map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** Leads as a spreadsheet (UTF-8 CSV that Excel opens), newest first. Audited. */
export async function exportLeadsCsv(db: Db, actor: Actor, filters: ExportFilters, ipHash: string | null) {
  assertCan(actor, "lead.read");
  assertCan(actor, "customer.read");
  const where: Prisma.LeadWhereInput = {
    archivedAt: null,
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.temperature ? { temperature: filters.temperature } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lt: filters.to } : {}),
          },
        }
      : {}),
  };
  const leads = await db.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: EXPORT_LIMIT,
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      assignedTo: { select: { name: true } },
      requirements: true,
      chats: { select: { id: true }, take: 1 },
    },
  });
  const header = [
    "Reference",
    "Received",
    "Source",
    "Status",
    "Rating",
    "Customer",
    "Phone",
    "Email",
    ...requirementFields.map(([, label]) => label),
    "Assigned to",
    "Summary",
    "Has AI chat",
  ];
  const rows = leads.map((l) => [
    l.reference,
    l.createdAt,
    words(l.source),
    words(l.status),
    l.temperature?.toUpperCase() ?? "",
    l.customer.name,
    new CsvPhone(l.customer.phone),
    l.customer.email,
    ...requirementFields.map(([key]) => l.requirements?.[key] ?? ""),
    l.assignedTo?.name ?? "",
    l.summary,
    l.chats.length > 0 ? "yes" : "no",
  ]);
  await audit(db, {
    actorId: actor.id,
    action: "leads.exported",
    entityType: "lead",
    changes: {
      rows: leads.length,
      filters: { ...filters, from: filters.from?.toISOString(), to: filters.to?.toISOString() },
    },
    ipHash,
  });
  return { csv: toCsv([header, ...rows]), rows: leads.length, truncated: leads.length === EXPORT_LIMIT };
}
