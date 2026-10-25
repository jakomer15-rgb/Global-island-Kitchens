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

export async function listCustomers(
  db: Db,
  actor: Actor,
  filters: { q?: string; type?: CustomerType; page?: number },
) {
  assertCan(actor, "customer.read");
  const q = filters.q?.trim();
  const where: Prisma.CustomerWhereInput = {
    archivedAt: null,
    ...(filters.type ? { type: filters.type } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { phone: { contains: q.replace(/\s/g, "") } },
            { email: { contains: q.toLowerCase() } },
          ],
        }
      : {}),
  };
  const { skip, take, page } = pageArgs(filters.page);
  const [items, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { _count: { select: { leads: true } } },
    }),
    db.customer.count({ where }),
  ]);
  return paged(items, total, page);
}

export async function getCustomer(db: Db, actor: Actor, id: string) {
  assertCan(actor, "customer.read");
  const customer = await db.customer.findFirst({
    where: { id, archivedAt: null },
    include: {
      leads: {
        orderBy: { createdAt: "desc" },
        select: { id: true, reference: true, status: true, summary: true, createdAt: true },
      },
      consents: { orderBy: { recordedAt: "desc" } },
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
