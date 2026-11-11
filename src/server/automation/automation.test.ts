import { describe, expect, it, vi } from "vitest";
import { adminNav } from "@/app/admin/(panel)/nav";
import { allPermissions, type Permission } from "@/server/auth/permissions";
import type { Env } from "@/server/env";
import {
  configHash,
  deriveStatus,
  integrations,
  IntegrationTestError,
  isConfigured,
  type IntegrationKey,
} from "./integrations";
import { bahrainDayStart } from "./overview";

const baseEnv = {
  NODE_ENV: "test",
  IP_HASH_SECRET: "x".repeat(40),
  AI_MODEL: "claude-sonnet-5-5",
  S3_REGION: "auto",
  WHATSAPP_GRAPH_VERSION: "v21.0",
} as unknown as Env;

const def = (key: IntegrationKey) => integrations.find((d) => d.key === key)!;
const reply = (status: number, body: unknown = {}) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("integration status", () => {
  const last = (ok: boolean, hash: string) => ({ ok, message: "m", configHash: hash, createdAt: new Date() });

  it("is planned for integrations built later, whatever is set", () => {
    expect(deriveStatus({ plannedStage: 6 }, true, "h", last(true, "h"))).toBe("planned");
  });
  it("awaits credentials when settings are missing", () => {
    expect(deriveStatus({ test: async () => "" }, false, null, null)).toBe("awaiting_credentials");
  });
  it("is connected only when the last test passed with the settings in use now", () => {
    const test = async () => "";
    expect(deriveStatus({ test }, true, "h", null)).toBe("configured");
    expect(deriveStatus({ test }, true, "h", last(true, "h"))).toBe("connected");
    expect(deriveStatus({ test }, true, "h", last(false, "h"))).toBe("error");
    // Key changed since the test: back to untested, never "connected" on old evidence.
    expect(deriveStatus({ test }, true, "new", last(true, "old"))).toBe("configured");
  });
  it("never claims connected for services without a test", () => {
    expect(deriveStatus({}, true, "h", last(true, "h"))).toBe("configured");
  });
  it("hashes settings without revealing them, and changes when a key changes", () => {
    const a = configHash(baseEnv, "anthropic", ["sk-ant-secret", "m"]);
    expect(a).not.toContain("secret");
    expect(a).toHaveLength(32);
    expect(configHash(baseEnv, "anthropic", ["sk-ant-other", "m"])).not.toBe(a);
  });
  it("counts as configured only when every required value is set", () => {
    expect(isConfigured(def("resend"), { ...baseEnv, RESEND_API_KEY: "re_x" } as Env)).toBe(false);
    expect(
      isConfigured(def("resend"), { ...baseEnv, RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.c" } as Env),
    ).toBe(true);
    expect(isConfigured(def("meta"), baseEnv)).toBe(false);
  });
});

describe("connection tests (fake provider answers)", () => {
  const anthropicEnv = { ...baseEnv, ANTHROPIC_API_KEY: "sk-ant-test-key-123456" } as Env;

  it("Claude: accepted key and model", async () => {
    const f = reply(200, { id: "claude-sonnet-5-5" });
    await expect(def("anthropic").test!(anthropicEnv, f)).resolves.toMatch(/accepted/);
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/models/claude-sonnet-5-5");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("sk-ant-test-key-123456");
  });
  it("Claude: rejected key and unknown model", async () => {
    await expect(def("anthropic").test!(anthropicEnv, reply(401))).rejects.toThrow(/rejected the API key/);
    await expect(def("anthropic").test!(anthropicEnv, reply(404))).rejects.toThrow(/not found/);
  });
  it("Claude: a network failure is reported, not thrown raw", async () => {
    const f = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(def("anthropic").test!(anthropicEnv, f)).rejects.toBeInstanceOf(IntegrationTestError);
  });

  const resendEnv = { ...baseEnv, RESEND_API_KEY: "re_x", EMAIL_FROM: "GIK <hello@gik.example>" } as Env;
  it("Email: verified domain, unverified domain, missing domain, sending-only key", async () => {
    await expect(
      def("resend").test!(resendEnv, reply(200, { data: [{ name: "gik.example", status: "verified" }] })),
    ).resolves.toMatch(/gik\.example is verified/);
    await expect(
      def("resend").test!(resendEnv, reply(200, { data: [{ name: "gik.example", status: "pending" }] })),
    ).rejects.toThrow(/not verified/);
    await expect(def("resend").test!(resendEnv, reply(200, { data: [] }))).rejects.toThrow(/not added/);
    await expect(
      def("resend").test!(resendEnv, reply(401, { name: "restricted_api_key", message: "echo of secret" })),
    ).resolves.toMatch(/sending-only/);
    await expect(def("resend").test!(resendEnv, reply(401, { name: "validation_error" }))).rejects.toThrow(
      /rejected/,
    );
  });

  const s3Env = {
    ...baseEnv,
    S3_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
    S3_BUCKET: "gik-files",
    S3_ACCESS_KEY_ID: "id",
    S3_SECRET_ACCESS_KEY: "secret",
  } as Env;
  it("Storage: signed list request; refused keys; missing bucket", async () => {
    const f = reply(200);
    await expect(def("storage").test!(s3Env, f)).resolves.toMatch(/reachable/);
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toMatch(/^https:\/\/acct\.r2\.cloudflarestorage\.com\/gik-files\?list-type=2&max-keys=1/);
    expect(new Headers(init.headers).get("authorization")).toMatch(/^AWS4-HMAC-SHA256/);
    expect(url).not.toContain("secret");
    await expect(def("storage").test!(s3Env, reply(403))).rejects.toThrow(/refused/);
    await expect(def("storage").test!(s3Env, reply(404))).rejects.toThrow(/not found/);
  });

  const waEnv = {
    ...baseEnv,
    WHATSAPP_ACCESS_TOKEN: "EAAG-token-1234567890",
    WHATSAPP_PHONE_NUMBER_ID: "123456",
  } as Env;
  it("WhatsApp: reads the sending number; rejected token", async () => {
    const f = reply(200, { display_phone_number: "+973 3459 7636", verified_name: "Global Island Kitchens" });
    await expect(def("whatsapp").test!(waEnv, f)).resolves.toBe(
      "Token accepted; sending number +973 3459 7636 (Global Island Kitchens).",
    );
    const [url] = (f as unknown as { mock: { calls: [string][] } }).mock.calls[0]!;
    expect(url).toBe("https://graph.facebook.com/v21.0/123456?fields=display_phone_number,verified_name");
    await expect(def("whatsapp").test!(waEnv, reply(401))).rejects.toThrow(/rejected the access token/);
  });

  it("has no test for n8n, the scheduled job or planned integrations (nothing is sent to try them)", () => {
    for (const key of ["n8n", "cron", "linkedin", "canva", "tiktok"] as const)
      expect(def(key).test).toBeUndefined();
  });

  it("Meta: read-only calls for the Page and Instagram, token in a header (Stage 6)", async () => {
    const e = {
      ...baseEnv,
      META_PAGE_ID: "1234567",
      META_PAGE_ACCESS_TOKEN: "page-token-that-is-long-enough",
      META_INSTAGRAM_ACCOUNT_ID: "7654321",
      META_GRAPH_VERSION: "v21.0",
    } as Env;
    await expect(def("meta").test!(e, reply(200, { name: "GIK", username: "gik" }))).resolves.toMatch(
      /accepted/,
    );
    await expect(
      def("meta").test!(e, reply(400, { error: { code: 190, message: "Expired" } })),
    ).rejects.toThrow(/Meta refused it \(400 190\)/);
  });

  it("Google Places: one single-result search with the key in a header (Stage 5)", async () => {
    const e = { ...baseEnv, GOOGLE_PLACES_API_KEY: "AIza-test-key-0000000000" } as Env;
    const f = reply(200, { places: [] });
    await expect(def("google_places").test!(e, f)).resolves.toMatch(/accepted/);
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("AIza-test-key-0000000000");
    expect(JSON.parse(init.body as string).pageSize).toBe(1);
    await expect(def("google_places").test!(e, reply(403))).rejects.toThrow(/refused the key/);
  });
});

describe("Bahrain day start", () => {
  it("is 21:00 UTC the day before", () => {
    expect(bahrainDayStart(new Date("2026-11-11T10:00:00Z")).toISOString()).toBe("2026-11-10T21:00:00.000Z");
    // 22:30 UTC is already 01:30 the next day in Bahrain.
    expect(bahrainDayStart(new Date("2026-11-11T22:30:00Z")).toISOString()).toBe("2026-11-11T21:00:00.000Z");
  });
});

describe("admin navigation", () => {
  it("adds the Automation Centre after the Overview group, so sign-in still lands on the dashboard", () => {
    const nav = adminNav(new Set(allPermissions));
    expect(nav[0]!.items[0]!.href).toBe("/admin");
    expect(nav[1]!.label).toBe("Automation Centre");
    expect(nav[1]!.items.map((i) => i.href)).toEqual([
      "/admin/automation",
      "/admin/automation/approvals",
      "/admin/ai-sales",
      "/admin/ai-agent",
      "/admin/analytics",
      "/admin/automation/integrations",
      "/admin/automation/workflows",
      "/admin/automation/logs",
    ]);
  });
  it("shows the Centre's labels in Arabic when chosen; other groups stay English", () => {
    const nav = adminNav(new Set(allPermissions), "ar");
    expect(nav[1]!.label).toBe("مركز الأتمتة");
    expect(nav[1]!.lang).toBe("ar");
    expect(nav[0]!.label).toBe("Overview");
  });
  it("hides the Centre from staff without automation.read", () => {
    const nav = adminNav(new Set<Permission>(["materials.manage"]));
    expect(nav.some((g) => g.items.some((i) => i.href.startsWith("/admin/automation")))).toBe(false);
  });
});
