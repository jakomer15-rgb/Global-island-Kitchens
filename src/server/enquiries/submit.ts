import { Prisma, type CustomerType, type LeadSource } from "@/generated/prisma/client";
import type { Db, Tx } from "@/server/db/client";
import { audit } from "@/server/audit";
import { consentFields } from "@/server/consent";
import { enqueue } from "@/server/outbox/events";
import { attachUploads } from "@/server/storage/files";
import { products } from "@/content/products";
import type { ConsultationRequest } from "@/lib/forms/consultation";
import type { ContactRequest } from "@/lib/forms/contact";
import type { QuoteRequest } from "@/lib/forms/quote";
import type { DesignerProject } from "@/lib/designer";

/**
 * Public enquiries: quotation requests, consultation bookings and contact messages. Each is saved
 * in one transaction (customer, lead, record, files, consent, outbox event, audit) and gets a
 * reference the customer sees, e.g. GIK-Q-2026-00042.
 */

type Prefix = "Q" | "C" | "M" | "W";

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
      ...(await consentFields(tx, customer.id)),
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
      ...(await consentFields(tx, customer.id)),
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
      ...(await consentFields(tx, customer.id)),
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

const designerCustomerType = {
  interior_designer: "interior_designer",
  architect: "architect",
  contractor: "contractor",
  developer: "developer",
  other: "other",
} as const;

/**
 * A project submitted by an approved designer. It becomes a lead (source: designer portal) and a
 * quotation request, so staff work it in the normal CRM, plus the designer's own project record.
 */
export async function submitDesignerProject(
  db: Db,
  designer: { designerId: string; userId: string },
  input: DesignerProject,
  ctx: { ipHash: string | null; verifiedFileIds: string[] },
): Promise<{ id: string; reference: string }> {
  return inTransaction(db, async (tx) => {
    const account = await tx.designerAccount.findUniqueOrThrow({
      where: { id: designer.designerId },
      include: { user: { select: { name: true, email: true } } },
    });
    const customer = account.customerId
      ? await tx.customer.findUniqueOrThrow({ where: { id: account.customerId } })
      : await findOrCreateCustomer(tx, {
          name: account.user.name,
          phone: account.phone,
          email: account.user.email,
          type: designerCustomerType[account.profession],
          locale: input.locale,
        });
    if (!account.customerId) {
      await tx.designerAccount.update({ where: { id: account.id }, data: { customerId: customer.id } });
      if (customer.company === null && account.company) {
        await tx.customer.update({ where: { id: customer.id }, data: { company: account.company } });
      }
    }

    const walls = input.noMeasurements ? [] : input.walls.filter((w) => w.width !== undefined);
    const materials = input.materialIds.length
      ? await tx.material.findMany({
          where: { id: { in: input.materialIds } },
          select: { id: true, code: true, nameEn: true },
        })
      : [];
    const summary = `Designer project: ${input.title} · ${categoryLabel(input.category)} · ${walls.length ? `${walls.length} measurement(s) in ${input.unit}` : "no measurements yet"} · ${ctx.verifiedFileIds.length} file(s)`;
    const lead = await createLead(tx, {
      prefix: "Q",
      source: "designer_portal",
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
    const project = await tx.designerProject.create({
      data: {
        designerId: account.id,
        requestId: request.id,
        title: input.title,
        clientLabel: input.clientLabel ?? null,
        targetDate: input.targetDate ? new Date(`${input.targetDate}T00:00:00Z`) : null,
        materials: { create: materials.map((m) => ({ materialId: m.id })) },
      },
    });
    await attachUploads(tx, ctx.verifiedFileIds, request.id);
    if (ctx.verifiedFileIds.length) {
      await tx.fileAsset.updateMany({
        where: { id: { in: ctx.verifiedFileIds } },
        data: { designerProjectId: project.id },
      });
    }
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        kind: "message",
        internal: false,
        body: [
          `Designer: ${account.user.name}${account.company ? `, ${account.company}` : ""}`,
          `Project: ${input.title}`,
          input.clientLabel && `Client (designer's label): ${input.clientLabel}`,
          input.targetDate && `Wanted by: ${input.targetDate}`,
          input.area && `Area: ${input.area}`,
          materials.length && `Chosen materials: ${materials.map((m) => `${m.code} ${m.nameEn}`).join("; ")}`,
          input.message && `\n${input.message}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
    await enqueue(tx, "enquiry.received", {
      kind: "quote",
      reference: lead.reference,
      leadId: lead.id,
      locale: input.locale,
      customer: { name: account.user.name, phone: account.phone, email: account.user.email },
      summary,
      ...(await consentFields(tx, customer.id)),
    });
    await audit(tx, {
      actorId: designer.userId,
      action: "designer.project_submitted",
      entityType: "designer_project",
      entityId: project.id,
      changes: { reference: lead.reference, files: ctx.verifiedFileIds.length },
      ipHash: ctx.ipHash,
    });
    return { id: project.id, reference: lead.reference };
  });
}
