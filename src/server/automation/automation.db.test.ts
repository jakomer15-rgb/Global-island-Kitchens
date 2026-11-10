import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createStaffUser } from "@/server/auth/accounts";
import { ForbiddenError, resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { createPrismaClient } from "@/server/db/client";
import type { Env } from "@/server/env";
import { RuleError } from "@/server/errors";
import { integrationOverview, testIntegration } from "./integrations";
import { deliveryHealth, listDeliveries, retryDelivery } from "./logs";
import { approvalQueue, centreOverview } from "./overview";

const db = createPrismaClient();
const uid = () => Math.random().toString(36).slice(2, 10);

async function staff(roleKeys: string[]): Promise<Actor> {
  const id = await db.$transaction((tx) =>
    createStaffUser(tx, {
      email: `staff-${uid()}@example.test`,
      name: `Staff ${uid()}`,
      password: "a long test password",
      roleKeys,
      actorId: null,
      via: "test",
    }),
  );
  return resolveActor(await db.user.findUniqueOrThrow({ where: { id }, include: userWithRolesInclude }))!;
}

const env = {
  NODE_ENV: "test",
  IP_HASH_SECRET: "y".repeat(40),
  AI_MODEL: "claude-sonnet-5-5",
  ANTHROPIC_API_KEY: "sk-ant-db-test-key-0001",
  S3_REGION: "auto",
  WHATSAPP_GRAPH_VERSION: "v21.0",
} as unknown as Env;
const answer = (status: number) =>
  vi.fn(async () => new Response("{}", { status })) as unknown as typeof fetch;

let owner: Actor;
let sales: Actor;
let editor: Actor;
let supervisor: Actor;
beforeAll(async () => {
  [owner, sales, editor, supervisor] = await Promise.all([
    staff(["owner"]),
    staff(["sales_manager"]),
    staff(["content_editor"]),
    staff(["production_supervisor"]),
  ]);
});
afterAll(() => db.$disconnect());

describe("permissions", () => {
  it("grants the Centre to the owner and sales manager; testing connections to the owner only", () => {
    expect(owner.permissions.has("automation.read")).toBe(true);
    expect(owner.permissions.has("integrations.manage")).toBe(true);
    expect(sales.permissions.has("automation.read")).toBe(true);
    expect(sales.permissions.has("integrations.manage")).toBe(false);
    expect(editor.permissions.has("automation.read")).toBe(false);
  });
  it("refuses the Centre's services without automation.read", async () => {
    await expect(centreOverview(db, editor)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(integrationOverview(db, editor, env)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listDeliveries(db, editor, {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(testIntegration(db, sales, "anthropic", { env, fetch: answer(200) })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("integration tests", () => {
  it("records a passing test, shows Connected, and writes an audit entry", async () => {
    const f = answer(200);
    const result = await testIntegration(db, owner, "anthropic", { env, fetch: f });
    expect(result.ok).toBe(true);
    const view = (await integrationOverview(db, owner, env)).find((i) => i.key === "anthropic")!;
    expect(view.status).toBe("connected");
    expect(view.setVars).toEqual(["ANTHROPIC_API_KEY", "AI_MODEL"]);
    const audit = await db.auditLog.findFirst({
      where: { actorId: owner.id, action: "integration.test" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.changes).toEqual({ integration: "anthropic", ok: true });
    // The key is never stored.
    const row = await db.integrationCheck.findFirstOrThrow({ where: { checkedById: owner.id } });
    expect(JSON.stringify(row)).not.toContain("sk-ant-db-test-key-0001");
  });

  it("a failed test shows Error; a changed key shows untested again", async () => {
    await testIntegration(db, owner, "anthropic", { env, fetch: answer(401) });
    expect((await integrationOverview(db, owner, env)).find((i) => i.key === "anthropic")!.status).toBe(
      "error",
    );
    const changed = { ...env, ANTHROPIC_API_KEY: "sk-ant-db-test-key-0002" } as Env;
    expect((await integrationOverview(db, owner, changed)).find((i) => i.key === "anthropic")!.status).toBe(
      "configured",
    );
  });

  it("refuses unknown, untestable and unconfigured integrations without calling anything", async () => {
    const f = answer(200);
    await expect(testIntegration(db, owner, "nope", { env, fetch: f })).rejects.toBeInstanceOf(RuleError);
    await expect(testIntegration(db, owner, "n8n", { env, fetch: f })).rejects.toBeInstanceOf(RuleError);
    await expect(testIntegration(db, owner, "resend", { env, fetch: f })).rejects.toThrow(/not set/);
    expect(f).not.toHaveBeenCalled();
  });

  it("limits tests to 20 per person per 10 minutes", async () => {
    const someone = await staff(["owner"]);
    const f = answer(200);
    for (let i = 0; i < 20; i++) await testIntegration(db, someone, "anthropic", { env, fetch: f });
    await expect(testIntegration(db, someone, "anthropic", { env, fetch: f })).rejects.toThrow(/Too many/);
    expect(f).toHaveBeenCalledTimes(20);
  });

  it("shows planned integrations and missing settings honestly", async () => {
    const list = await integrationOverview(db, owner, env);
    expect(list.find((i) => i.key === "meta")!.status).toBe("planned");
    expect(list.find((i) => i.key === "resend")!.status).toBe("awaiting_credentials");
    expect(list.find((i) => i.key === "resend")!.testable).toBe(false);
  });
});

describe("delivery log", () => {
  it("retries a failed delivery once, keeps channels already sent, and audits it", async () => {
    const event = await db.outboxEvent.create({
      data: {
        type: "lead.status_changed",
        payload: { leadId: "x" },
        status: "failed",
        attempts: 6,
        lastError: "n8n: n8n responded 500",
        result: { staffEmail: "sent" },
      },
    });
    await expect(retryDelivery(db, sales, event.id)).rejects.toBeInstanceOf(ForbiddenError);
    await retryDelivery(db, owner, event.id);
    const after = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(after.status).toBe("pending");
    expect(after.attempts).toBe(0);
    expect(after.result).toEqual({ staffEmail: "sent" });
    await expect(retryDelivery(db, owner, event.id)).rejects.toThrow(/Only failed/);
    expect(
      await db.auditLog.count({ where: { action: "outbox.retry", entityId: event.id, actorId: owner.id } }),
    ).toBe(1);
    await db.outboxEvent.delete({ where: { id: event.id } });
  });

  it("lists deliveries without their payloads", async () => {
    const event = await db.outboxEvent.create({
      data: { type: "enquiry.received", payload: { customer: { phone: "+97300000000" } } },
    });
    const list = await listDeliveries(db, sales, { type: "enquiry.received" });
    expect(list.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(list.items)).not.toContain("+97300000000");
    const health = await deliveryHealth(db, sales);
    expect(health.pending).toBeGreaterThan(0);
    await db.outboxEvent.delete({ where: { id: event.id } });
  });
});

describe("overview and approvals", () => {
  it("counts from the database and hides figures the person may not see", async () => {
    const o = await centreOverview(db, owner);
    expect(typeof o.enquiries30).toBe("number");
    expect(o.quotationsAwaiting).not.toBeNull();
    // A role with the Centre but without quotations would get null; the supervisor has neither.
    await expect(centreOverview(db, supervisor)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lists pending AI drafts for reviewers, oldest first", async () => {
    const draft = await db.aiDraft.create({
      data: {
        kind: "blog_post",
        input: { topic: "Caring for painted MDF" },
        output: {},
        model: "mock",
        requestedById: owner.id,
      },
    });
    const queue = await approvalQueue(db, owner);
    const item = queue.items.find((i) => i.id === draft.id);
    expect(item).toMatchObject({ kind: "ai_draft", title: "blog_post", detail: "Caring for painted MDF" });
    expect(queue.counts.ai_draft).toBeGreaterThan(0);
    await db.aiDraft.delete({ where: { id: draft.id } });
  });
});
