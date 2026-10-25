import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyPassword } from "better-auth/crypto";
import { contactSchema } from "@/lib/forms/contact";
import { consultationSchema } from "@/lib/forms/consultation";
import { createStaffUser } from "@/server/auth/accounts";
import { ForbiddenError, resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { changeConsultationStatus } from "@/server/crm/consultations";
import { getCustomer, recordConsent, updateCustomer } from "@/server/crm/customers";
import { dashboard, markNotificationsRead, unreadNotificationCount } from "@/server/crm/dashboard";
import {
  assignLead,
  changeLeadStatus,
  completeFollowUp,
  getLead,
  listFollowUps,
  listLeads,
  logActivity,
  scheduleFollowUp,
} from "@/server/crm/leads";
import { createPrismaClient } from "@/server/db/client";
import { submitConsultation, submitContact } from "@/server/enquiries/submit";
import { RuleError } from "@/server/errors";
import { readSetting, updateSetting } from "@/server/settings/update";
import { localDriver, writeLocal } from "@/server/storage/local";
import { sweepStaleUploads } from "@/server/storage/files";
import { saveBlogPost, saveMaterial, saveTestimonial, publicMaterials, publicTestimonials } from "./content";
import { deleteMedia, finishMediaUpload, startMediaUpload } from "./media";
import { addProjectImage, publicProjects, saveProject } from "./portfolio";
import { createStaff, resetStaffPassword, setRolePermissions, setStaffRoles, setStaffStatus } from "./staff";

const db = createPrismaClient();
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

let root: string;
let storage: ReturnType<typeof localDriver>;

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

async function contactLead() {
  const { reference } = await submitContact(
    db,
    contactSchema.parse({ ...base, name: "CRM Test", phone: phone(), message: "Do you make laundry rooms?" }),
    { ipHash: null },
  );
  return db.lead.findUniqueOrThrow({ where: { reference } });
}

let owner: Actor;
let sales: Actor;
let editor: Actor;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "gik-media-"));
  storage = localDriver(root, "test-secret");
  [owner, sales, editor] = await Promise.all([
    staff(["owner"]),
    staff(["sales_manager"]),
    staff(["content_editor"]),
  ]);
});

afterAll(async () => {
  await db.$disconnect();
  await rm(root, { recursive: true, force: true });
});

describe("CRM", () => {
  it("moves a lead through its pipeline with history, assignment and follow-ups", async () => {
    const lead = await contactLead();
    await expect(changeLeadStatus(db, sales, { id: lead.id, status: "lost" })).rejects.toBeInstanceOf(
      RuleError,
    );

    await logActivity(db, sales, { leadId: lead.id, kind: "call", body: "Called, will send drawings." });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("contacted");

    await assignLead(db, owner, { id: lead.id, userId: sales.id });
    expect(await unreadNotificationCount(db, sales)).toBeGreaterThan(0);
    await markNotificationsRead(db, sales);
    expect(await unreadNotificationCount(db, sales)).toBe(0);

    await scheduleFollowUp(db, sales, {
      leadId: lead.id,
      dueAt: new Date(Date.now() + 864e5),
      note: "Send quote",
    });
    const mine = await listFollowUps(db, sales, "mine");
    const followUp = mine.find((f) => f.leadId === lead.id)!;
    expect(followUp.note).toBe("Send quote");
    await completeFollowUp(db, sales, followUp.id);
    expect((await listFollowUps(db, sales, "mine")).some((f) => f.id === followUp.id)).toBe(false);

    await changeLeadStatus(db, sales, { id: lead.id, status: "lost", lostReason: "Chose another supplier" });
    const detail = await getLead(db, sales, lead.id);
    expect(detail.status).toBe("lost");
    expect(detail.activities.map((a) => a.kind)).toEqual(expect.arrayContaining(["call", "status_change"]));
    const audits = await db.auditLog.count({ where: { entityType: "lead", entityId: lead.id } });
    expect(audits).toBeGreaterThanOrEqual(3);

    const found = await listLeads(db, sales, { q: lead.reference });
    expect(found.items.map((l) => l.id)).toEqual([lead.id]);
    expect((await dashboard(db, sales)).weeks).toHaveLength(12);
  });

  it("keeps CRM data away from roles without permission", async () => {
    const lead = await contactLead();
    await expect(getLead(db, editor, lead.id)).rejects.toBeInstanceOf(ForbiddenError);
    await assignLead(db, sales, { id: lead.id, userId: null }); // sales managers may assign
    const production = await staff(["production_supervisor"]);
    await expect(
      changeLeadStatus(db, production, { id: lead.id, status: "qualified" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("edits customers without creating duplicates and keeps consent history", async () => {
    const a = await contactLead();
    const b = await contactLead();
    const other = await db.customer.findUniqueOrThrow({ where: { id: b.customerId } });
    const customer = await getCustomer(db, sales, a.customerId);
    const input = { name: "Renamed", type: "homeowner", preferredLanguage: "en" } as const;
    await expect(updateCustomer(db, sales, customer.id, { ...input, phone: other.phone! })).rejects.toThrow(
      /Another customer/,
    );
    const fresh = phone();
    await updateCustomer(db, sales, customer.id, {
      ...input,
      phone: `${fresh.slice(0, 4)} ${fresh.slice(4)}`,
    });
    expect((await db.customer.findUniqueOrThrow({ where: { id: customer.id } })).phone).toBe(`+973${fresh}`);

    await recordConsent(db, sales, { customerId: customer.id, channel: "email", granted: true });
    await recordConsent(db, sales, { customerId: customer.id, channel: "email", granted: false });
    const after = await getCustomer(db, sales, customer.id);
    expect(after.currentConsent.email?.granted).toBe(false);
    expect(await db.consentRecord.count({ where: { customerId: customer.id, channel: "email" } })).toBe(2);
  });

  it("only allows valid consultation transitions", async () => {
    const date = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    const { reference } = await submitConsultation(
      db,
      consultationSchema().parse({
        ...base,
        type: "showroom",
        preferredDate: date,
        preferredSlot: "morning",
        name: "Visit Test",
        phone: phone(),
      }),
      { ipHash: null },
    );
    const c = await db.consultation.findFirstOrThrow({ where: { lead: { reference } } });
    await expect(
      changeConsultationStatus(db, sales, { id: c.id, status: "completed" }),
    ).rejects.toBeInstanceOf(RuleError);
    await changeConsultationStatus(db, sales, { id: c.id, status: "confirmed" });
    await changeConsultationStatus(db, sales, { id: c.id, status: "completed" });
    expect((await db.consultation.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("completed");
  });
});

describe("staff and roles", () => {
  it("creates staff, changes roles, disables and resets passwords with the guards", async () => {
    const gm = await staff(["general_manager"]);
    await expect(
      createStaff(db, gm, {
        email: `x-${uid()}@example.test`,
        name: "X",
        password: "long enough password",
        roleKeys: ["sales_manager"],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const email = `New-${uid()}@Example.test`;
    const id = await createStaff(db, owner, {
      email,
      name: "New Hire",
      password: "a long first password",
      roleKeys: ["sales_manager"],
    });
    await expect(
      createStaff(db, owner, {
        email,
        name: "Again",
        password: "a long first password",
        roleKeys: ["sales_manager"],
      }),
    ).rejects.toThrow(/already exists/);
    expect((await db.user.findUniqueOrThrow({ where: { id } })).email).toBe(email.toLowerCase());

    await expect(setStaffRoles(db, owner, { userId: owner.id, roleKeys: ["sales_manager"] })).rejects.toThrow(
      /own roles/,
    );
    await expect(setStaffStatus(db, owner, { userId: owner.id, status: "disabled" })).rejects.toThrow(
      /own account/,
    );
    await setStaffRoles(db, owner, { userId: id, roleKeys: ["content_editor", "sales_manager"] });
    const roles = await db.userRole.findMany({ where: { userId: id }, include: { role: true } });
    expect(roles.map((r) => r.role.key).sort()).toEqual(["content_editor", "sales_manager"]);

    await db.session.create({
      data: { id: uid(), token: uid() + uid(), userId: id, expiresAt: new Date(Date.now() + 36e5) },
    });
    await setStaffStatus(db, owner, { userId: id, status: "disabled" });
    expect(await db.session.count({ where: { userId: id } })).toBe(0);
    const disabled = await db.user.findUniqueOrThrow({ where: { id }, include: userWithRolesInclude });
    expect(resolveActor(disabled)).toBeNull();

    await resetStaffPassword(db, owner, { userId: id, password: "a brand new password" });
    const account = await db.account.findFirstOrThrow({ where: { userId: id, providerId: "credential" } });
    expect(await verifyPassword({ hash: account.password!, password: "a brand new password" })).toBe(true);
    await expect(resetStaffPassword(db, owner, { userId: id, password: "short" })).rejects.toBeInstanceOf(
      RuleError,
    );
  });

  it("always keeps an active owner and the owner role complete", async () => {
    const second = await staff(["owner"]);
    // Disable every other active owner except `second`, then `second` can't lose the role.
    const others = await db.user.findMany({
      where: { id: { not: second.id }, status: "active", roles: { some: { role: { key: "owner" } } } },
      select: { id: true },
    });
    await db.user.updateMany({
      where: { id: { in: others.map((o) => o.id) } },
      data: { status: "disabled" },
    });
    try {
      await expect(
        setStaffRoles(db, owner, { userId: second.id, roleKeys: ["sales_manager"] }),
      ).rejects.toThrow(/at least one active owner/);
      await expect(setStaffStatus(db, owner, { userId: second.id, status: "disabled" })).rejects.toThrow(
        /at least one active owner/,
      );
    } finally {
      await db.user.updateMany({
        where: { id: { in: others.map((o) => o.id) } },
        data: { status: "active" },
      });
    }
    const ownerRole = await db.role.findUniqueOrThrow({ where: { key: "owner" } });
    await expect(setRolePermissions(db, owner, { roleId: ownerRole.id, permissions: [] })).rejects.toThrow(
      /owner role/,
    );
  });

  it("applies role permission changes on the next request", async () => {
    const role = await db.role.create({ data: { key: `temp_${uid()}`, name: "Temp" } });
    const userId = await db.$transaction((tx) =>
      createStaffUser(tx, {
        email: `t-${uid()}@example.test`,
        name: "T",
        password: "a long test password",
        roleKeys: [role.key],
        actorId: null,
        via: "test",
      }),
    );
    await setRolePermissions(db, owner, { roleId: role.id, permissions: ["lead.read", "audit.read"] });
    const actor = resolveActor(
      await db.user.findUniqueOrThrow({ where: { id: userId }, include: userWithRolesInclude }),
    )!;
    expect([...actor.permissions].sort()).toEqual(["audit.read", "lead.read"]);
  });
});

describe("site settings", () => {
  it("validates, saves and audits a setting under the right permission", async () => {
    await expect(updateSetting(db, sales, "contact", {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      updateSetting(db, editor, "banner", { enabled: true, textEn: "Hi", textAr: null }),
    ).rejects.toThrow();
    const before = await readSetting(db, editor, "banner");
    await updateSetting(db, editor, "banner", {
      enabled: true,
      textEn: "Closed on 1 Jan",
      textAr: "مغلق يوم 1 يناير",
    });
    expect((await readSetting(db, editor, "banner")).enabled).toBe(true);
    const entry = await db.auditLog.findFirstOrThrow({
      where: { action: "setting.updated", entityId: "banner", actorId: editor.id },
      orderBy: { createdAt: "desc" },
    });
    expect(entry.changes).toMatchObject({ after: { textEn: "Closed on 1 Jan" } });
    await updateSetting(db, editor, "banner", before);
  });
});

describe("website content", () => {
  const material = (over: Record<string, unknown> = {}) => ({
    board: "egger_laminate" as const,
    code: `H${uid()}`,
    nameEn: "Natural Oak",
    nameAr: "بلوط طبيعي",
    descriptionEn: null,
    descriptionAr: null,
    texture: "ST10",
    colourFamily: "oak",
    swatchHex: "#8b6a4f",
    imageFileId: null,
    availability: "in_stock" as const,
    sortOrder: 0,
    verified: true,
    published: true,
    ...over,
  });

  it("publishes only checked EGGER / painted MDF décors", async () => {
    await expect(saveMaterial(db, sales, null, material())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveMaterial(db, editor, null, material({ verified: false }))).rejects.toThrow(
      /Check the décor/,
    );
    const id = await saveMaterial(db, editor, null, material());
    const saved = await db.material.findUniqueOrThrow({ where: { id } });
    expect(saved).toMatchObject({ manufacturer: "EGGER", verifiedById: editor.id });
    const mdf = await saveMaterial(
      db,
      editor,
      null,
      material({ board: "painted_mdf", code: `RAL-${uid()}` }),
    );
    expect((await db.material.findUniqueOrThrow({ where: { id: mdf } })).manufacturer).toBeNull();
    expect((await publicMaterials(db)).map((m) => m.id)).toEqual(expect.arrayContaining([id, mdf]));

    // The database refuses the same shortcuts if the service is bypassed.
    await expect(
      db.material.create({
        data: { board: "painted_mdf", manufacturer: "EGGER", code: `X${uid()}`, nameEn: "X" },
      }),
    ).rejects.toThrow(/materials_manufacturer_matches_board/);
    await expect(
      db.material.create({
        data: {
          board: "egger_melamine",
          manufacturer: "EGGER",
          code: `X${uid()}`,
          nameEn: "X",
          published: true,
        },
      }),
    ).rejects.toThrow(/materials_published_needs_verification/);
  });

  it("publishes testimonials only with recorded consent", async () => {
    const input = {
      displayName: `Client ${uid()}`,
      textEn: "They fitted our kitchen on time.",
      textAr: null,
      source: "Email from the client",
      consentNote: null,
      consent: false,
      published: true,
      sortOrder: 0,
    };
    await expect(saveTestimonial(db, editor, null, input)).rejects.toThrow(/consent/);
    const id = await saveTestimonial(db, editor, null, {
      ...input,
      consent: true,
      consentNote: "Agreed by email on 2 Nov 2026",
    });
    expect((await publicTestimonials(db)).some((t) => t.id === id)).toBe(true);
    await expect(
      db.testimonial.create({ data: { displayName: "X", textEn: "Y", source: "Z", status: "published" } }),
    ).rejects.toThrow(/testimonials_published_needs_consent/);
  });

  it("publishes blog posts only in both languages and keeps the first publication date", async () => {
    const input = {
      slug: `post-${uid()}`,
      titleEn: "Choosing a décor",
      titleAr: null,
      excerptEn: null,
      excerptAr: null,
      bodyEn: "First paragraph.\n\n## A heading\n\nMore.",
      bodyAr: null,
      coverFileId: null,
      published: true,
    };
    await expect(saveBlogPost(db, editor, null, input)).rejects.toThrow(/Arabic/);
    const { id } = await saveBlogPost(db, editor, null, { ...input, published: false });
    await saveBlogPost(db, editor, id, { ...input, titleAr: "اختيار الديكور", bodyAr: "فقرة." });
    const first = (await db.blogPost.findUniqueOrThrow({ where: { id } })).publishedAt!;
    await saveBlogPost(db, editor, id, { ...input, titleAr: "اختيار الديكور", bodyAr: "فقرة معدلة." });
    expect((await db.blogPost.findUniqueOrThrow({ where: { id } })).publishedAt).toEqual(first);
    await expect(saveBlogPost(db, editor, null, { ...input, published: false })).rejects.toThrow(
      /web address/,
    );
  });
});

describe("website images and portfolio", () => {
  async function uploadImage(
    actor: Actor,
    kind: "project_photo" | "blog_image",
    credit = "Photo by our team",
  ) {
    const started = await startMediaUpload(db, storage, actor, {
      kind,
      name: "site.png",
      type: "image/png",
      size: PNG.length,
    });
    const key = (await db.fileAsset.findUniqueOrThrow({ where: { id: started.id } })).storageKey;
    await writeLocal(root, key, PNG);
    await finishMediaUpload(db, storage, actor, { id: started.id, ticket: started.ticket, credit });
    return started.id;
  }

  it("publishes images with a credit, keeps them through the upload sweep and refuses fakes", async () => {
    const id = await uploadImage(editor, "blog_image");
    const file = await db.fileAsset.findUniqueOrThrow({ where: { id } });
    expect(file).toMatchObject({ visibility: "public", status: "verified", ticketHash: null });

    await db.fileAsset.update({ where: { id }, data: { createdAt: new Date(Date.now() - 3 * 864e5) } });
    await sweepStaleUploads(db, storage);
    expect(await db.fileAsset.count({ where: { id } })).toBe(1);

    const html = await startMediaUpload(db, storage, editor, {
      kind: "blog_image",
      name: "x.png",
      type: "image/png",
      size: 20,
    });
    const key = (await db.fileAsset.findUniqueOrThrow({ where: { id: html.id } })).storageKey;
    await writeLocal(root, key, new TextEncoder().encode("<html>not a png</html>"));
    await expect(
      finishMediaUpload(db, storage, editor, { id: html.id, ticket: html.ticket, credit: "Ours" }),
    ).rejects.toBeInstanceOf(RuleError);
    await expect(
      startMediaUpload(db, storage, sales, {
        kind: "blog_image",
        name: "x.png",
        type: "image/png",
        size: 20,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      db.fileAsset.create({
        data: {
          storageKey: `media/${uid()}`,
          originalName: "x",
          mimeType: "image/png",
          sizeBytes: 1,
          visibility: "public",
        },
      }),
    ).rejects.toThrow(/file_assets_public_needs_credit/);
  });

  it("shows project photos and client names only with permission", async () => {
    const project = {
      slug: `project-${uid()}`,
      segment: "villas" as const,
      nameEn: "Test Villa",
      nameAr: "فيلا تجريبية",
      locationEn: "Riffa",
      locationAr: "الرفاع",
      sizeEn: null,
      sizeAr: null,
      scopeEn: "Kitchen and wardrobes",
      scopeAr: "مطبخ وخزائن",
      scopeTags: ["kitchens", "closets", "not-a-tag"],
      clientName: "Mr Example",
      clientNamePermission: false,
      featured: false,
      published: true,
      sortOrder: 99,
    };
    await expect(saveProject(db, editor, null, project)).rejects.toThrow(/client's name/);
    const id = await saveProject(db, editor, null, { ...project, clientNamePermission: true });
    expect((await db.portfolioProject.findUniqueOrThrow({ where: { id } })).scopeTags).toEqual([
      "kitchens",
      "closets",
    ]);

    const photo = await uploadImage(editor, "project_photo");
    await expect(
      addProjectImage(db, editor, {
        projectId: id,
        fileId: photo,
        altEn: "Kitchen",
        altAr: "مطبخ",
        usagePermission: false,
      }),
    ).rejects.toThrow(/permission/);
    await addProjectImage(db, editor, {
      projectId: id,
      fileId: photo,
      altEn: "Kitchen",
      altAr: "مطبخ",
      usagePermission: true,
    });
    const pub = (await publicProjects(db)).find((p) => p.id === id)!;
    expect(pub.images.map((i) => i.fileId)).toEqual([photo]);
    await expect(deleteMedia(db, storage, editor, photo)).rejects.toThrow(/still used/);
    await expect(
      db.portfolioProject.update({ where: { id }, data: { clientNamePermission: false } }),
    ).rejects.toThrow(/portfolio_projects_client_name_needs_permission/);
  });
});
