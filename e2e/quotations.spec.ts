import { expect, test, type Page } from "@playwright/test";
import { seriousViolations } from "./axe";
import { E2E_STAFF } from "./global-setup";

test.use({ extraHTTPHeaders: { "x-forwarded-for": `10.7.${rand(255)}.${rand(255)}` } });

function rand(n: number) {
  return Math.floor(Math.random() * n);
}

async function signIn(page: Page) {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(E2E_STAFF.email);
  await page.getByLabel("Password").fill(E2E_STAFF.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}

async function pdfBytes(page: Page, href: string) {
  const res = await page.request.get(href);
  expect(res.status(), href).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  const body = Buffer.from(await res.body());
  expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  return body;
}

test.describe("quotations and projects", () => {
  test.skip(({ isMobile }) => isMobile, "runs once, on desktop");

  test("a quotation is drafted, sent with a stored PDF, approved and converted into a project", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    page.on("dialog", (d) => d.accept());
    await signIn(page);

    await page.goto("/admin/leads");
    await page.getByRole("table", { name: "Leads" }).getByRole("link").first().click();
    await page.getByRole("button", { name: "Create quotation" }).click();
    await expect(page).toHaveURL(/\/admin\/quotations\/[a-z0-9]+$/);
    const quotationUrl = page.url();
    const id = quotationUrl.split("/").pop()!;
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/GIK-QT-\d{4}-\d{5}/);

    // Draft: one item, discount, live totals (2.5 × 450.000 − 50.000 = 1,075.000; VAT off)
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByLabel("Description").fill("Wardrobe, EGGER melamine carcass, painted MDF doors");
    await page.getByLabel("Unit", { exact: true }).selectOption("linear_metre");
    await page.getByLabel("Quantity").fill("2.5");
    await page.getByLabel("Unit price (BHD)").fill("450");
    await page.getByLabel("Discount (BHD)").fill("50");
    const valid = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    await page.getByLabel("Valid until").fill(valid);
    await page.getByLabel("Document language").selectOption("ar");
    await expect(page.getByText("VAT (off)")).toBeVisible();
    await expect(page.getByText(/BHD\s?1,075\.000/)).toBeVisible();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);

    // Draft preview, rendered by headless Chrome with the Arabic fonts
    const preview = await pdfBytes(page, `/admin/quotations/${id}/pdf`);
    expect(preview.toString("latin1")).toMatch(/IBMPlexSansArabic|Amiri/);

    // The printable page is never public
    expect((await page.request.get(`/documents/quotations/${id}`)).status()).toBe(404);

    await page.getByRole("button", { name: "Mark as sent" }).click();
    // The send panel gives way to the locked revision (the PDF is rendered and stored first).
    await expect(page.getByText("(sent, locked)")).toBeVisible({ timeout: 30_000 });
    const stored = page.getByRole("link", { name: "PDF", exact: true });
    await expect(stored).toBeVisible();
    await pdfBytes(page, (await stored.getAttribute("href"))!);
    // Signed-out visitors get nothing
    expect(
      (
        await page
          .context()
          .request.fetch(`/admin/quotations/${id}/pdf`, { headers: { cookie: "" }, maxRedirects: 0 })
      ).status(),
    ).toBeGreaterThanOrEqual(300);

    await page.getByLabel("Approved by").selectOption("whatsapp");
    await page.getByLabel("Who approved, and details").fill("Customer replied 'approved' on WhatsApp");
    await page.getByRole("button", { name: "Record approval" }).click();
    await expect(page.getByText(/Approved by Whatsapp .*approved.* on WhatsApp/)).toBeVisible();

    await page.getByRole("button", { name: "Convert to order and project" }).click();
    await expect(page).toHaveURL(/\/admin\/projects\/[a-z0-9]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/GIK-PR-/);
    await expect(page.getByText(/^GIK-OR-\d{4}-\d{5}$/)).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toHaveText("Production");

    await page.getByLabel("Stage", { exact: true }).selectOption("installation");
    await page.getByRole("button", { name: "Update stage" }).click();
    await expect(page.getByText("Stage updated.")).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toHaveText("Installation");
    await expect(page.getByText("Production → Installation")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);

    await page.goto(quotationUrl);
    await expect(page.getByText("Converted", { exact: true })).toBeVisible();
    for (const path of ["/admin/quotations", "/admin/orders", "/admin/projects"]) {
      await page.goto(path);
      expect(await seriousViolations(page), path).toEqual([]);
    }
  });
});
