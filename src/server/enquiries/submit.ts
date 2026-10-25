import { Prisma, type CustomerType, type LeadSource } from "@/generated/prisma/client";
import type { Db, Tx } from "@/server/db/client";
import { audit } from "@/server/audit";
import { enqueue } from "@/server/outbox/events";
import { attachUploads } from "@/server/storage/files";
import { products } from "@/content/products";
import type { ConsultationRequest } from "@/lib/forms/consultation";
import type { ContactRequest } from "@/lib/forms/contact";
import type { QuoteRequest } from "@/lib/forms/quote";

/**
 * Public enquiries: quotation requests, consultation bookings and contact messages. Each is saved
 * in one transaction (customer, lead, record, files, consent, outbox event, audit) and gets a
 * reference the customer sees, e.g. GIK-Q-2026-00042.
 */

type Prefix = "Q" | "C" | "M";

export async function nextReference(tx: Tx, prefix: Prefix, now = new Date()): Promise<string> {
  const [row] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('enquiry_reference_seq') AS n`;
  const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bahrain", year: "numeric" }).format(now);
  return `GIK-${prefix}-${year}-${String(row!.n).padStart(5, "0")}`;
}

/** English category names for staff-facing summaries. */
export function categoryLabel(category: string | undefined): string {
  if (!category) return "Not specified";
  if (category === "bespoke") return "More we make (bespoke)";
  if (category === "completeProject") return "Complete project";
  return products.find((p) => p.key === category)?.name.en ?? category;
}

interface ContactInput {
  name: string;
  phone?: string;
  email?: string;
  type?: CustomerType;
  locale: "en" | "ar";
}

/**
 * Finds the customer by phone, then email, or creates one. A public form never changes an existing
 * customer record: what the visitor typed is kept on the lead's activity instead.
 */
export async function findOrCreateCustomer(tx: Tx, input: ContactInput) {
  const match = await tx.customer.findFirst({
    where: {
      OR: [
        ...(input.phone ? [{ phone: input.phone }] : []),
        ...(input.email ? [{ email: input.email }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (match) return match;
  return tx.customer.create({
    data: {
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      type: input.type ?? "homeowner",
      preferredLanguage: input.locale,
    },
  });
}

async function recordConsent(
  tx: Tx,
  customerId: string,
  input: { consentEmail: boolean; consentWhatsapp: boolean; email?: string; phone?: string },
  source: string,
  ipHash: string | null,
) {
  const records = [
    ...(input.consentEmail && input.email ? [{ channel: "email" as const }] : []),
    ...(input.consentWhatsapp && input.phone ? [{ channel: "whatsapp" as const }] : []),
  ];
  if (records.length) {
    await tx.consentRecord.createMany({
      data: records.map((r) => ({ customerId, channel: r.channel, granted: true, source, ipHash })),
    });
  }
}

/** What the visitor typed, kept verbatim on the lead (the customer record may predate it). */
function submittedDetails(
  input: { name: string; phone?: string; email?: string },
  extra: (string | null | undefined)[],
) {
  return [
    `Name: ${input.name}`,
    input.phone ? `Phone: ${input.phone}` : null,
    input.email ? `Email: ${input.email}` : null,
    ...extra,
  ]
    .filter(Boolean)
    .join("\n");
}

async function createLead(
  tx: Tx,
  args: {
    prefix: Prefix;
    source: LeadSource;
    customerId: string;
    category?: string;
    summary: string;
    locale: "en" | "ar";
  },
) {
  const reference = await nextReference(tx, args.prefix);
  const lead = await tx.lead.create({
    data: {
      reference,
      customerId: args.customerId,
      source: args.source,
      category: args.category ?? null,
      summary: args.summary,
      locale: args.locale,
    },
  });
  return lead;
}

/** Runs a submission; on a rare race for a new customer's unique phone/email, retries once. */
async function inTransaction<T>(db: Db, work: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await db.$transaction(work);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return db.$transaction(work);
    throw error;
  }
}

export async function submitQuoteRequest(
  db: Db,
  input: QuoteRequest,
  ctx: { ipHash: string | null; verifiedFileIds: string[] },
): Promise<{ reference: string }> {
  return inTransaction(db, async (tx) => {
    const customer = await findOrCreateCustomer(tx, { ...input, type: input.customerType });
    const walls = input.noMeasurements ? [] : input.walls.filter((w) => w.width !== undefined);
    const summary = `${categoryLabel(input.category)} · ${walls.length ? `${walls.length} measurement(s) in ${input.unit}` : "no measurements yet"} · ${ctx.verifiedFileIds.length} file(s)`;
    const lead = await createLead(tx, {
      prefix: "Q",
      source: "website_quote",
      customerId: customer.id,
      category: input.category,
      summary,
      locale: input.locale,
    });
    const request = await tx.quotationRequest.create({
      data: {
        reference: lead.reference,
        leadId: lead.id,
        customerId: customer.id,
        category: input.category,
        measurements: walls as unknown as Prisma.InputJsonValue,
        unit: input.unit,
        preferredBoards: input.boards,
        finishNotes: input.finishNotes ?? null,
        message: input.message ?? null,
        area: input.area ?? null,
      },
    });
    await attachUploads(tx, ctx.verifiedFileIds, request.id);
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        kind: "message",
        internal: false,
        body: submittedDetails(input, [
          input.area && `Area: ${input.area}`,
          input.message && `\n${input.message}`,
        ]),
      },
    });
    await recordConsent(tx, customer.id, input, "website_quote", ctx.ipHash);
    await enqueue(tx, "enquiry.received", {
      kind: "quote",
      reference: lead.reference,
      leadId: lead.id,
      locale: input.locale,
      customer: { name: input.name, phone: input.phone, email: input.email ?? null },
      summary,
    });
    await audit(tx, {
      actorId: null,
      action: "enquiry.received",
      entityType: "lead",
      entityId: lead.id,
      changes: { kind: "quote", reference: lead.reference },
      ipHash: ctx.ipHash,
    });
    return { reference: lead.reference };
  });
}

export async function submitConsultation(
  db: Db,
  input: ConsultationRequest,
  ctx: { ipHash: string | null },
): Promise<{ reference: string }> {
  return inTransaction(db, async (tx) => {
    const customer = await findOrCreateCustomer(tx, {
      name: input.name,
      phone: input.phone,
      email: input.email,
      locale: input.locale,
    });
    const summary = `${input.type.replace("_", " ")} consultation · ${input.preferredDate} (${input.preferredSlot})${input.category ? ` · ${categoryLabel(input.category)}` : ""}`;
    const lead = await createLead(tx, {
      prefix: "C",
      source: "website_consultation",
      customerId: customer.id,
      category: input.category,
      summary,
      locale: input.locale,
    });
    await tx.consultation.create({
      data: {
        leadId: lead.id,
        customerId: customer.id,
        type: input.type,
        preferredDate: new Date(`${input.preferredDate}T00:00:00Z`),
        preferredSlot: input.preferredSlot,
        area: input.area ?? null,
        notes: input.notes ?? null,
      },
    });
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        kind: "message",
        internal: false,
        body: submittedDetails(input, [
          input.area && `Area: ${input.area}`,
          input.notes && `\n${input.notes}`,
        ]),
      },
    });
    await recordConsent(tx, customer.id, input, "website_consultation", ctx.ipHash);
    await enqueue(tx, "enquiry.received", {
      kind: "consultation",
      reference: lead.reference,
      leadId: lead.id,
      locale: input.locale,
      customer: { name: input.name, phone: input.phone, email: input.email ?? null },
      summary,
    });
    await audit(tx, {
      actorId: null,
      action: "enquiry.received",
      entityType: "lead",
      entityId: lead.id,
      changes: { kind: "consultation", reference: lead.reference },
      ipHash: ctx.ipHash,
    });
    return { reference: lead.reference };
  });
}

export async function submitContact(
  db: Db,
  input: ContactRequest,
  ctx: { ipHash: string | null },
): Promise<{ reference: string }> {
  return inTransaction(db, async (tx) => {
    const customer = await findOrCreateCustomer(tx, {
      name: input.name,
      phone: input.phone,
      email: input.email,
      locale: input.locale,
    });
    const summary = input.message.length > 120 ? `${input.message.slice(0, 117)}…` : input.message;
    const lead = await createLead(tx, {
      prefix: "M",
      source: "website_contact",
      customerId: customer.id,
      summary,
      locale: input.locale,
    });
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        kind: "message",
        internal: false,
        body: submittedDetails(input, [`\n${input.message}`]),
      },
    });
    await recordConsent(tx, customer.id, input, "website_contact", ctx.ipHash);
    await enqueue(tx, "enquiry.received", {
      kind: "contact",
      reference: lead.reference,
      leadId: lead.id,
      locale: input.locale,
      customer: { name: input.name, phone: input.phone ?? null, email: input.email ?? null },
      summary,
    });
    await audit(tx, {
      actorId: null,
      action: "enquiry.received",
      entityType: "lead",
      entityId: lead.id,
      changes: { kind: "contact", reference: lead.reference },
      ipHash: ctx.ipHash,
    });
    return { reference: lead.reference };
  });
}
