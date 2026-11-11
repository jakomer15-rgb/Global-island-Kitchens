import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LeadStatus, LeadTemperature } from "@/generated/prisma/client";
import { leadScore } from "@/lib/lead-score";
import { createStaffUser } from "@/server/auth/accounts";
import { ForbiddenError, resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { exportLeadsCsv } from "@/server/chat/admin";
import { createPrismaClient } from "@/server/db/client";
import { findOrCreateCustomer, nextReference } from "@/server/enquiries/submit";
import { duplicatesOf, getCustomer, mergeCustomers, possibleDuplicates } from "./customers";
import {
  changeLeadStatus,
  completeFollowUp,
  leadPipeline,
  listLeads,
  logActivity,
  scheduleFollowUp,
} from "./leads";

const db = createPrismaClient();
const uid = () => Math.random().toString(36).slice(2, 10);
const phone = () => `+9733${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

async function staff(roleKeys: string[]): Promise<Actor> {
  const id = await db.$transaction((tx) =>
    createStaffUser(tx, {
      email: `crm-${uid()}@example.test`,
      name: `CRM ${uid()}`,
      password: "a long test password",
      roleKeys,
      actorId: null,
      via: "test",
    }),
  );
  return resolveActor(await db.user.findUniqueOrThrow({ where: { id }, include: userWithRolesInclude }))!;
}

async function customer(name = `Customer ${uid()}`, over: object = {}) {
  return db.customer.create({ data: { name, phone: phone(), ...over } });
}

async function lead(
  customerId: string,
  over: { status?: LeadStatus; temperature?: LeadTemperature; category?: string } = {},
) {
  return db.lead.create({
    data: {
      reference: await nextReference(db, "M"),
      customerId,
      source: "phone",
      summary: "Test lead",
      ...over,
    },
  });
}

const score = async (id: string) => (await db.lead.findUniqueOrThrow({ where: { id } })).score;

let owner: Actor;
let sales: Actor;
let supervisor: Actor;
beforeAll(async () => {
  [owner, sales, supervisor] = await Promise.all([
    staff(["owner"]),
    staff(["sales_manager"]),
    staff(["production_supervisor"]),
  ]);
});
afterAll(() => db.$disconnect());

describe("lead score (kept by the database)", () => {
  it("rises with the rating, the stage and known requirements, and clears when decided", async () => {
    const c = await customer();
    const l = await lead(c.id);
    expect(await score(l.id)).toBe(0);
    await db.lead.update({ where: { id: l.id }, data: { temperature: "hot" } });
    expect(await score(l.id)).toBe(40);
    await db.leadRequirement.create({
      data: { leadId: l.id, dimensions: "4 m wall", budget: "about 3,000 BHD" },
    });
    expect(await score(l.id)).toBe(60);
    await db.leadRequirement.update({
      where: { leadId: l.id },
      data: { timeline: "next month", location: "Riffa" },
    });
    expect(await score(l.id)).toBe(75);
    await changeLeadStatus(db, sales, { id: l.id, status: "measurement" });
    expect(await score(l.id)).toBe(95);
    await db.lead.update({ where: { id: l.id }, data: { category: "woodenKitchens" } });
    expect(await score(l.id)).toBe(100);
    await changeLeadStatus(db, sales, { id: l.id, status: "won" });
    expect(await score(l.id)).toBeNull();
  });

  it("counts measurements and the area from a quotation request", async () => {
    const c = await customer();
    const l = await lead(c.id, { category: "wardrobes" });
    await db.quotationRequest.create({
      data: {
        reference: await nextReference(db, "Q"),
        leadId: l.id,
        customerId: c.id,
        category: "wardrobes",
        measurements: [{ label: "Wall A", width: 2400 }],
        unit: "mm",
        area: "Saar",
      },
    });
    expect(await score(l.id)).toBe(5 + 10 + 5);
  });

  it("matches the breakdown shown to staff for every stage and rating", async () => {
    const c = await customer();
    for (const status of [
      "new",
      "contacted",
      "qualified",
      "site_visit",
      "measurement",
      "quoted",
      "negotiation",
      "lost",
    ] as const) {
      for (const temperature of ["hot", "warm", "cold", null] as const) {
        const l = await lead(c.id, {
          status: status === "lost" ? "new" : status,
          ...(temperature ? { temperature } : {}),
        });
        await db.leadRequirement.create({ data: { leadId: l.id, budget: "5k", location: "Isa Town" } });
        if (status === "lost")
          await changeLeadStatus(db, sales, { id: l.id, status: "lost", lostReason: "test" });
        const expected = leadScore({
          status,
          temperature,
          category: null,
          requirements: { budget: "5k", location: "Isa Town" },
          measured: false,
          area: null,
        });
        expect(await score(l.id), `${status}/${temperature}`).toBe(expected);
      }
    }
  });
});

describe("last contact and next follow-up (kept by the database)", () => {
  it("last contact follows calls, emails, WhatsApp and meetings, not notes", async () => {
    const c = await customer();
    const l = await lead(c.id);
    await logActivity(db, sales, { leadId: l.id, kind: "note", body: "internal" });
    expect((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).lastContactAt).toBeNull();
    await logActivity(db, sales, { leadId: l.id, kind: "call", body: "Called, will send drawings" });
    const after = await db.lead.findUniqueOrThrow({ where: { id: l.id } });
    expect(after.lastContactAt).not.toBeNull();
    expect(after.status).toBe("contacted");
  });

  it("next follow-up is the earliest open one", async () => {
    const c = await customer();
    const l = await lead(c.id);
    const soon = new Date(Date.now() + 2 * 86_400_000);
    const later = new Date(Date.now() + 5 * 86_400_000);
    await scheduleFollowUp(db, sales, { leadId: l.id, dueAt: later, assignedToId: sales.id });
    await scheduleFollowUp(db, sales, { leadId: l.id, dueAt: soon, assignedToId: sales.id });
    expect((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).nextFollowUpAt).toEqual(soon);
    const first = await db.followUp.findFirstOrThrow({ where: { leadId: l.id, dueAt: soon } });
    await completeFollowUp(db, sales, first.id);
    expect((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).nextFollowUpAt).toEqual(later);
    const second = await db.followUp.findFirstOrThrow({ where: { leadId: l.id, dueAt: later } });
    await completeFollowUp(db, sales, second.id);
    expect((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).nextFollowUpAt).toBeNull();
  });
});

describe("lists, pipeline and export", () => {
  it("filters by customer type, follow-up and minimum score, and sorts by score", async () => {
    const tag = uid();
    const c = await customer(`Architect ${tag}`, { type: "architect" });
    const low = await lead(c.id, { temperature: "cold" });
    const high = await lead(c.id, { temperature: "hot", category: "tvUnits" });
    await scheduleFollowUp(db, sales, {
      leadId: low.id,
      dueAt: new Date(Date.now() - 3_600_000),
      assignedToId: sales.id,
    });

    const byType = await listLeads(db, sales, { q: tag, customerType: "architect", sort: "score" });
    expect(byType.items.map((l) => l.id)).toEqual([high.id, low.id]);
    const overdue = await listLeads(db, sales, { q: tag, followUp: "overdue" });
    expect(overdue.items.map((l) => l.id)).toEqual([low.id]);
    const scored = await listLeads(db, sales, { q: tag, minScore: 40 });
    expect(scored.items.map((l) => l.id)).toEqual([high.id]);
    expect((await listLeads(db, sales, { q: tag, customerType: "developer" })).total).toBe(0);
  });

  it("groups open leads by stage, highest score first", async () => {
    const tag = uid();
    const c = await customer(`Pipeline ${tag}`);
    const a = await lead(c.id, { status: "site_visit", temperature: "warm" });
    const b = await lead(c.id, { status: "site_visit", temperature: "hot" });
    await lead(c.id, { status: "negotiation" });
    const p = await leadPipeline(db, sales, { q: tag });
    expect(p.stages.map((s) => s.status)).toEqual([
      "new",
      "contacted",
      "qualified",
      "site_visit",
      "measurement",
      "quoted",
      "negotiation",
    ]);
    const visit = p.stages.find((s) => s.status === "site_visit")!;
    expect(visit.count).toBe(2);
    expect(visit.leads.map((l) => l.id)).toEqual([b.id, a.id]);
    expect(p.stages.find((s) => s.status === "negotiation")!.count).toBe(1);
    await expect(leadPipeline(db, { ...sales, permissions: new Set() }, {})).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("exports the filtered list with score, customer type and dates", async () => {
    const tag = uid();
    const c = await customer(`Export ${tag}`, { type: "contractor", location: "Sitra" });
    await lead(c.id, { temperature: "warm", status: "qualified" });
    const { csv, rows } = await exportLeadsCsv(db, owner, { q: tag }, null);
    expect(rows).toBe(1);
    const [header, row] = csv.replace(/^﻿/, "").split("\r\n");
    expect(header).toContain("Score,Customer,Phone,Email,Customer type,Customer location");
    expect(header).toContain("Last contact,Next follow-up");
    expect(row).toContain("Qualified,WARM,35,");
    expect(row).toContain("Contractor,Sitra");
  });
});

describe("duplicate customers", () => {
  it("finds same-name customers and merges one into the other", async () => {
    const name = `Fatima ${uid()} Ali`;
    const keep = await customer(name, { location: null });
    const dup = await customer(`  ${name.toUpperCase()} `, {
      email: `dup-${uid()}@example.test`,
      location: "Muharraq",
      company: "Studio X",
    });
    const keepLead = await lead(keep.id);
    const dupLead = await lead(dup.id, { temperature: "hot" });
    await db.consentRecord.create({
      data: { customerId: dup.id, channel: "whatsapp", granted: true, source: "website_quote" },
    });

    expect(
      (await possibleDuplicates(db, sales)).some(
        (g) => g.some((c) => c.id === keep.id) && g.some((c) => c.id === dup.id),
      ),
    ).toBe(true);
    expect((await duplicatesOf(db, sales, keep.id)).map((c) => c.id)).toEqual([dup.id]);

    await expect(mergeCustomers(db, supervisor, { keepId: keep.id, mergeId: dup.id })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(mergeCustomers(db, sales, { keepId: keep.id, mergeId: keep.id })).rejects.toThrow(
      /different/,
    );

    const moved = await mergeCustomers(db, sales, { keepId: keep.id, mergeId: dup.id });
    expect(moved.leads).toBe(1);
    expect((await db.lead.findUniqueOrThrow({ where: { id: dupLead.id } })).customerId).toBe(keep.id);
    expect((await db.lead.findUniqueOrThrow({ where: { id: keepLead.id } })).customerId).toBe(keep.id);

    const kept = await getCustomer(db, sales, keep.id);
    expect(kept.location).toBe("Muharraq");
    expect(kept.company).toBe("Studio X");
    expect(kept.currentConsent.whatsapp?.granted).toBe(true);
    expect(kept.currentConsent.whatsapp?.source).toBe("merged:website_quote");
    expect(kept.mergedFrom.map((m) => m.id)).toEqual([dup.id]);

    const archived = await db.customer.findUniqueOrThrow({ where: { id: dup.id } });
    expect(archived.archivedAt).not.toBeNull();
    expect(archived.mergedIntoId).toBe(keep.id);
    expect(archived.email).toBe(dup.email); // kept, so new enquiries can be matched

    // A new enquiry with the duplicate's email arrives on the kept record.
    const matched = await db.$transaction((tx) =>
      findOrCreateCustomer(tx, { name: "Fatima", email: dup.email!, locale: "en" }),
    );
    expect(matched.id).toBe(keep.id);

    // Merging the kept record further moves the earlier merge along with it.
    const third = await customer(name);
    await mergeCustomers(db, owner, { keepId: third.id, mergeId: keep.id });
    expect((await db.customer.findUniqueOrThrow({ where: { id: dup.id } })).mergedIntoId).toBe(third.id);
    const again = await db.$transaction((tx) =>
      findOrCreateCustomer(tx, { name: "F", email: dup.email!, locale: "en" }),
    );
    expect(again.id).toBe(third.id);

    expect(
      await db.auditLog.count({ where: { action: "customer.merged", entityId: { in: [keep.id, dup.id] } } }),
    ).toBeGreaterThanOrEqual(2);
  });
});
