import { describe, expect, it, vi } from "vitest";
import { resolveUploadType, safeFileName } from "@/lib/uploads/policy";
import { assertCan, ForbiddenError, resolveActor } from "./auth/staff";
import { roleDefinitions } from "./auth/permissions";
import type { Env } from "./env";
import { DeliveryError, defaultDelivery } from "./outbox/worker";
import { matchesType } from "./storage/sniff";
import { signToken, verifyToken } from "./storage/token";
import { safeLocalPath } from "./storage/local";
import { storageChoice } from "./storage/driver";

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(64).fill(0)]);
const text = (s: string) => new TextEncoder().encode(s.padEnd(64, " "));

describe("file signatures", () => {
  it("recognises allowed types by their first bytes", () => {
    expect(matchesType(bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg")).toBe(true);
    expect(matchesType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "image/png")).toBe(true);
    expect(matchesType(text("RIFF....WEBPVP8 "), "image/webp")).toBe(true);
    expect(matchesType(text("....ftypheic"), "image/heic")).toBe(true);
    expect(matchesType(text("%PDF-1.7"), "application/pdf")).toBe(true);
    expect(matchesType(text("AC1032"), "image/vnd.dwg")).toBe(true);
    expect(matchesType(text("  0\nSECTION\n  2\nHEADER"), "image/vnd.dxf")).toBe(true);
  });

  it("rejects files that don't match their declared type", () => {
    expect(matchesType(text("<!doctype html><script>"), "image/png")).toBe(false);
    expect(matchesType(text("MZ executable"), "application/pdf")).toBe(false);
    expect(matchesType(text("%PDF-1.7"), "image/jpeg")).toBe(false);
  });
});

describe("upload policy", () => {
  it("resolves types from the browser or the extension, and refuses others", () => {
    expect(resolveUploadType("plan.pdf", "application/pdf")).toBe("application/pdf");
    expect(resolveUploadType("site.HEIC", "")).toBe("image/heic");
    expect(resolveUploadType("drawing.dwg", "application/octet-stream")).toBe("image/vnd.dwg");
    expect(resolveUploadType("photo.svg", "image/svg+xml")).toBeNull();
    expect(resolveUploadType("run.exe", "application/x-msdownload")).toBeNull();
  });

  it("keeps file names readable but safe", () => {
    expect(safeFileName("..\\..\\etc/passwd")).toBe("passwd");
    expect(safeFileName('a<b>:"c|?.pdf')).toBe("a_b___c__.pdf");
    expect(safeFileName("مطبخ.jpg")).toBe("مطبخ.jpg");
  });

  it("only accepts server-generated storage keys locally", () => {
    expect(() => safeLocalPath("/tmp/x", "../secret")).toThrow();
    expect(() => safeLocalPath("/tmp/x", "incoming/abc123")).not.toThrow();
  });
});

describe("storage choice", () => {
  const s3 = {
    S3_ENDPOINT: "https://x.r2.dev",
    S3_BUCKET: "b",
    S3_ACCESS_KEY_ID: "k",
    S3_SECRET_ACCESS_KEY: "s",
  };
  it("uses S3 when configured, local disk only in development, and nothing in production otherwise", () => {
    expect(storageChoice({ NODE_ENV: "production", ...s3 })).toBe("s3");
    expect(storageChoice({ NODE_ENV: "development" })).toBe("local");
    expect(storageChoice({ NODE_ENV: "production" })).toBeNull();
    // Explicit test-only override for end-to-end runs of a production build.
    expect(storageChoice({ NODE_ENV: "production", STORAGE_DRIVER: "local" })).toBe("local");
  });
});

describe("local storage tokens", () => {
  it("verifies signature and expiry", () => {
    const token = signToken({ op: "put", key: "incoming/abc", exp: Date.now() + 1000 }, "secret-a");
    expect(verifyToken(token, "secret-a")?.key).toBe("incoming/abc");
    expect(verifyToken(token, "secret-b")).toBeNull();
    expect(verifyToken(token, "secret-a", Date.now() + 2000)).toBeNull();
    const [body] = token.split(".");
    expect(verifyToken(`${body}.tampered`, "secret-a")).toBeNull();
  });
});

describe("staff permissions", () => {
  const user = (over: Partial<{ status: string; kind: string; roles: string[] }> = {}) => ({
    id: "u1",
    name: "Staff",
    email: "s@example.com",
    status: over.status ?? "active",
    kind: over.kind ?? "staff",
    roles: (over.roles ?? ["sales_manager"]).map((key) => ({
      role: {
        key,
        permissions: roleDefinitions
          .find((r) => r.key === key)!
          .permissions.map((permissionKey) => ({ permissionKey })),
      },
    })),
  });

  it("resolves permissions from roles", () => {
    const actor = resolveActor(user())!;
    expect(actor.permissions.has("lead.read")).toBe(true);
    expect(actor.permissions.has("staff.manage")).toBe(false);
    expect(() => assertCan(actor, "staff.manage")).toThrow(ForbiddenError);
  });

  it("gives no access to disabled users, designers or users without roles", () => {
    expect(resolveActor(user({ status: "disabled" }))).toBeNull();
    expect(resolveActor(user({ kind: "designer" }))).toBeNull();
    expect(resolveActor(user({ roles: [] }))).toBeNull();
  });

  it("keeps staff management with the owner only", () => {
    const withStaff = roleDefinitions.filter((r) => r.permissions.includes("staff.manage")).map((r) => r.key);
    expect(withStaff).toEqual(["owner"]);
  });
});

describe("outbox delivery", () => {
  const baseEnv = { NODE_ENV: "test" } as Env;
  const event = {
    id: "evt1",
    type: "enquiry.received",
    payload: {
      kind: "quote",
      reference: "GIK-Q-2026-00001",
      leadId: "l1",
      locale: "en",
      customer: { name: "A", phone: "+97334597636", email: "a@example.com" },
      summary: "Wardrobes",
    },
  };

  it("reports channels that aren't configured instead of failing", async () => {
    const result = await defaultDelivery(baseEnv, "http://localhost:3000")(event, {});
    expect(result).toEqual({
      staffEmail: "not_configured",
      customerEmail: "not_configured",
      n8n: "not_configured",
    });
  });

  it("keeps successful channels when another fails, so retries don't repeat them", async () => {
    const env = {
      ...baseEnv,
      RESEND_API_KEY: "k",
      EMAIL_FROM: "x@example.com",
      NOTIFY_EMAILS: "staff@example.com",
      N8N_WEBHOOK_URL: "https://n8n.example.com/hook",
      N8N_WEBHOOK_SECRET: "s".repeat(32),
    } as Env;
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async (url) => new Response(null, { status: String(url).includes("n8n") ? 500 : 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const error = await defaultDelivery(env, "http://localhost:3000")(event, {}).catch((e) => e);
      expect(error).toBeInstanceOf(DeliveryError);
      expect((error as DeliveryError).result).toEqual({ staffEmail: "sent", customerEmail: "sent" });
      // Retry: emails are not sent again, only n8n is attempted.
      fetchMock.mockClear();
      await defaultDelivery(env, "http://localhost:3000")(event, (error as DeliveryError).result).catch(
        () => {},
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0]![0])).toContain("n8n");
      const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
      expect(headers["x-gik-signature"]).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
