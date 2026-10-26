import { expect, test, type Page } from "@playwright/test";
import { seriousViolations } from "./axe";
import { E2E_STAFF } from "./global-setup";

/**
 * The AI screens with the test provider. A production build only accepts AI_PROVIDER=mock together
 * with AI_MOCK_FOR_E2E=1, so this runs against its own server (see docs/TEST_REPORT.md):
 *   AI_PROVIDER=mock AI_MOCK_FOR_E2E=1 STORAGE_DRIVER=local DATABASE_URL=<test db> npx next start -p 3300
 *   E2E_AI_MOCK=1 E2E_PORT=3300 npx playwright test e2e/ai-ui.spec.ts --project=desktop
 */
test.skip(!process.env.E2E_AI_MOCK, "needs a server with AI_PROVIDER=mock");
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `10.5.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  },
});

async function signIn(page: Page) {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(E2E_STAFF.email);
  await page.getByLabel("Password").fill(E2E_STAFF.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}

async function setAi(page: Page, on: boolean) {
  await page.goto("/admin/settings");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Save AI settings" }) });
  for (const label of [/Turn AI assistants on/, /Public furniture assistant/]) {
    if (on) await form.getByLabel(label).check();
    else await form.getByLabel(label).uncheck();
  }
  await form.getByRole("button", { name: "Save AI settings" }).click();
  await expect(form.getByText(/Saved/)).toBeVisible();
}

test("drafts are reviewed by a person, and the public assistant answers in plain text", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  page.on("dialog", (d) => d.accept());
  await signIn(page);
  await setAi(page, true);
  try {
    // Blog draft: nothing is published, the draft waits for review
    await page.goto("/admin/ai");
    await expect(page.getByText("AI assistants are off.")).toHaveCount(0);
    await page.getByLabel("Topic").fill("Caring for painted MDF doors");
    await page.getByRole("button", { name: "Ask the assistant" }).click();
    const card = page.locator("article").filter({ hasText: "Blog post" }).first();
    await expect(card.getByText("Needs review")).toBeVisible({ timeout: 30_000 });
    expect(await seriousViolations(page)).toEqual([]);
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("link", { name: "open the blog draft" }).first()).toBeVisible({
      timeout: 30_000,
    });

    // Lead reply: edit, approve, and it lands as an internal note (nothing is sent)
    await page.goto("/admin/leads");
    await page.getByRole("table", { name: "Leads" }).getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: "AI assistant" })).toBeVisible();
    await page.getByLabel("What should the reply do? (optional)").fill("Ask for the wall measurements");
    await page.getByRole("button", { name: "Draft a reply" }).click();
    const reply = page.locator("article").filter({ hasText: "Reply to a customer" }).first();
    await expect(reply.getByLabel("Reply")).toBeVisible({ timeout: 30_000 });
    const text = `Edited by staff ${Math.random().toString(36).slice(2, 8)}`;
    await reply.getByLabel("Reply").fill(text);
    await reply.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText(`Approved AI draft reply (not sent`)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(text).first()).toBeVisible();

    // Public assistant
    const visitor = await context.newPage();
    await visitor.goto("/request-a-quote");
    await visitor.getByRole("link", { name: "Not sure which product fits?" }).click();
    await expect(
      visitor.getByRole("heading", { level: 1, name: "Not sure which product fits?" }),
    ).toBeVisible();
    await visitor.getByLabel("What do you need?").fill("A small kitchen for an apartment, light wood look");
    await visitor.waitForTimeout(3200);
    await visitor.getByRole("button", { name: "Get suggestions" }).click();
    await expect(
      visitor.getByText(/A fitted kitchen in EGGER melamine or painted MDF suits this/),
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(visitor.getByRole("link", { name: "Customised wooden kitchens" })).toBeVisible();
    expect(await seriousViolations(visitor)).toEqual([]);
  } finally {
    await setAi(page, false);
  }
  expect((await page.request.get("/furniture-assistant")).status()).toBe(404);
});
