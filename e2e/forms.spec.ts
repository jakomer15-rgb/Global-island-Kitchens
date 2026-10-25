import { expect, test, type Page } from "@playwright/test";
import { seriousViolations } from "./axe";
import { E2E_STAFF } from "./global-setup";

// Each test gets its own client address so the per-IP form limits don't interfere between runs.
test.use({ extraHTTPHeaders: { "x-forwarded-for": `10.${rand(255)}.${rand(255)}.${rand(255)}` } });

function rand(n: number) {
  return Math.floor(Math.random() * n);
}
const phone = () => `3${String(rand(1e7)).padStart(7, "0")}`;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(200).fill(9)]);

/** The forms reject submissions made faster than a person could type. */
async function humanPause(page: Page) {
  await page.waitForTimeout(3200);
}

async function signIn(page: Page) {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(E2E_STAFF.email);
  await page.getByLabel("Password").fill(E2E_STAFF.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function expectInAdmin(page: Page, reference: string) {
  await signIn(page);
  await page.goto(`/admin?ref=${reference}`);
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
}

test.describe("forms save to the database", () => {
  test.skip(({ isMobile }) => isMobile, "submissions run once, on desktop");

  test("contact form", async ({ page }) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Please enter your name.")).toBeVisible();
    await expect(page.getByText("Please give a phone number or an email address.")).toBeVisible();

    await page.getByLabel("Full name").fill("E2E Contact");
    await page.getByLabel("Phone number").fill(phone());
    await page.getByLabel("Your message").fill("Do you make laundry rooms with smart storage?");
    await page.getByLabel(/privacy policy/).check();
    await humanPause(page);
    await page.getByRole("button", { name: "Send message" }).click();
    const status = page.getByRole("status");
    await expect(status).toContainText("We have received it");
    const reference = (await status.locator("strong").textContent())!;
    expect(reference).toMatch(/^GIK-M-\d{4}-\d{5,}$/);
    await expectInAdmin(page, reference);
    await expect(
      page.locator("pre").filter({ hasText: "Do you make laundry rooms with smart storage?" }),
    ).toBeVisible();
  });

  test("consultation booking", async ({ page }) => {
    await page.goto("/book-a-consultation");
    await page.getByLabel("Site visit").check();
    await page.getByRole("button", { name: "Request consultation" }).click();
    await expect(page.getByText("Please tell us where the site visit is.")).toBeVisible();

    const date = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
    await page.getByLabel("Preferred date").fill(date);
    await page.getByLabel("Preferred time").selectOption("evening");
    await page.getByLabel("Site location").fill("Riffa");
    await page.getByLabel("Full name").fill("E2E Visit");
    await page.getByLabel("Phone number").fill(phone());
    await page.getByLabel(/privacy policy/).check();
    await humanPause(page);
    await page.getByRole("button", { name: "Request consultation" }).click();
    const reference = (await page.getByRole("status").locator("strong").textContent())!;
    expect(reference).toMatch(/^GIK-C-/);
    await expectInAdmin(page, reference);
    await expect(page.getByText(/site visit/).first()).toBeVisible();
  });

  test("quotation wizard with an upload, end to end", async ({ page, request }) => {
    await page.goto("/request-a-quote?category=wardrobes");
    await expect(page.getByLabel("Wardrobes")).toBeChecked();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: validation, then measurements
    await expect(page.getByRole("heading", { name: "Measurements" })).toBeFocused();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/Enter at least one width/)).toBeVisible();
    await page.getByLabel("Width (cm)").fill("320");
    await page.getByLabel("Height (cm)").fill("270");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: materials
    await page.getByLabel(/EGGER laminate/).check();
    await page.getByLabel("Painted MDF").check();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4: upload (a real PNG goes to local storage through a signed URL)
    await page
      .locator("input[type=file]")
      .setInputFiles({ name: "room.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText(/Ready/)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 5: details
    await page.getByLabel("Full name").fill("E2E Wizard");
    await page.getByLabel("Phone number").fill(phone());
    await page
      .getByLabel("Email", { exact: false })
      .first()
      .fill(`wizard-${rand(1e9)}@example.test`);
    await page.getByLabel(/privacy policy/).check();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 6: review and send
    await expect(page.getByText("room.png")).toBeVisible();
    await expect(page.getByText(/320 × 270 cm/)).toBeVisible();
    await humanPause(page);
    await page.getByRole("button", { name: "Send request" }).click();
    const reference = (await page.getByRole("status").locator("strong").textContent())!;
    expect(reference).toMatch(/^GIK-Q-/);

    await expectInAdmin(page, reference);
    await expect(page.getByText("Wardrobes", { exact: true })).toBeVisible();
    const download = page.getByRole("link", { name: "room.png" });
    const href = await download.getAttribute("href");
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect(Buffer.from(await res.body()).equals(PNG)).toBe(true);
    // Signed-out visitors can't download it.
    expect((await request.get(href!, { maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(300);
  });
});

test("Arabic wizard validates in Arabic", async ({ page }) => {
  await page.goto("/ar/request-a-quote");
  await page.getByRole("button", { name: "متابعة" }).click();
  await expect(page.getByText("اختاروا ما تحتاجونه.")).toBeVisible();
});

test("form pages have no serious accessibility violations", async ({ page }) => {
  test.setTimeout(90_000);
  for (const path of ["/request-a-quote", "/ar/book-a-consultation", "/contact"]) {
    await page.goto(path);
    expect(await seriousViolations(page), path).toEqual([]);
  }
});

test.describe("security", () => {
  test("upload start refuses cross-site requests", async ({ request }) => {
    const res = await request.post("/api/uploads", {
      data: { name: "a.png", type: "image/png", size: 10 },
      headers: { origin: "https://evil.example" },
    });
    expect(res.status()).toBe(403);
  });

  test("admin needs a session and doesn't say which credential was wrong", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in/);
    // An unknown email gets exactly the same message as a wrong password (no account enumeration).
    await page.getByLabel("Email").fill(`nobody-${rand(1e9)}@example.test`);
    await page.getByLabel("Password").fill("wrong password value");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/Email or password is incorrect/)).toHaveAttribute("role", "alert");
  });

  test("cron endpoint needs its secret", async ({ request }) => {
    expect((await request.get("/api/cron/outbox")).status()).toBe(401);
  });
});
