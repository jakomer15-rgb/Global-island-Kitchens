import { expect, test } from "@playwright/test";

test.describe("operations", () => {
  test("the health check answers for uptime monitors without revealing details", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("every page carries the security headers", async ({ request }) => {
    for (const path of ["/", "/ar", "/admin/sign-in", "/api/health"]) {
      const headers = (await request.get(path)).headers();
      expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
      expect(headers["strict-transport-security"], path).toContain("max-age=");
      expect(headers["x-content-type-options"], path).toBe("nosniff");
      expect(headers["x-frame-options"], path).toBe("DENY");
      expect(headers["cross-origin-opener-policy"], path).toBe("same-origin");
      expect(headers["x-powered-by"], path).toBeUndefined();
    }
  });

  test("the sitemap lists both languages and none of the private areas", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain('hreflang="ar-BH"');
    expect(xml).not.toMatch(/\/admin|\/designers\/portal|\/api\/|\/documents|\/unsubscribe/);
  });
});
