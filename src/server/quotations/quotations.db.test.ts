import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contactSchema } from "@/lib/forms/contact";
import { createStaffUser } from "@/server/auth/accounts";
import { ForbiddenError, resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { createPrismaClient } from "@/server/db/client";
import { submitContact } from "@/server/enquiries/submit";
import { RuleError } from "@/server/errors";
import { updateSetting } from "@/server/settings/update";
import { changeStage, createProjectFromLead, updateOrder } from "./projects";
import {
  convertToOrder,
  createQuotation,
  deleteDraftQuotation,
  markSent,
  newRevision,
  recordApproval,
  recordRejection,
  saveDraft,
  type DraftInput,
} from "./quotations";

const db = createPrismaClient();
const uid = () => Math.random().toString(36).slice(2, 10);
const phone = () => `3${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const base = {
  website: "",
  startedAt: Date.now() - 60_000,
  locale: "en",
  consentEmail: false,
  consentWhatsapp: false,
  privacyAccepted: true,
};
const inDays = (n: number) =>
  new Date(`${new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)}T00:00:00Z`);

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

async function lead() {
  const { reference } = await submitContact(
    db,
    contactSchema.parse({ ...base, name: "Quote Test", phone: phone(), message: "Kitchen for a new villa" }),
    { ipHash: null },
  );
  return db.lead.findUniqueOrThrow({ where: { reference } });
}

const draft = (over: Partial<DraftInput> = {}): DraftInput => ({
  title: "Kitchen, Riffa villa",
  locale: "en",
  validUntil: inDays(30),
  discountFils: 100_000,
  notes: null,
  terms: null,
  lines: [
    {
      kind: "product",
      description: "Kitchen base and wall units, EGGER laminate fronts",
      materialId: null,
      widthMm: 3200,
      heightMm: 2400,
      depthMm: 600,
      unit: "linear_metre",
      quantityMilli: 3200,
      unitPriceFils: 450_000,
    },
    {
      kind: "installation",
      description: "Installation",
      materialId: null,
      widthMm: null,
      heightMm: null,
      depthMm: null,
      unit: "unit",
      quantityMilli: 1000,
      unitPriceFils: 150_000,
    },
  ],
  ...over,
});

let owner: Actor;
let sales: Actor;
let production: Actor;
let editor: Actor;

beforeAll(async () => {
  [owner, sales, production, editor] = await Promise.all([
    staff(["owner"]),
    staff(["sales_manager"]),
    staff(["production_supervisor"]),
    staff(["content_editor"]),
  ]);
  // VAT off unless a test turns it on.
  await updateSetting(db, owner, "quotation", {
    vatEnabled: false,
    vatRateBasisPoints: 1000,
    vatNumber: null,
    termsEn: "Terms in English",
    termsAr: null,
    validityDays: null,
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("quotations", () => {
  it("runs a quotation from draft to order and project", async () => {
    const l = await lead();
    const id = await createQuotation(db, sales, { leadId: l.id });
    const q = await db.quotation.findUniqueOrThrow({ where: { id }, include: { revisions: true } });
    expect(q.number).toMatch(/^GIK-QT-\d{4}-\d{5}$/);
    expect(q.revisions[0]).toMatchObject({ revision: 1, terms: "Terms in English", vatRateBasisPoints: 0 });

    await expect(markSent(db, sales, id)).rejects.toThrow(/at least one line/);
    await saveDraft(db, sales, id, draft());
    const rev = await db.quotationRevision.findFirstOrThrow({ where: { quotationId: id } });
    // 3.2 lm × 450.000 = 1440.000; + 150.000; − 100.000 discount; no VAT
    expect(rev).toMatchObject({
      subtotalFils: 1_590_000n,
      discountFils: 100_000n,
      vatFils: 0n,
      totalFils: 1_490_000n,
    });

    await markSent(db, sales, id);
    expect((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("quoted");
    await expect(saveDraft(db, sales, id, draft())).rejects.toBeInstanceOf(RuleError);

    await recordApproval(db, sales, {
      quotationId: id,
      method: "whatsapp",
      note: "Customer replied 'approved' on WhatsApp",
    });
    expect((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("won");
    const { orderId, projectId } = await convertToOrder(db, sales, id);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ totalFils: 1_490_000n, status: "confirmed" });
    expect(order.number).toMatch(/^GIK-OR-/);
    const project = await db.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { stageChanges: true },
    });
    expect(project).toMatchObject({ stage: "production", orderId });
    expect(project.stageChanges.map((c) => c.toStage)).toEqual(["production"]);
    expect((await db.quotation.findUniqueOrThrow({ where: { id } })).status).toBe("converted");
    await expect(convertToOrder(db, sales, id)).rejects.toBeInstanceOf(RuleError);
  });

  it("adds VAT only when it is turned on, and keeps revisions", async () => {
    await updateSetting(db, owner, "quotation", {
      vatEnabled: true,
      vatRateBasisPoints: 1000,
      vatNumber: "TEST-VAT-1",
      termsEn: null,
      termsAr: null,
      validityDays: 30,
    });
    try {
      const id = await createQuotation(db, sales, { leadId: (await lead()).id });
      await saveDraft(db, sales, id, draft({ discountFils: 0 }));
      await markSent(db, sales, id);
      const r1 = await db.quotationRevision.findFirstOrThrow({ where: { quotationId: id, revision: 1 } });
      expect(r1).toMatchObject({
        vatRateBasisPoints: 1000,
        vatFils: 159_000n,
        totalFils: 1_749_000n,
        vatNumber: "TEST-VAT-1",
      });
      expect(r1.validUntil).not.toBeNull();

      await recordRejection(db, sales, { quotationId: id, reason: "Price too high" });
      await newRevision(db, sales, id);
      const q = await db.quotation.findUniqueOrThrow({
        where: { id },
        include: { revisions: { include: { lines: true } } },
      });
      expect(q.status).toBe("draft");
      expect(q.revisions).toHaveLength(2);
      expect(q.revisions.find((r) => r.revision === 2)!.lines).toHaveLength(2);
      await saveDraft(db, sales, id, draft({ discountFils: 200_000 }));
      const r2 = await db.quotationRevision.findFirstOrThrow({ where: { quotationId: id, revision: 2 } });
      expect(r2.totalFils).toBe(1_529_000n); // (1590 − 200) × 1.1
      // Revision 1 is untouched.
      expect((await db.quotationRevision.findUniqueOrThrow({ where: { id: r1.id } })).totalFils).toBe(
        1_749_000n,
      );
    } finally {
      await updateSetting(db, owner, "quotation", {
        vatEnabled: false,
        vatRateBasisPoints: 1000,
        vatNumber: null,
        termsEn: "Terms in English",
        termsAr: null,
        validityDays: null,
      });
    }
  });

  it("refuses bad drafts and only lets the right roles act", async () => {
    const id = await createQuotation(db, sales, { leadId: (await lead()).id });
    await expect(saveDraft(db, sales, id, draft({ discountFils: 99_000_000 }))).rejects.toThrow(/discount/);
    await saveDraft(db, sales, id, draft({ validUntil: inDays(-2) }));
    await expect(markSent(db, sales, id)).rejects.toThrow(/validity date has passed/);
    await expect(createQuotation(db, editor, { leadId: (await lead()).id })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(saveDraft(db, production, id, draft())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      recordApproval(db, sales, { quotationId: id, method: "phone", note: "ok by phone" }),
    ).rejects.toThrow(/Only a sent/);
    await deleteDraftQuotation(db, sales, id);
    expect(await db.quotation.count({ where: { id } })).toBe(0);
  });

  it("enforces the arithmetic and locking in the database", async () => {
    const id = await createQuotation(db, sales, { leadId: (await lead()).id });
    await saveDraft(db, sales, id, draft());
    const rev = await db.quotationRevision.findFirstOrThrow({
      where: { quotationId: id },
      include: { lines: true },
    });
    await expect(
      db.quotationRevision.update({ where: { id: rev.id }, data: { totalFils: 1n } }),
    ).rejects.toThrow(/quotation_revisions_amounts_valid/);
    await expect(
      db.quotationLineItem.update({ where: { id: rev.lines[0]!.id }, data: { lineTotalFils: 5n } }),
    ).rejects.toThrow(/quotation_line_items_amounts_valid/);

    await markSent(db, sales, id);
    await expect(
      db.quotationRevision.update({ where: { id: rev.id }, data: { notes: "changed after sending" } }),
    ).rejects.toThrow(/locked/);
    await expect(db.quotationLineItem.deleteMany({ where: { revisionId: rev.id } })).rejects.toThrow(
      /locked/,
    );
    await expect(
      db.quotationRevision.update({ where: { id: rev.id }, data: { approvedAt: new Date() } }),
    ).rejects.toThrow(/quotation_revisions_approval_complete/);
    await expect(deleteDraftQuotation(db, sales, id)).rejects.toThrow(/kept for the record/);
  });
});

describe("projects and orders", () => {
  it("tracks a project from the lead, then attaches the order", async () => {
    const l = await lead();
    const projectId = await createProjectFromLead(db, sales, { leadId: l.id });
    await expect(createProjectFromLead(db, sales, { leadId: l.id })).rejects.toThrow(
      /already has an open project/,
    );
    await changeStage(db, production, { projectId, stage: "measurement", note: null });
    await changeStage(db, production, { projectId, stage: "design", note: "Drawings started" });
    await expect(
      changeStage(db, production, { projectId, stage: "measurement", note: null }),
    ).rejects.toThrow(/moving back/);
    await expect(
      changeStage(db, editor, { projectId, stage: "quotation", note: null }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const id = await createQuotation(db, sales, { leadId: l.id });
    await saveDraft(db, sales, id, draft());
    await markSent(db, sales, id);
    await recordApproval(db, sales, { quotationId: id, method: "phone", note: "Mr B. approved by phone" });
    const { orderId, projectId: converted } = await convertToOrder(db, sales, id);
    expect(converted).toBe(projectId);
    const project = await db.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { stageChanges: { orderBy: { changedAt: "asc" } } },
    });
    expect(project.stage).toBe("production");
    expect(project.stageChanges.map((c) => c.toStage)).toEqual([
      "inquiry",
      "measurement",
      "design",
      "production",
    ]);
    await expect(
      db.projectStageChange.update({ where: { id: project.stageChanges[0]!.id }, data: { note: "x" } }),
    ).rejects.toThrow(/append-only/);

    await expect(
      updateOrder(db, sales, orderId, {
        status: "in_production",
        depositFils: 9_999_999_999,
        depositReceived: false,
      }),
    ).rejects.toThrow(/more than the order total/);
    await expect(
      updateOrder(db, sales, orderId, { status: "in_production", depositFils: null, depositReceived: true }),
    ).rejects.toThrow(/deposit amount/);
    await updateOrder(db, sales, orderId, {
      status: "in_production",
      depositFils: 500_000,
      depositReceived: true,
    });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ status: "in_production", depositFils: 500_000n });
    expect(order.depositReceivedAt).not.toBeNull();
    expect(
      await db.auditLog.count({ where: { entityType: "project", entityId: projectId } }),
    ).toBeGreaterThanOrEqual(3);
  });
});
