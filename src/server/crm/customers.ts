import type { CustomerType, Prisma } from "@/generated/prisma/client";
import type { Db } from "@/server/db/client";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import { NotFoundError, RuleError } from "@/server/errors";
import { normalisePhone } from "@/lib/phone";
import { paged, pageArgs } from "./shared";

export const customerTypes: CustomerType[] = [
  "homeowner",
  "interior_designer",
  "architect",
  "developer",
  "contractor",
  "business",
  "other",
];

export const customerSorts = ["newest", "oldest", "name"] as const;

export interface CustomerFilters {
  q?: string;
  type?: CustomerType;
  sort?: (typeof customerSorts)[number];
  page?: number;
}

function customerWhere(filters: CustomerFilters): Prisma.CustomerWhereInput {
  const q = filters.q?.trim();
  return {
    archivedAt: null,
    ...(filters.type ? { type: filters.type } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { location: { contains: q, mode: "insensitive" } },
            { phone: { contains: q.replace(/\s/g, "") } },
            { email: { contains: q.toLowerCase() } },
          ],
        }
      : {}),
  };
}

const customerOrder = (sort: CustomerFilters["sort"]): Prisma.CustomerOrderByWithRelationInput[] =>
  sort === "oldest" ? [{ createdAt: "asc" }] : sort === "name" ? [{ name: "asc" }] : [{ createdAt: "desc" }];

export async function listCustomers(db: Db, actor: Actor, filters: CustomerFilters) {
  assertCan(actor, "customer.read");
  const where = customerWhere(filters);
  const { skip, take, page } = pageArgs(filters.page);
  const [items, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: customerOrder(filters.sort),
      skip,
      take,
      include: {
        _count: { select: { leads: true } },
        leads: {
          where: { archivedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, lastContactAt: true },
        },
      },
    }),
    db.customer.count({ where }),
  ]);
  return paged(items, total, page);
}

const EXPORT_LIMIT = 5000;

/** Customers as rows for a CSV file (newest first by default). Audited: it holds contact details. */
export async function exportCustomers(
  db: Db,
  actor: Actor,
  filters: Omit<CustomerFilters, "page">,
  ipHash: string | null,
) {
  assertCan(actor, "customer.read");
  const customers = await db.customer.findMany({
    where: customerWhere(filters),
    orderBy: customerOrder(filters.sort),
    take: EXPORT_LIMIT,
    include: {
      _count: { select: { leads: true } },
      consents: { orderBy: { recordedAt: "desc" }, select: { channel: true, granted: true } },
    },
  });
  await audit(db, {
    actorId: actor.id,
    action: "customers.exported",
    entityType: "customer",
    changes: { rows: customers.length, filters: { ...filters } },
    ipHash,
  });
  return customers.map((c) => ({
    ...c,
    consentEmail: c.consents.find((r) => r.channel === "email")?.granted ?? null,
    consentWhatsapp: c.consents.find((r) => r.channel === "whatsapp")?.granted ?? null,
  }));
}

/** Name as compared for duplicates: case, spaces and Arabic/Latin punctuation ignored. */
export const duplicateKey = (name: string) =>
  name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s.,'’\-_ـ]+/g, " ")
    .trim();

/**
 * Customers that may be the same person: the same name (ignoring case, spacing and punctuation). Phone
 * numbers and emails are already unique, so these are people who used a different number or email.
 */
export async function possibleDuplicates(db: Db, actor: Actor, limit = 100) {
  assertCan(actor, "customer.read");
  const rows = await db.$queryRaw<{ key: string; ids: string[] }[]>`
    SELECT key, array_agg(id ORDER BY created_at) AS ids FROM (
      SELECT id, created_at,
        btrim(regexp_replace(lower(normalize(name, NFKC)), '[[:space:].,''’_ـ-]+', ' ', 'g')) AS key
      FROM customers WHERE archived_at IS NULL
    ) c
    GROUP BY key HAVING count(*) > 1
    ORDER BY max(created_at) DESC
    LIMIT ${limit}`;
  const ids = rows.flatMap((r) => r.ids);
  const customers = await db.customer.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      company: true,
      location: true,
      type: true,
      createdAt: true,
      _count: { select: { leads: true } },
    },
  });
  const byId = new Map(customers.map((c) => [c.id, c]));
  return rows.map((r) => r.ids.map((id) => byId.get(id)).filter((c) => c !== undefined));
}

/** Other active customers with the same name as this one (shown on the customer page). */
export async function duplicatesOf(db: Db, actor: Actor, id: string) {
  assertCan(actor, "customer.read");
  const groups = await possibleDuplicates(db, actor, 1000);
  return groups.find((g) => g.some((c) => c.id === id))?.filter((c) => c.id !== id) ?? [];
}

/**
 * Merges a duplicate into the record to keep. Everything that belonged to the duplicate (leads,
 * consultations, quotation requests, quotations, orders, projects, designer accounts, chats) moves to
 * the kept record; its consent history is copied (the history is append-only); empty company, location
 * and notes are filled from it. The duplicate is archived, keeps its phone and email, and points to the
 * kept record, so new enquiries using them arrive on the kept record. Audited on both records.
 */
export async function mergeCustomers(db: Db, actor: Actor, input: { keepId: string; mergeId: string }) {
  assertCan(actor, "customer.update");
  if (input.keepId === input.mergeId) throw new RuleError("same", "Choose two different customers.");
  return db.$transaction(async (tx) => {
    const [keep, merge] = await Promise.all([
      tx.customer.findFirst({ where: { id: input.keepId, archivedAt: null } }),
      tx.customer.findFirst({ where: { id: input.mergeId, archivedAt: null } }),
    ]);
    if (!keep || !merge) throw new NotFoundError("Customer");
    const to = { customerId: keep.id };
    const from = { customerId: merge.id };
    const moved = {
      leads: (await tx.lead.updateMany({ where: from, data: to })).count,
      consultations: (await tx.consultation.updateMany({ where: from, data: to })).count,
      quotationRequests: (await tx.quotationRequest.updateMany({ where: from, data: to })).count,
      quotations: (await tx.quotation.updateMany({ where: from, data: to })).count,
      orders: (await tx.order.updateMany({ where: from, data: to })).count,
      projects: (await tx.project.updateMany({ where: from, data: to })).count,
      designerAccounts: (await tx.designerAccount.updateMany({ where: from, data: to })).count,
      chats: (await tx.chatConversation.updateMany({ where: from, data: to })).count,
    };
    const consents = await tx.consentRecord.findMany({
      where: { customerId: merge.id },
      orderBy: { recordedAt: "asc" },
    });
    if (consents.length) {
      await tx.consentRecord.createMany({
        data: consents.map((c) => ({
          customerId: keep.id,
          channel: c.channel,
          granted: c.granted,
          source: `merged:${c.source}`.slice(0, 200),
          ipHash: c.ipHash,
          recordedAt: c.recordedAt,
        })),
      });
    }
    const contact = [merge.phone, merge.email].filter(Boolean).join(", ");
    const note = `Merged from ${merge.name}${contact ? ` (${contact})` : ""}.${merge.notes ? ` ${merge.notes}` : ""}`;
    await tx.customer.update({
      where: { id: keep.id },
      data: {
        company: keep.company ?? merge.company,
        location: keep.location ?? merge.location,
        notes: (keep.notes ? `${keep.notes}\n\n${note}` : note).slice(0, 2000),
      },
    });
    // Records merged into the duplicate earlier now point straight at the kept record.
    await tx.customer.updateMany({ where: { mergedIntoId: merge.id }, data: { mergedIntoId: keep.id } });
    await tx.customer.update({
      where: { id: merge.id },
      data: { archivedAt: new Date(), mergedIntoId: keep.id },
    });
    for (const [entityId, role] of [
      [keep.id, "kept"],
      [merge.id, "merged"],
    ] as const) {
      await audit(tx, {
        actorId: actor.id,
        action: "customer.merged",
        entityType: "customer",
        entityId,
        changes: { role, keepId: keep.id, mergeId: merge.id, moved, consentsCopied: consents.length },
      });
    }
    return moved;
  });
}

export async function getCustomer(db: Db, actor: Actor, id: string) {
  assertCan(actor, "customer.read");
  const customer = await db.customer.findFirst({
    where: { id, archivedAt: null },
    include: {
      leads: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reference: true,
          status: true,
          summary: true,
          createdAt: true,
          score: true,
          lastContactAt: true,
          nextFollowUpAt: true,
        },
      },
      consents: { orderBy: { recordedAt: "desc" } },
      mergedFrom: { select: { id: true, name: true, phone: true, email: true, archivedAt: true } },
    },
  });
  if (!customer) throw new NotFoundError("Customer");
  // The latest record per channel is the current consent.
  const current = {
    email: customer.consents.find((c) => c.channel === "email") ?? null,
    whatsapp: customer.consents.find((c) => c.channel === "whatsapp") ?? null,
  };
  return { ...customer, currentConsent: current };
}

export interface CustomerInput {
  name: string;
  phone?: string;
  email?: string;
  type: CustomerType;
  company?: string;
  preferredLanguage: "en" | "ar";
  notes?: string;
  location?: string;
}

export async function updateCustomer(db: Db, actor: Actor, id: string, input: CustomerInput) {
  assertCan(actor, "customer.update");
  const phone = input.phone?.trim() ? normalisePhone(input.phone) : null;
  if (input.phone?.trim() && !phone) throw new RuleError("phone", "Enter a valid phone number.");
  const email = input.email?.trim().toLowerCase() || null;
  if (!phone && !email) throw new RuleError("contact", "Keep at least a phone number or an email.");
  return db.$transaction(async (tx) => {
    const before = await tx.customer.findFirst({ where: { id, archivedAt: null } });
    if (!before) throw new NotFoundError("Customer");
    const clash = await tx.customer.findFirst({
      where: { id: { not: id }, OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])] },
      select: { id: true, name: true },
    });
    if (clash)
      throw new RuleError("duplicate", `Another customer (${clash.name}) already has that phone or email.`);
    const data = {
      name: input.name.trim(),
      phone,
      email,
      type: input.type,
      company: input.company?.trim() || null,
      preferredLanguage: input.preferredLanguage,
      notes: input.notes?.trim() || null,
      location: input.location?.trim().slice(0, 120) || null,
    };
    await tx.customer.update({ where: { id }, data });
    const changed = Object.fromEntries(
      Object.entries(data)
        .filter(([k, v]) => (before as Record<string, unknown>)[k] !== v)
        .map(([k, v]) => [k, { from: (before as Record<string, unknown>)[k] ?? null, to: v }]),
    );
    await audit(tx, {
      actorId: actor.id,
      action: "customer.updated",
      entityType: "customer",
      entityId: id,
      changes: changed as Prisma.InputJsonValue,
    });
  });
}

/** Staff record a consent change the customer asked for (e.g. by phone). Appends to the history. */
export async function recordConsent(
  db: Db,
  actor: Actor,
  input: { customerId: string; channel: "email" | "whatsapp"; granted: boolean },
) {
  assertCan(actor, "customer.update");
  return db.$transaction(async (tx) => {
    const c = await tx.customer.findFirst({ where: { id: input.customerId, archivedAt: null } });
    if (!c) throw new NotFoundError("Customer");
    await tx.consentRecord.create({
      data: { customerId: c.id, channel: input.channel, granted: input.granted, source: `staff:${actor.id}` },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "consent.recorded",
      entityType: "customer",
      entityId: c.id,
      changes: { channel: input.channel, granted: input.granted },
    });
  });
}
