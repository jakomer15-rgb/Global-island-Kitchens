import type {
  ApprovalMethod,
  LineItemKind,
  LineUnit,
  Locale,
  Prisma,
  QuotationStatus,
} from "@/generated/prisma/client";
import { computeTotals, lineTotal, MAX_LINES } from "@/lib/money";
import { parseSetting } from "@/lib/site-settings";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import { paged, pageArgs } from "@/server/crm/shared";
import type { Db, Tx } from "@/server/db/client";
import { NotFoundError, RuleError } from "@/server/errors";
import { bahrainToday, nextNumber } from "@/server/numbers";
import { enqueue } from "@/server/outbox/events";

/**
 * Quotations: a draft revision is edited freely; sending locks it (the database refuses later
 * changes); further changes go into a new revision. The customer approves by WhatsApp or phone and
 * staff record it; an approved quotation converts into an order and a project.
 */

export const quotationStatuses: QuotationStatus[] = ["draft", "sent", "approved", "rejected", "converted"];
export const lineKinds: LineItemKind[] = [
  "product",
  "material",
  "hardware",
  "labour",
  "installation",
  "other",
];
export const lineUnits: LineUnit[] = ["unit", "set", "linear_metre", "square_metre"];
export const approvalMethods: ApprovalMethod[] = ["whatsapp", "phone"];

export interface LineInput {
  kind: LineItemKind;
  description: string;
  materialId: string | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  unit: LineUnit;
  quantityMilli: number;
  unitPriceFils: number;
}

export interface DraftInput {
  title: string;
  locale: Locale;
  validUntil: Date | null;
  discountFils: number;
  notes: string | null;
  terms: string | null;
  lines: LineInput[];
}

const fils = (n: number) => BigInt(n);
export const toNumber = (b: bigint) => Number(b);

async function quotationSettings(tx: Tx) {
  const row = await tx.siteSetting.findUnique({ where: { key: "quotation" } });
  return parseSetting("quotation", row?.value);
}

/** VAT applied to new totals: the configured rate when VAT is on, otherwise none. */
async function vatRate(tx: Tx) {
  const s = await quotationSettings(tx);
  return { rate: s.vatEnabled ? s.vatRateBasisPoints : 0, number: s.vatEnabled ? s.vatNumber : null };
}

async function latestRevision(tx: Tx, quotationId: string) {
  const rev = await tx.quotationRevision.findFirst({
    where: { quotationId },
    orderBy: { revision: "desc" },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!rev) throw new NotFoundError("Quotation revision");
  return rev;
}

async function findQuotation(tx: Tx, id: string) {
  const q = await tx.quotation.findUnique({ where: { id } });
  if (!q) throw new NotFoundError("Quotation");
  return q;
}

export async function listQuotations(
  db: Db,
  actor: Actor,
  filters: { status?: QuotationStatus; q?: string; page?: number },
) {
  assertCan(actor, "quotation.read");
  const q = filters.q?.trim();
  const where: Prisma.QuotationWhereInput = {
    ...(filters.status && { status: filters.status }),
    ...(q && {
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { lead: { reference: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };
  const { skip, take, page } = pageArgs(filters.page);
  const [items, total] = await Promise.all([
    db.quotation.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        assignedTo: { select: { name: true } },
        revisions: {
          orderBy: { revision: "desc" },
          take: 1,
          select: { revision: true, totalFils: true, validUntil: true, sentAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
    db.quotation.count({ where }),
  ]);
  return paged(items, total, page);
}

export async function getQuotation(db: Db, actor: Actor, id: string) {
  assertCan(actor, "quotation.read");
  const q = await db.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      lead: { select: { id: true, reference: true, status: true } },
      request: { select: { id: true, reference: true } },
      createdBy: { select: { name: true } },
      assignedTo: { select: { id: true, name: true } },
      revisions: {
        orderBy: { revision: "desc" },
        include: {
          lines: {
            orderBy: { sortOrder: "asc" },
            include: { material: { select: { code: true, nameEn: true } } },
          },
          sentBy: { select: { name: true } },
          approvalRecordedBy: { select: { name: true } },
          order: { select: { id: true, number: true, project: { select: { id: true, reference: true } } } },
        },
      },
    },
  });
  if (!q) throw new NotFoundError("Quotation");
  return q;
}

/** A new quotation for a lead (its customer, request and language), with one empty draft revision. */
export async function createQuotation(db: Db, actor: Actor, input: { leadId: string; title?: string }) {
  assertCan(actor, "quotation.manage");
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({
      where: { id: input.leadId, archivedAt: null },
      include: { customer: true, quotationRequest: { select: { id: true } } },
    });
    if (!lead) throw new NotFoundError("Lead");
    const settings = await quotationSettings(tx);
    const { rate } = await vatRate(tx);
    const locale = lead.customer.preferredLanguage;
    const number = await nextNumber(tx, "QT");
    const validUntil = settings.validityDays
      ? new Date(bahrainToday().getTime() + settings.validityDays * 864e5)
      : null;
    const quotation = await tx.quotation.create({
      data: {
        number,
        customerId: lead.customerId,
        leadId: lead.id,
        requestId: lead.quotationRequest?.id ?? null,
        title: (input.title?.trim() || lead.summary).slice(0, 200),
        locale,
        createdById: actor.id,
        assignedToId: lead.assignedToId ?? actor.id,
        revisions: {
          create: {
            revision: 1,
            vatRateBasisPoints: rate,
            validUntil,
            terms: locale === "ar" ? settings.termsAr : settings.termsEn,
          },
        },
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "quotation.created",
      entityType: "quotation",
      entityId: quotation.id,
      changes: { number, leadId: lead.id },
    });
    return quotation.id;
  });
}

async function assertMaterials(tx: Tx, lines: LineInput[]) {
  const ids = [...new Set(lines.map((l) => l.materialId).filter((m): m is string => Boolean(m)))];
  if (ids.length === 0) return;
  const found = await tx.material.count({
    where: { id: { in: ids }, availability: { not: "discontinued" } },
  });
  if (found !== ids.length)
    throw new RuleError("material", "A chosen material no longer exists or is discontinued.");
}

/** Saves the draft revision: header, discount and lines; totals are recalculated here. */
export async function saveDraft(db: Db, actor: Actor, quotationId: string, input: DraftInput) {
  assertCan(actor, "quotation.manage");
  if (input.lines.length > MAX_LINES) throw new RuleError("lines", `At most ${MAX_LINES} lines.`);
  await db.$transaction(async (tx) => {
    const quotation = await findQuotation(tx, quotationId);
    if (quotation.status !== "draft")
      throw new RuleError("not_draft", "Start a new revision to change a sent quotation.");
    const rev = await latestRevision(tx, quotationId);
    if (rev.lockedAt) throw new RuleError("locked", "This revision has been sent and can't change.");
    await assertMaterials(tx, input.lines);
    const { rate } = await vatRate(tx);
    let totals;
    try {
      totals = computeTotals(input.lines, input.discountFils, rate);
    } catch {
      throw new RuleError("discount", "The discount can't be more than the subtotal.");
    }
    await tx.quotation.update({
      where: { id: quotationId },
      data: { title: input.title, locale: input.locale },
    });
    await tx.quotationLineItem.deleteMany({ where: { revisionId: rev.id } });
    await tx.quotationLineItem.createMany({
      data: input.lines.map((l, i) => ({
        revisionId: rev.id,
        sortOrder: i,
        kind: l.kind,
        description: l.description,
        materialId: l.materialId,
        widthMm: l.widthMm,
        heightMm: l.heightMm,
        depthMm: l.depthMm,
        unit: l.unit,
        quantityMilli: l.quantityMilli,
        unitPriceFils: fils(l.unitPriceFils),
        lineTotalFils: fils(lineTotal(l.quantityMilli, l.unitPriceFils)),
      })),
    });
    await tx.quotationRevision.update({
      where: { id: rev.id },
      data: {
        validUntil: input.validUntil,
        notes: input.notes,
        terms: input.terms,
        subtotalFils: fils(totals.subtotalFils),
        discountFils: fils(totals.discountFils),
        vatRateBasisPoints: totals.vatRateBasisPoints,
        vatFils: fils(totals.vatFils),
        totalFils: fils(totals.totalFils),
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "quotation.draft_saved",
      entityType: "quotation",
      entityId: quotationId,
      changes: { revision: rev.revision, lines: input.lines.length, totalFils: totals.totalFils },
    });
  });
}

/**
 * Locks the draft revision as sent (after the staff member has sent it to the customer, e.g. on
 * WhatsApp). Totals are recalculated with the current VAT setting first. The lead becomes "quoted".
 * Returns the revision id so the caller can attach the PDF.
 */
export async function markSent(db: Db, actor: Actor, quotationId: string, now = new Date()) {
  assertCan(actor, "quotation.manage");
  return db.$transaction(async (tx) => {
    const quotation = await findQuotation(tx, quotationId);
    if (quotation.status !== "draft") throw new RuleError("not_draft", "Only a draft can be sent.");
    const rev = await latestRevision(tx, quotationId);
    if (rev.lines.length === 0) throw new RuleError("no_lines", "Add at least one line before sending.");
    if (!rev.validUntil) throw new RuleError("valid_until", "Set the date the quotation is valid until.");
    if (rev.validUntil < bahrainToday(now))
      throw new RuleError("valid_until", "The validity date has passed.");
    const { rate, number } = await vatRate(tx);
    const totals = computeTotals(
      rev.lines.map((l) => ({ quantityMilli: l.quantityMilli, unitPriceFils: toNumber(l.unitPriceFils) })),
      toNumber(rev.discountFils),
      rate,
    );
    if (totals.totalFils <= 0) throw new RuleError("zero_total", "The quotation total must be above zero.");
    await tx.quotationRevision.update({
      where: { id: rev.id },
      data: {
        subtotalFils: fils(totals.subtotalFils),
        vatRateBasisPoints: rate,
        vatFils: fils(totals.vatFils),
        totalFils: fils(totals.totalFils),
        vatNumber: number,
        sentAt: now,
        sentById: actor.id,
        lockedAt: now,
      },
    });
    await tx.quotation.update({ where: { id: quotationId }, data: { status: "sent" } });
    if (quotation.leadId) {
      const lead = await tx.lead.findUnique({ where: { id: quotation.leadId } });
      if (lead && !["quoted", "won", "lost"].includes(lead.status)) {
        await tx.lead.update({ where: { id: lead.id }, data: { status: "quoted" } });
        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            kind: "status_change",
            authorId: actor.id,
            body: `Status: ${lead.status} → quoted (${quotation.number} rev. ${rev.revision} sent)`,
          },
        });
      }
    }
    if (quotation.requestId)
      await tx.quotationRequest.update({ where: { id: quotation.requestId }, data: { status: "quoted" } });
    await audit(tx, {
      actorId: actor.id,
      action: "quotation.sent",
      entityType: "quotation",
      entityId: quotationId,
      changes: { revision: rev.revision, totalFils: totals.totalFils, vatRateBasisPoints: rate },
    });
    await enqueue(tx, "quotation.sent", {
      quotationId,
      number: quotation.number,
      revision: rev.revision,
      totalFils: totals.totalFils,
    });
    return rev.id;
  });
}

/** Links the stored PDF to a sent revision (allowed on locked revisions). */
export async function attachPdf(db: Db, revisionId: string, fileId: string) {
  await db.quotationRevision.update({ where: { id: revisionId }, data: { pdfFileId: fileId } });
}

/** Copies the latest sent revision into a new draft revision. */
export async function newRevision(db: Db, actor: Actor, quotationId: string) {
  assertCan(actor, "quotation.manage");
  await db.$transaction(async (tx) => {
    const quotation = await findQuotation(tx, quotationId);
    if (quotation.status !== "sent" && quotation.status !== "rejected")
      throw new RuleError("status", "Only a sent or rejected quotation can be revised.");
    const rev = await latestRevision(tx, quotationId);
    const { rate } = await vatRate(tx);
    const lines = rev.lines.map((l) => ({
      quantityMilli: l.quantityMilli,
      unitPriceFils: toNumber(l.unitPriceFils),
    }));
    const totals = computeTotals(lines, toNumber(rev.discountFils), rate);
    await tx.quotationRevision.create({
      data: {
        quotationId,
        revision: rev.revision + 1,
        validUntil: rev.validUntil,
        notes: rev.notes,
        terms: rev.terms,
        subtotalFils: fils(totals.subtotalFils),
        discountFils: fils(totals.discountFils),
        vatRateBasisPoints: rate,
        vatFils: fils(totals.vatFils),
        totalFils: fils(totals.totalFils),
        lines: {
          create: rev.lines.map((l) => ({
            sortOrder: l.sortOrder,
            kind: l.kind,
            description: l.description,
            materialId: l.materialId,
            widthMm: l.widthMm,
            heightMm: l.heightMm,
            depthMm: l.depthMm,
            unit: l.unit,
            quantityMilli: l.quantityMilli,
            unitPriceFils: l.unitPriceFils,
            lineTotalFils: l.lineTotalFils,
          })),
        },
      },
    });
    await tx.quotation.update({
      where: { id: quotationId },
      data: { status: "draft", rejectedReason: null },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "quotation.revised",
      entityType: "quotation",
      entityId: quotationId,
      changes: { from: rev.revision, to: rev.revision + 1 },
    });
  });
}

/** The customer approved the sent revision by WhatsApp or phone; staff record how and who. */
export async function recordApproval(
  db: Db,
  actor: Actor,
  input: { quotationId: string; method: ApprovalMethod; note: string },
  now = new Date(),
) {
  assertCan(actor, "quotation.approve");
  const note = input.note.trim();
  if (note.length < 3) throw new RuleError("note", "Say who approved and how (e.g. the WhatsApp message).");
  await db.$transaction(async (tx) => {
    const quotation = await findQuotation(tx, input.quotationId);
    if (quotation.status !== "sent") throw new RuleError("status", "Only a sent quotation can be approved.");
    const rev = await latestRevision(tx, input.quotationId);
    if (!rev.lockedAt) throw new RuleError("status", "Only a sent revision can be approved.");
    await tx.quotationRevision.update({
      where: { id: rev.id },
      data: {
        approvedAt: now,
        approvalMethod: input.method,
        approvalNote: note,
        approvalRecordedById: actor.id,
      },
    });
    await tx.quotation.update({ where: { id: quotation.id }, data: { status: "approved" } });
    if (quotation.leadId) {
      const lead = await tx.lead.findUnique({ where: { id: quotation.leadId } });
      if (lead) {
        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            kind: input.method === "whatsapp" ? "whatsapp" : "call",
            authorId: actor.id,
            body: `${quotation.number} rev. ${rev.revision} approved by the customer: ${note}`,
          },
        });
        if (lead.status !== "won") {
          await tx.lead.update({ where: { id: lead.id }, data: { status: "won", lostReason: null } });
          await tx.leadActivity.create({
            data: {
              leadId: lead.id,
              kind: "status_change",
              authorId: actor.id,
              body: `Status: ${lead.status} → won`,
            },
          });
        }
      }
    }
    await audit(tx, {
      actorId: actor.id,
      action: "quotation.approved",
      entityType: "quotation",
      entityId: quotation.id,
      changes: { revision: rev.revision, method: input.method, note },
    });
    await enqueue(tx, "quotation.approved", {
      quotationId: quotation.id,
      number: quotation.number,
      revision: rev.revision,
      totalFils: Number(rev.totalFils),
    });
  });
}

export async function recordRejection(db: Db, actor: Actor, input: { quotationId: string; reason: string }) {
  assertCan(actor, "quotation.approve");
  const reason = input.reason.trim();
  if (reason.length < 3) throw new RuleError("reason", "Say why the customer declined.");
  await db.$transaction(async (tx) => {
    const quotation = await findQuotation(tx, input.quotationId);
    if (quotation.status !== "sent") throw new RuleError("status", "Only a sent quotation can be declined.");
    await tx.quotation.update({
      where: { id: quotation.id },
      data: { status: "rejected", rejectedReason: reason },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "quotation.rejected",
      entityType: "quotation",
      entityId: quotation.id,
      changes: { reason },
    });
  });
}

/**
 * Turns the approved revision into an order, and the order into a project: the lead's open project
 * (without an order) if there is one, otherwise a new one, moved to the production stage.
 */
export async function convertToOrder(db: Db, actor: Actor, quotationId: string) {
  assertCan(actor, "quotation.approve");
  assertCan(actor, "project.manage");
  return db.$transaction(async (tx) => {
    const quotation = await findQuotation(tx, quotationId);
    if (quotation.status !== "approved")
      throw new RuleError("status", "Only an approved quotation can be converted.");
    const rev = await latestRevision(tx, quotationId);
    if (!rev.approvedAt) throw new RuleError("status", "The latest revision isn't approved.");
    const order = await tx.order.create({
      data: {
        number: await nextNumber(tx, "OR"),
        quotationRevisionId: rev.id,
        customerId: quotation.customerId,
        totalFils: rev.totalFils,
      },
    });
    const existing = quotation.leadId
      ? await tx.project.findFirst({
          where: { leadId: quotation.leadId, orderId: null },
          orderBy: { createdAt: "desc" },
        })
      : null;
    const project = existing
      ? await tx.project.update({
          where: { id: existing.id },
          data: { orderId: order.id, stage: "production" },
        })
      : await tx.project.create({
          data: {
            reference: await nextNumber(tx, "PR"),
            customerId: quotation.customerId,
            leadId: quotation.leadId,
            orderId: order.id,
            title: quotation.title,
            stage: "production",
            assignedToId: quotation.assignedToId,
          },
        });
    if (!existing || existing.stage !== "production") {
      await tx.projectStageChange.create({
        data: {
          projectId: project.id,
          fromStage: existing?.stage ?? null,
          toStage: "production",
          changedById: actor.id,
          note: `Order ${order.number} from ${quotation.number} rev. ${rev.revision}`,
        },
      });
    }
    await tx.quotation.update({ where: { id: quotationId }, data: { status: "converted" } });
    await audit(tx, {
      actorId: actor.id,
      action: "quotation.converted",
      entityType: "quotation",
      entityId: quotationId,
      changes: { orderId: order.id, orderNumber: order.number, projectId: project.id },
    });
    return { orderId: order.id, projectId: project.id };
  });
}

/** Deletes a quotation that was never sent. */
export async function deleteDraftQuotation(db: Db, actor: Actor, quotationId: string) {
  assertCan(actor, "quotation.manage");
  await db.$transaction(async (tx) => {
    const quotation = await findQuotation(tx, quotationId);
    const sent = await tx.quotationRevision.count({ where: { quotationId, lockedAt: { not: null } } });
    if (quotation.status !== "draft" || sent > 0)
      throw new RuleError("sent", "A quotation that has been sent is kept for the record.");
    await tx.quotation.delete({ where: { id: quotationId } });
    await audit(tx, {
      actorId: actor.id,
      action: "quotation.deleted",
      entityType: "quotation",
      entityId: quotationId,
      changes: { number: quotation.number },
    });
  });
}
