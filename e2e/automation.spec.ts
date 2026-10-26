import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createPrismaClient } from "../src/server/db/client";
import { unsubscribeUrl } from "../src/server/consent";
import { seriousViolations } from "./axe";
import { E2E_WHATSAPP } from "./constants";
import { E2E_STAFF } from "./global-setup";

const rand = (n: number) => Math.floor(Math.random() * n);
const uid = () => Math.random().toString(36).slice(2, 8);

test.use({ extraHTTPHeaders: { "x-forwarded-for": `10.6.${rand(255)}.${rand(255)}` } });

const sign = (body: string) =>
  `sha256=${createHmac("sha256", E2E_WHATSAPP.appSecret).update(body).digest("hex")}`;

async function staffSignIn(page: Page) {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(E2E_STAFF.email);
  await page.getByLabel("Password").fill(E2E_STAFF.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}

test.describe("automation and consent", () => {
  test.skip(({ isMobile }) => isMobile, "runs once, on desktop");

  test("the WhatsApp webhook verifies Meta, refuses unsigned bodies and logs signed messages once", async ({
    page,
    request,
  }) => {
    const verify = (token: string) =>
      request.get(`/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=12345`);
    const ok = await verify(E2E_WHATSAPP.verifyToken);
    expect(ok.status()).toBe(200);
    expect(await ok.text()).toBe("12345");
    expect((await verify("wrong-token-0123456789")).status()).toBe(403);

    const name = `Mona ${uid()}`;
    const from = `9733${String(rand(1e7)).padStart(7, "0")}`;
    const id = `wamid.${uid()}${uid()}`;
    const body = JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: from, profile: { name } }],
                messages: [{ id, from, type: "text", text: { body: "Hello, do you make wardrobes?" } }],
              },
            },
          ],
        },
      ],
    });
    const post = (headers: Record<string, string>) =>
      request.post("/api/webhooks/whatsapp", {
        data: body,
        headers: { "content-type": "application/json", ...headers },
      });
    expect((await post({})).status()).toBe(401);
    expect((await post({ "x-hub-signature-256": sign(body + " ") })).status()).toBe(401);
    expect((await post({ "x-hub-signature-256": sign(body) })).status()).toBe(200);
    expect((await post({ "x-hub-signature-256": sign(body) })).status()).toBe(200); // Meta retries

    await staffSignIn(page);
    await page.goto(`/admin/leads?q=${encodeURIComponent(name)}`);
    const table = page.getByRole("table", { name: "Leads" });
    await expect(table.getByRole("link").first()).toBeVisible();
    await table.getByRole("link").first().click();
    await expect(page.getByText("Hello, do you make wardrobes?")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/GIK-W-\d{4}-\d{5}/);
  });

  test("a customer can withdraw consent from the link, and bad links do nothing", async ({ page }) => {
    const db = createPrismaClient(process.env.DATABASE_URL_TEST);
    try {
      const customer = await db.customer.create({
        data: {
          name: "Unsub Test",
          email: `unsub-${uid()}@example.test`,
          consents: { create: { channel: "email", granted: true, source: "e2e" } },
        },
      });
      const link = unsubscribeUrl(customer.id, "email", "http://localhost");
      await page.goto(new URL(link).pathname + new URL(link).search);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(page.getByText(/Stop emails from Global Island Kitchens/)).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      await page.getByRole("button", { name: "Unsubscribe" }).click();
      await expect(page.getByText(/You will not receive these messages/)).toBeVisible();
      const latest = await db.consentRecord.findFirstOrThrow({
        where: { customerId: customer.id, channel: "email" },
        orderBy: { recordedAt: "desc" },
      });
      expect(latest.granted).toBe(false);
      expect(latest.source).toBe("unsubscribe_link");

      await page.goto("/unsubscribe?token=email.fake.fake");
      await expect(page.getByText(/This link is not valid/)).toBeVisible();
      await page.goto("/ar/unsubscribe");
      await expect(page.getByText("هذا الرابط غير صالح")).toBeVisible();
    } finally {
      await db.$disconnect();
    }
  });

  test("AI stays off without a provider key: no public page, no staff panel, a clear explanation", async ({
    page,
    request,
  }) => {
    expect((await request.get("/furniture-assistant")).status()).toBe(404);
    expect((await request.get("/ar/furniture-assistant")).status()).toBe(404);
    await page.goto("/request-a-quote");
    await expect(page.getByRole("link", { name: "Not sure which product fits?" })).toHaveCount(0);

    await staffSignIn(page);
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "AI assistants" })).toBeVisible();
    await expect(page.getByText(/not set \(assistants stay off\)/)).toBeVisible();
    await page.goto("/admin/ai");
    await expect(page.getByRole("heading", { level: 1, name: "AI drafts" })).toBeVisible();
    await expect(page.getByText("AI assistants are off.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Draft a blog post" })).toHaveCount(0);
    expect(await seriousViolations(page)).toEqual([]);

    await page.goto("/admin/leads");
    await page.getByRole("table", { name: "Leads" }).getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: "AI assistant" })).toHaveCount(0);
  });
});
