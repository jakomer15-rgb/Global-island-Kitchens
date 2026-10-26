import { describe, expect, it } from "vitest";
import { checkDatabase, checkEnvironment, hasFailures } from "./launch-check";

const good = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:pw@db.example-host.net/gik?sslmode=require",
  BETTER_AUTH_SECRET: "Zk3pR8vQ1mT6yW9uB2nC5xD7fG0hJ4kL8sA1eV3t",
  IP_HASH_SECRET: "Qp7Lm2Nx9Rt4Vb6Yc1Df5Gh8Jk3Ws0Ze7Ua2Ix4O",
  BETTER_AUTH_URL: "https://www.globalislandkitchens.example",
  NEXT_PUBLIC_SITE_URL: "https://www.globalislandkitchens.example",
  CRON_SECRET: "Hn4Bv8Cx2Zs6Aq0Wd3Ef7Rg1Ty5Ui9Op",
  S3_ENDPOINT: "https://abc.r2.cloudflarestorage.com",
  S3_BUCKET: "gik-private",
  S3_ACCESS_KEY_ID: "id",
  S3_SECRET_ACCESS_KEY: "secret",
  RESEND_API_KEY: "re_x",
  EMAIL_FROM: "Global Island Kitchens <hello@globalislandkitchens.example>",
  NOTIFY_EMAILS: "sales@globalislandkitchens.example",
  BROWSER_WS_ENDPOINT: "wss://chrome.example.net",
};
const levels = (findings: ReturnType<typeof checkEnvironment>) => findings.filter((f) => f.level !== "ok");

describe("launch check: environment", () => {
  it("passes a complete production environment", () => {
    expect(levels(checkEnvironment(good))).toEqual([]);
  });

  it("fails on unsafe values", () => {
    const bad = checkEnvironment({
      ...good,
      DATABASE_URL: "postgresql://gik:gik@localhost:5432/gik",
      BETTER_AUTH_SECRET: "short",
      IP_HASH_SECRET: "short",
      BETTER_AUTH_URL: "http://localhost:3000",
      STORAGE_DRIVER: "local",
      AI_PROVIDER: "mock",
      CRON_SECRET: undefined,
      S3_BUCKET: undefined,
    });
    expect(hasFailures(bad)).toBe(true);
    const failures = bad.filter((f) => f.level === "fail").map((f) => f.message);
    expect(failures.join("\n")).toMatch(/points at this machine/);
    expect(failures.join("\n")).toMatch(/BETTER_AUTH_SECRET must be at least 32/);
    expect(
      checkEnvironment({ ...good, IP_HASH_SECRET: good.BETTER_AUTH_SECRET })
        .filter((f) => f.level === "fail")
        .map((f) => f.message)
        .join("\n"),
    ).toMatch(/must be different/);
    expect(failures.join("\n")).toMatch(/public https address/);
    expect(failures.join("\n")).toMatch(/STORAGE_DRIVER is for tests only/);
    expect(failures.join("\n")).toMatch(/test AI provider/);
    expect(failures.join("\n")).toMatch(/CRON_SECRET/);
    expect(failures.join("\n")).toMatch(/Object storage/);
  });

  it("rejects placeholder secrets", () => {
    const bad = checkEnvironment({
      ...good,
      BETTER_AUTH_SECRET: "ci-only-secret-ci-only-secret-ci-only-secret",
    });
    expect(bad.some((f) => f.level === "fail" && /placeholder/.test(f.message))).toBe(true);
  });

  it("warns, but does not fail, when optional features are missing", () => {
    const partial = checkEnvironment({ ...good, RESEND_API_KEY: undefined, BROWSER_WS_ENDPOINT: undefined });
    expect(hasFailures(partial)).toBe(false);
    expect(
      partial
        .filter((f) => f.level === "warn")
        .map((f) => f.area)
        .sort(),
    ).toEqual(["Email", "PDF"]);
  });
});

describe("launch check: database", () => {
  const facts = {
    reachable: true,
    migrationsApplied: 7,
    migrationsExpected: 7,
    permissions: 25,
    permissionsExpected: 25,
    activeOwners: 1,
    activeStaff: 3,
    contactWhatsapp: true,
    quotationTerms: true,
    publishedMaterials: 5,
    aiEnabled: false,
    aiKeySet: false,
  };
  it("passes a ready database", () => {
    expect(levels(checkDatabase(facts))).toEqual([]);
  });
  it("fails when it can't connect, is behind on migrations or has no owner", () => {
    expect(hasFailures(checkDatabase({ ...facts, reachable: false }))).toBe(true);
    expect(hasFailures(checkDatabase({ ...facts, migrationsApplied: 6 }))).toBe(true);
    expect(hasFailures(checkDatabase({ ...facts, permissions: 3 }))).toBe(true);
    expect(hasFailures(checkDatabase({ ...facts, activeOwners: 0 }))).toBe(true);
  });
  it("warns about unconfirmed content", () => {
    const warnings = checkDatabase({
      ...facts,
      contactWhatsapp: false,
      quotationTerms: false,
      publishedMaterials: 0,
    });
    expect(hasFailures(warnings)).toBe(false);
    expect(warnings.filter((f) => f.level === "warn")).toHaveLength(3);
  });
});
