import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://u:p@localhost:5432/x";
  process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  process.env.IP_HASH_SECRET ??= "test-ip-secret-test-ip-secret-test-123";
});

describe("quotation document token", () => {
  it("opens only the named revision, only for two minutes, and can't be forged", async () => {
    const { documentToken, verifyDocumentToken } = await import("./document-token");
    const now = Date.now();
    const token = documentToken("rev-a", now);
    expect(verifyDocumentToken(token, "rev-a", now)).toBe(true);
    expect(verifyDocumentToken(token, "rev-b", now)).toBe(false);
    expect(verifyDocumentToken(token, "rev-a", now + 2 * 60 * 1000 + 1)).toBe(false);
    const [exp, sig] = token.split(".");
    expect(verifyDocumentToken(`${Number(exp) + 60_000}.${sig}`, "rev-a", now)).toBe(false);
    expect(verifyDocumentToken(`${exp}.${sig!.slice(0, -2)}xx`, "rev-a", now)).toBe(false);
    expect(verifyDocumentToken("nonsense", "rev-a", now)).toBe(false);
  });
});
