import { afterAll, describe, expect, it } from "vitest";
import { designerProjectSchema, registerSchema } from "@/lib/designer";
import { createStaffUser } from "@/server/auth/accounts";
import { ForbiddenError, resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { createPrismaClient } from "@/server/db/client";
import { NotFoundError, RuleError } from "@/server/errors";
import { decideDesigner, designerProjectForLead, listDesigners, staffReply } from "./admin";
import { addMyMessage, getMyProject, listMyProjects, registerDesigner, submitMyProject } from "./designers";
import type { DesignerActor } from "./session";

const db = createPrismaClient();
afterAll(() => db.$disconnect());

const uid = () => Math.random().toString(36).slice(2, 10);
const phone = () => `3${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const spam = { website: "", startedAt: Date.now() - 60_000, locale: "en" as const };

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

async function designer(approve: Actor | null): Promise<DesignerActor> {
  const email = `designer-${uid()}@example.test`;
  await registerDesigner(
    db,
    registerSchema.parse({
      ...spam,
      name: "Test Designer",
      company: "Studio Test",
      profession: "interior_designer",
      phone: phone(),
      email,
      password: "a long designer password",
      privacyAccepted: true,
    }),
    { ipHash: null },
  );
  const user = await db.user.findUniqueOrThrow({ where: { email }, include: { designerAccount: true } });
  if (approve) await decideDesigner(db, approve, user.designerAccount!.id, "approved", null);
  const account = await db.designerAccount.findUniqueOrThrow({ where: { userId: user.id } });
  return {
    userId: user.id,
    designerId: account.id,
    name: user.name,
    email: user.email,
    status: account.status,
  };
}

const project = (title: string, extra: object = {}) =>
  designerProjectSchema.parse({
    ...spam,
    title,
    category: "woodenKitchens",
    boards: ["egger"],
    materialIds: [],
    unit: "cm",
    walls: [{ label: "Wall A", width: 320, height: 240 }],
    noMeasurements: false,
    files: [],
    ...extra,
  });

describe("designer portal", () => {
  it("registers pending designers who can't use the portal until staff approve them", async () => {
    const sales = await staff(["sales_manager"]);
    const pending = await designer(null);
    expect(pending.status).toBe("pending");
    await expect(listMyProjects(db, pending)).rejects.toThrow(RuleError);
    await expect(submitMyProject(db, null, pending, project("Villa"), { ipHash: null })).rejects.toThrow(
      RuleError,
    );

    const note = await db.notification.findFirst({
      where: { userId: sales.id, title: "New designer registration" },
    });
    expect(note).not.toBeNull();

    const pendingList = await listDesigners(db, sales, { status: "pending" });
    const row = pendingList.find((d) => d.id === pending.designerId)!;
    expect(row.user.email).toBe(pending.email);

    await decideDesigner(db, sales, pending.designerId, "approved", null);
    expect(await listMyProjects(db, { ...pending, status: "approved" })).toEqual([]);

    const audits = await db.auditLog.findMany({
      where: { entityId: pending.designerId, action: { startsWith: "designer." } },
    });
    expect(audits.map((a) => a.action).sort()).toEqual(["designer.approved", "designer.registered"]);
  });

  it("answers a repeated email like a new one and never creates a second account", async () => {
    const d = await designer(null);
    await expect(
      registerDesigner(
        db,
        registerSchema.parse({
          ...spam,
          name: "Someone Else",
          profession: "architect",
          phone: phone(),
          email: d.email,
          password: "another long password",
          privacyAccepted: true,
        }),
        { ipHash: null },
      ),
    ).resolves.toBeUndefined();
    expect(await db.user.count({ where: { email: d.email } })).toBe(1);
    expect((await db.user.findUniqueOrThrow({ where: { email: d.email } })).name).toBe("Test Designer");
  });

  it("turns a submitted project into a lead and a request, and keeps designers apart", async () => {
    const sales = await staff(["sales_manager"]);
    const a = await designer(sales);
    const b = await designer(sales);

    const { id, reference } = await submitMyProject(
      db,
      null,
      a,
      project("Villa kitchen", { clientLabel: "Mrs K" }),
      {
        ipHash: null,
      },
    );
    expect(reference).toMatch(/^GIK-Q-\d{4}-\d{5}$/);
    const lead = await db.lead.findUniqueOrThrow({ where: { reference }, include: { customer: true } });
    expect(lead.source).toBe("designer_portal");
    expect(lead.customer.type).toBe("interior_designer");
    expect(lead.customer.company).toBe("Studio Test");

    const mine = await getMyProject(db, a, id);
    expect(mine.progress).toBe("received");
    expect(mine.request.reference).toBe(reference);

    // Another designer can't see, list or message it, and gets "not found", not "forbidden".
    await expect(getMyProject(db, b, id)).rejects.toThrow(NotFoundError);
    await expect(addMyMessage(db, b, id, "hello")).rejects.toThrow(NotFoundError);
    expect(await listMyProjects(db, b)).toEqual([]);
    expect((await listMyProjects(db, a)).map((p) => p.id)).toEqual([id]);

    // A second project reuses the same CRM customer.
    await submitMyProject(db, null, a, project("Second"), { ipHash: null });
    expect(await db.customer.count({ where: { id: lead.customerId } })).toBe(1);
    expect(await db.lead.count({ where: { customerId: lead.customerId } })).toBe(2);
  });

  it("shows designers staff replies but never internal notes, and follows the lead's progress", async () => {
    const sales = await staff(["sales_manager"]);
    const a = await designer(sales);
    const { id, reference } = await submitMyProject(db, null, a, project("Wardrobes"), { ipHash: null });

    await addMyMessage(db, a, id, "Can you also quote the dressing room?");
    await staffReply(db, sales, id, "Yes, we will add it.", false);
    await staffReply(db, sales, id, "Budget looks tight, call first.", true);

    const seen = await getMyProject(db, a, id);
    expect(seen.messages.map((m) => m.body)).toEqual([
      "Can you also quote the dressing room?",
      "Yes, we will add it.",
    ]);
    const lead = await db.lead.findUniqueOrThrow({ where: { reference } });
    const staffView = await designerProjectForLead(db, sales, lead.id);
    expect(staffView?.messages).toHaveLength(3);

    await db.lead.update({ where: { id: lead.id }, data: { status: "quoted" } });
    expect((await getMyProject(db, a, id)).progress).toBe("quotation_ready");

    // Messages can't be edited or removed, and only staff may write internal notes.
    await expect(db.designerMessage.deleteMany({ where: { projectId: id } })).rejects.toThrow();
    await expect(
      db.designerMessage.create({
        data: { projectId: id, authorId: a.userId, fromStaff: false, internal: true, body: "x" },
      }),
    ).rejects.toThrow();
  });

  it("limits who can manage designers and what rejection needs", async () => {
    const owner = await staff(["owner"]);
    const production = await staff(["production_supervisor"]);
    const d = await designer(null);

    await expect(listDesigners(db, production)).rejects.toThrow(ForbiddenError);
    await expect(decideDesigner(db, production, d.designerId, "approved", null)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(decideDesigner(db, owner, d.designerId, "rejected", " ")).rejects.toThrow(RuleError);

    await decideDesigner(db, owner, d.designerId, "approved", null);
    await db.session.create({
      data: {
        id: uid(),
        token: uid() + uid(),
        userId: d.userId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await decideDesigner(db, owner, d.designerId, "suspended", "Not a trade customer");
    expect(await db.session.count({ where: { userId: d.userId } })).toBe(0);
    const row = await db.designerAccount.findUniqueOrThrow({ where: { id: d.designerId } });
    expect(row.status).toBe("suspended");
    expect(row.statusNote).toBe("Not a trade customer");
  });

  it("keeps designers out of the staff tables", async () => {
    const d = await designer(null);
    const user = await db.user.findUniqueOrThrow({ where: { id: d.userId }, include: userWithRolesInclude });
    expect(resolveActor(user)).toBeNull();
    const role = await db.role.findFirstOrThrow({ where: { key: "owner" } });
    await expect(db.userRole.create({ data: { userId: d.userId, roleId: role.id } })).rejects.toThrow();
    // A decision must record who made it.
    await expect(
      db.designerAccount.update({ where: { id: d.designerId }, data: { status: "approved" } }),
    ).rejects.toThrow();
  });
});
