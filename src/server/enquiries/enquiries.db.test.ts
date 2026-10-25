import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyPassword } from "better-auth/crypto";
import { createStaffUser } from "@/server/auth/accounts";
import { resolveActor, userWithRolesInclude, ForbiddenError } from "@/server/auth/staff";
import { createPrismaClient } from "@/server/db/client";
import { listRecentEnquiries } from "@/server/leads/queries";
import { processOutbox } from "@/server/outbox/worker";
import { rateLimit, rateLimitCount } from "@/server/rate-limit";
import { localDriver, writeLocal } from "@/server/storage/local";
import { startUpload, sweepStaleUploads, verifyUploads } from "@/server/storage/files";
import { contactSchema } from "@/lib/forms/contact";
import { consultationSchema } from "@/lib/forms/consultation";
import { quoteRequestSchema } from "@/lib/forms/quote";
import { nextReference, submitConsultation, submitContact, submitQuoteRequest } from "./submit";

const db = createPrismaClient();
let root: string;
let storage: ReturnType<typeof localDriver>;

const uid = () => Math.random().toString(36).slice(2, 10);
const phone = () => `3${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(120).fill(7)]);
const base = {
  website: "",
  startedAt: Date.now() - 60_000,
  locale: "en",
  consentEmail: false,
  consentWhatsapp: false,
  privacyAccepted: true,
};

function quote(over: Record<string, unknown> = {}) {
  return quoteRequestSchema.parse({
    ...base,
    category: "wardrobes",
    unit: "cm",
    walls: [{ label: "Back wall", width: 320, height: 270 }],
    noMeasurements: false,
    boards: ["egger"],
    files: [],
    name: "Test Customer",
    phone: phone(),
    customerType: "homeowner",
    ...over,
  });
}

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "gik-uploads-"));
  storage = localDriver(root, "test-secret");
});

afterAll(async () => {
  await db.$disconnect();
  await rm(root, { recursive: true, force: true });
});

describe("database rules", () => {
  it("rejects malformed customer data", async () => {
    await expect(db.customer.create({ data: { name: "X" } })).rejects.toThrow(/customers_has_contact/);
    await expect(db.customer.create({ data: { name: "X", email: "Upper@Example.com" } })).rejects.toThrow(
      /customers_email_lowercase/,
    );
    await expect(db.customer.create({ data: { name: "X", phone: "34597636" } })).rejects.toThrow(
      /customers_phone_e164/,
    );
  });

  it("requires a reason for lost leads", async () => {
    const c = await db.customer.create({ data: { name: "Rule test", phone: `+973${phone()}` } });
    const lead = await db.lead.create({
      data: { reference: await nextReference(db, "M"), customerId: c.id, source: "phone", summary: "x" },
    });
    await expect(db.lead.update({ where: { id: lead.id }, data: { status: "lost" } })).rejects.toThrow(
      /leads_lost_needs_reason/,
    );
    await db.lead.update({
      where: { id: lead.id },
      data: { status: "lost", lostReason: "Chose another supplier" },
    });
  });

  it("keeps the audit log and consent history append-only", async () => {
    const entry = await db.auditLog.create({ data: { action: "test", entityType: "test" } });
    await expect(
      db.auditLog.update({ where: { id: entry.id }, data: { action: "changed" } }),
    ).rejects.toThrow(/append-only/);
    await expect(db.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
  });

  it("only lets verified files be attached", async () => {
    const file = await db.fileAsset.create({
      data: { storageKey: `incoming/${uid()}`, originalName: "a.png", mimeType: "image/png", sizeBytes: 10 },
    });
    const { reference } = await submitQuoteRequest(db, quote(), { ipHash: null, verifiedFileIds: [] });
    const request = await db.quotationRequest.findUniqueOrThrow({ where: { reference } });
    await expect(
      db.fileAsset.update({ where: { id: file.id }, data: { quotationRequestId: request.id } }),
    ).rejects.toThrow(/file_assets_linked_needs_verified/);
  });

  it("issues unique, well-formed references", async () => {
    const refs = await Promise.all([nextReference(db, "Q"), nextReference(db, "Q"), nextReference(db, "C")]);
    expect(new Set(refs).size).toBe(3);
    for (const r of refs) expect(r).toMatch(/^GIK-[QC]-\d{4}-\d{5,}$/);
  });
});

describe("quotation requests", () => {
  it("saves customer, lead, request, files, consent, outbox event and audit in one go", async () => {
    const started = await startUpload(db, storage, {
      name: "kitchen.png",
      type: "image/png",
      size: PNG.length,
      ipHash: "ip1",
    });
    await writeLocal(
      root,
      (await db.fileAsset.findUniqueOrThrow({ where: { id: started.id } })).storageKey,
      PNG,
    );
    const verified = await verifyUploads(db, storage, [{ id: started.id, ticket: started.ticket }]);
    const input = quote({
      email: `q-${uid()}@example.com`,
      consentEmail: true,
      files: [{ id: started.id, ticket: started.ticket }],
    });

    const { reference } = await submitQuoteRequest(db, input, { ipHash: "ip1", verifiedFileIds: verified });

    const lead = await db.lead.findUniqueOrThrow({
      where: { reference },
      include: {
        customer: { include: { consents: true } },
        quotationRequest: { include: { files: true } },
        activities: true,
      },
    });
    expect(lead).toMatchObject({ source: "website_quote", status: "new", category: "wardrobes" });
    expect(lead.customer.phone).toBe(input.phone);
    expect(lead.quotationRequest?.preferredBoards).toEqual(["egger"]);
    expect(lead.quotationRequest?.files.map((f) => f.id)).toEqual([started.id]);
    expect(lead.customer.consents).toEqual([
      expect.objectContaining({ channel: "email", granted: true, source: "website_quote" }),
    ]);
    expect(lead.activities[0]?.body).toContain(input.phone);
    const event = await db.outboxEvent.findFirstOrThrow({
      where: { type: "enquiry.received", payload: { path: ["reference"], equals: reference } },
    });
    expect(event.status).toBe("pending");
    expect(await db.auditLog.count({ where: { entityId: lead.id, action: "enquiry.received" } })).toBe(1);
  });

  it("refuses uploads with a wrong ticket, a wrong file type, or that were already used", async () => {
    const started = await startUpload(db, storage, {
      name: "plan.pdf",
      type: "application/pdf",
      size: PNG.length,
      ipHash: null,
    });
    const key = (await db.fileAsset.findUniqueOrThrow({ where: { id: started.id } })).storageKey;
    await expect(
      verifyUploads(db, storage, [{ id: started.id, ticket: "x".repeat(32) }]),
    ).rejects.toMatchObject({ code: "fileMissing" });
    await expect(
      verifyUploads(db, storage, [{ id: started.id, ticket: started.ticket }]),
    ).rejects.toMatchObject({ code: "fileNotUploaded" });
    await writeLocal(root, key, PNG); // PNG bytes declared as PDF
    await expect(
      verifyUploads(db, storage, [{ id: started.id, ticket: started.ticket }]),
    ).rejects.toMatchObject({ code: "fileRejected" });
    expect((await db.fileAsset.findUniqueOrThrow({ where: { id: started.id } })).status).toBe("rejected");

    const ok = await startUpload(db, storage, {
      name: "a.png",
      type: "image/png",
      size: PNG.length,
      ipHash: null,
    });
    await writeLocal(root, (await db.fileAsset.findUniqueOrThrow({ where: { id: ok.id } })).storageKey, PNG);
    const ids = await verifyUploads(db, storage, [ok]);
    await submitQuoteRequest(db, quote(), { ipHash: null, verifiedFileIds: ids });
    await expect(verifyUploads(db, storage, [ok])).rejects.toMatchObject({ code: "fileMissing" });
  });

  it("rejects disallowed and oversized uploads before anything is stored", async () => {
    await expect(
      startUpload(db, storage, { name: "x.svg", type: "image/svg+xml", size: 10, ipHash: null }),
    ).rejects.toMatchObject({ code: "fileType" });
    await expect(
      startUpload(db, storage, { name: "x.png", type: "image/png", size: 16 * 1024 * 1024, ipHash: null }),
    ).rejects.toMatchObject({ code: "fileTooLarge" });
  });

  it("reuses an existing customer by phone without changing their record", async () => {
    const p = phone();
    const first = await submitQuoteRequest(db, quote({ phone: p, name: "Original Name" }), {
      ipHash: null,
      verifiedFileIds: [],
    });
    const second = await submitQuoteRequest(
      db,
      quote({ phone: p, name: "Someone Else", email: `other-${uid()}@example.com` }),
      {
        ipHash: null,
        verifiedFileIds: [],
      },
    );
    const leads = await db.lead.findMany({
      where: { reference: { in: [first.reference, second.reference] } },
      include: { customer: true, activities: true },
    });
    expect(leads[0]!.customerId).toBe(leads[1]!.customerId);
    expect(leads[0]!.customer).toMatchObject({ name: "Original Name", email: null });
    // What the second visitor typed is kept on their lead.
    const secondLead = leads.find((l) => l.reference === second.reference)!;
    expect(secondLead.activities[0]?.body).toContain("Someone Else");
  });
});

describe("consultations and contact messages", () => {
  it("saves a consultation request", async () => {
    const input = consultationSchema().parse({
      ...base,
      type: "site_visit",
      preferredDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
      preferredSlot: "evening",
      area: "Riffa",
      name: "Visit Test",
      phone: phone(),
    });
    const { reference } = await submitConsultation(db, input, { ipHash: null });
    const lead = await db.lead.findUniqueOrThrow({ where: { reference }, include: { consultation: true } });
    expect(reference).toMatch(/^GIK-C-/);
    expect(lead.consultation).toMatchObject({
      type: "site_visit",
      preferredSlot: "evening",
      area: "Riffa",
      status: "requested",
    });
  });

  it("saves a contact message with an email only", async () => {
    const input = contactSchema.parse({
      ...base,
      name: "Mail Only",
      email: `m-${uid()}@example.com`,
      message: "Do you make laundry rooms?",
    });
    const { reference } = await submitContact(db, input, { ipHash: null });
    const lead = await db.lead.findUniqueOrThrow({ where: { reference }, include: { customer: true } });
    expect(reference).toMatch(/^GIK-M-/);
    expect(lead.customer).toMatchObject({ phone: null, email: input.email });
  });
});

describe("outbox worker", () => {
  it("marks delivered events done and retries failures with backoff", async () => {
    await db.outboxEvent.updateMany({
      where: { status: { in: ["pending", "processing"] } },
      data: { status: "done" },
    });
    const ok = await db.outboxEvent.create({ data: { type: "test.ok", payload: {} } });
    const bad = await db.outboxEvent.create({ data: { type: "test.bad", payload: {} } });
    const result = await processOutbox(db, async (event) => {
      if (event.type === "test.bad") throw new Error("provider down");
      return { channel: "sent" };
    });
    expect(result).toMatchObject({ claimed: 2, done: 1, retried: 1 });
    expect(await db.outboxEvent.findUniqueOrThrow({ where: { id: ok.id } })).toMatchObject({
      status: "done",
      result: { channel: "sent" },
    });
    const retried = await db.outboxEvent.findUniqueOrThrow({ where: { id: bad.id } });
    expect(retried).toMatchObject({ status: "pending", attempts: 1, lastError: "provider down" });
    expect(retried.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    // Not due yet: a second run doesn't pick it up.
    expect((await processOutbox(db, async () => ({}))).claimed).toBe(0);
  });
});

describe("upload clean-up", () => {
  it("removes day-old uploads that were never attached, and keeps attached ones", async () => {
    const stale = await startUpload(db, storage, {
      name: "old.png",
      type: "image/png",
      size: PNG.length,
      ipHash: null,
    });
    const staleKey = (await db.fileAsset.findUniqueOrThrow({ where: { id: stale.id } })).storageKey;
    await writeLocal(root, staleKey, PNG);
    const removed = await sweepStaleUploads(db, storage, new Date(Date.now() + 25 * 60 * 60 * 1000));
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await db.fileAsset.findUnique({ where: { id: stale.id } })).toBeNull();
    expect(await storage.size(staleKey)).toBeNull();
    expect(await db.fileAsset.count({ where: { quotationRequestId: { not: null } } })).toBeGreaterThan(0);
  });
});

describe("rate limiting", () => {
  it("allows up to the limit within a window", async () => {
    const key = `test:${uid()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(db, key, 3, 60));
    expect(results).toEqual([true, true, true, false]);
    // Reading the count doesn't add to it (used for failed sign-ins).
    expect(await rateLimitCount(db, key, 60)).toBe(4);
    expect(await rateLimitCount(db, key, 60)).toBe(4);
    expect(await rateLimitCount(db, `test:${uid()}`, 60)).toBe(0);
  });
});

describe("staff accounts", () => {
  it("creates staff with a Better Auth password hash and resolves their permissions", async () => {
    const email = `staff-${uid()}@example.com`;
    const id = await db.$transaction((tx) =>
      createStaffUser(tx, {
        email,
        name: "Sales Person",
        password: "correct horse battery",
        roleKeys: ["sales_manager"],
        actorId: null,
        via: "test",
      }),
    );
    const account = await db.account.findFirstOrThrow({ where: { userId: id, providerId: "credential" } });
    expect(await verifyPassword({ hash: account.password!, password: "correct horse battery" })).toBe(true);
    const actor = resolveActor(
      await db.user.findUniqueOrThrow({ where: { id }, include: userWithRolesInclude }),
    )!;
    expect(actor.permissions.has("lead.read")).toBe(true);
    await expect(listRecentEnquiries(db, actor)).resolves.toBeInstanceOf(Array);

    const editor = await db.$transaction((tx) =>
      createStaffUser(tx, {
        email: `editor-${uid()}@example.com`,
        name: "Editor",
        password: "another long password",
        roleKeys: ["content_editor"],
        actorId: null,
        via: "test",
      }),
    );
    const editorActor = resolveActor(
      await db.user.findUniqueOrThrow({ where: { id: editor }, include: userWithRolesInclude }),
    )!;
    await expect(listRecentEnquiries(db, editorActor)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses short passwords", async () => {
    await expect(
      db.$transaction((tx) =>
        createStaffUser(tx, {
          email: `s-${uid()}@example.com`,
          name: "S",
          password: "short",
          roleKeys: ["owner"],
          actorId: null,
          via: "test",
        }),
      ),
    ).rejects.toThrow(/at least 12/);
  });
});
