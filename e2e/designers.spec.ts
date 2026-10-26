import { expect, test, type Browser, type Page } from "@playwright/test";
import { seriousViolations } from "./axe";
import { E2E_STAFF } from "./global-setup";

const rand = (n: number) => Math.floor(Math.random() * n);
const uid = () => Math.random().toString(36).slice(2, 8);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(200).fill(9)]);

// Each person gets their own address so the sign-in and form limits don't collide between runs.
const context = (browser: Browser) =>
  browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.8.${rand(255)}.${rand(255)}` } });

async function staffSignIn(page: Page) {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(E2E_STAFF.email);
  await page.getByLabel("Password").fill(E2E_STAFF.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}

async function designerSignIn(page: Page, email: string, password: string) {
  await page.goto("/designers/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("designer portal", () => {
  test.skip(({ isMobile }) => isMobile, "runs once, on desktop");

  test("a designer registers, is approved, sends a project and talks to staff", async ({ browser }) => {
    test.setTimeout(240_000);
    const email = `designer-${uid()}@example.test`;
    const password = "a long designer password";
    const designerCtx = await context(browser);
    const designer = await designerCtx.newPage();
    const staffCtx = await context(browser);
    const staff = await staffCtx.newPage();
    designer.on("dialog", (d) => d.accept());
    staff.on("dialog", (d) => d.accept());

    // Registration (English) and its accessibility
    await designer.goto("/designers");
    await designer.getByRole("link", { name: "Register as a designer" }).first().click();
    await expect(designer.getByRole("heading", { level: 1, name: "Register as a designer" })).toBeVisible();
    expect(await seriousViolations(designer)).toEqual([]);
    await designer.getByLabel("Full name").fill("E2E Designer");
    await designer.getByLabel(/Company or studio/).fill("E2E Studio");
    await designer.getByLabel("Profession").selectOption("architect");
    await designer.getByLabel("Mobile or phone").fill(`3${String(rand(1e7)).padStart(7, "0")}`);
    await designer.getByLabel("Email").fill(email);
    await designer.getByLabel("Password").fill(password);
    await designer.getByLabel(/I have read the Privacy Policy/).check();
    await designer.waitForTimeout(3200);
    await designer.getByRole("button", { name: "Send registration" }).click();
    await expect(designer.getByText(/We received your registration/)).toBeVisible();

    // Pending: signed in, but the portal only explains the state
    await designerSignIn(designer, email, password);
    await expect(designer).toHaveURL(/\/designers\/portal$/);
    await expect(
      designer.getByRole("heading", { level: 1, name: "Your registration is being reviewed" }),
    ).toBeVisible();
    await designer.goto("/designers/portal/projects/new");
    await expect(designer).toHaveURL(/\/designers\/portal$/);
    // A designer session is not a staff session
    await designer.goto("/admin");
    await expect(designer).toHaveURL(/\/admin\/sign-in/);
    // ...and the staff form refuses a designer's credentials
    await designer.getByLabel("Email").fill(email);
    await designer.getByLabel("Password").fill(password);
    await designer.getByRole("button", { name: "Sign in" }).click();
    await expect(designer.getByRole("alert").filter({ hasText: "incorrect" })).toBeVisible();

    // Staff approve
    await staffSignIn(staff);
    await staff.goto("/admin/designers?status=pending");
    await staff.getByRole("link", { name: "E2E Designer" }).first().click();
    await staff.getByRole("button", { name: "Approve designer" }).click();
    // The decision panel gives way to the new state, so check that rather than the message.
    await expect(staff.getByRole("button", { name: "Approve designer" })).toHaveCount(0);
    await expect(staff.getByRole("button", { name: "Suspend access" })).toBeVisible();

    // Approved designer sends a project with a drawing
    await designerSignIn(designer, email, password);
    await expect(designer.getByRole("link", { name: "Send a new project" })).toBeVisible();
    expect(await seriousViolations(designer)).toEqual([]);
    await designer.getByRole("link", { name: "Send a new project" }).click();
    await designer.getByLabel("Project name").fill("E2E Villa kitchen");
    await designer.getByLabel("What does the project need?").selectOption("woodenKitchens");
    await designer.getByLabel("Your label for the client").fill("Villa K");
    await designer.getByLabel("Width").first().fill("420");
    await designer.getByLabel("Height").first().fill("260");
    await designer.getByLabel("EGGER laminate / melamine").check();
    await designer
      .locator("input[type=file]")
      .setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: PNG });
    await expect(designer.getByText(/Ready/)).toBeVisible();
    expect(await seriousViolations(designer)).toEqual([]);
    await designer.waitForTimeout(3200);
    await designer.getByRole("button", { name: "Send project" }).click();
    await expect(designer).toHaveURL(/\/designers\/portal\/projects\/[a-z0-9]+\?sent=1$/);
    await expect(designer.getByText("Your project was sent.")).toBeVisible();
    await expect(designer.getByText("Received", { exact: true })).toBeVisible();
    await expect(designer.getByText("plan.png")).toBeVisible();
    const reference = (await designer.getByText(/^Reference GIK-Q-/).textContent())!
      .replace("Reference ", "")
      .trim();
    const projectUrl = designer.url().split("?")[0]!;
    expect(await seriousViolations(designer)).toEqual([]);

    // The file downloads for its owner only
    const href = await designer.getByRole("link", { name: "Download" }).getAttribute("href");
    expect((await designer.request.get(href!)).status()).toBe(200);
    expect((await (await context(browser)).request.get(href!, { maxRedirects: 0 })).status()).toBe(401);

    // The project reached the CRM as a designer-portal lead
    await staff.goto(`/admin/leads?q=${reference}`);
    await staff.getByRole("table", { name: "Leads" }).getByRole("link", { name: reference }).click();
    await expect(staff.getByRole("heading", { name: "Designer project" })).toBeVisible();

    // Messages: designer writes, staff reply and leave an internal note
    await designer.getByLabel("Write a message").fill("Can you also quote the island?");
    await designer.getByRole("button", { name: "Send message" }).click();
    await expect(designer.getByText("Can you also quote the island?")).toBeVisible();

    await staff.reload();
    await expect(staff.getByText("Can you also quote the island?")).toBeVisible();
    await staff.getByLabel("Reply to the designer").fill("Yes, send the island drawing.");
    await staff.getByRole("button", { name: "Send", exact: true }).click();
    await expect(staff.getByText("Message sent.")).toBeVisible();
    await staff.getByLabel("Reply to the designer").fill("Tight budget, call before quoting.");
    await staff.getByLabel(/Internal note/).check();
    await staff.getByRole("button", { name: "Send", exact: true }).click();
    await expect(staff.getByText("Note saved.")).toBeVisible();

    await designer.goto(projectUrl);
    await expect(designer.getByText("Yes, send the island drawing.")).toBeVisible();
    await expect(designer.getByText("Tight budget")).toHaveCount(0);

    // Progress follows the lead
    await staff.getByLabel("Status", { exact: true }).selectOption("quoted");
    await staff.getByRole("button", { name: "Update status" }).click();
    await expect(staff.getByText(/Status (updated|changed)|quoted/i).first()).toBeVisible();
    await designer.goto(projectUrl);
    await expect(designer.getByText("Quotation prepared")).toBeVisible();

    // Suspension ends access at once
    await staff.goto("/admin/designers");
    await staff.getByRole("link", { name: "E2E Designer" }).first().click();
    await staff.getByLabel(/Reason/).fill("Test suspension");
    await staff.getByRole("button", { name: "Suspend access" }).click();
    await expect(staff.getByRole("button", { name: "Suspend access" })).toHaveCount(0);
    await designer.goto(projectUrl);
    await expect(designer).toHaveURL(/\/designers\/sign-in/);
    await designerSignIn(designer, email, password);
    await expect(designer.getByRole("heading", { level: 1, name: "Your access is paused" })).toBeVisible();
    await expect(designer.getByText("Test suspension")).toBeVisible();

    await designerCtx.close();
    await staffCtx.close();
  });

  test("the Arabic registration page is right to left and accessible", async ({ page }) => {
    await page.goto("/ar/designers/register");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1, name: "التسجيل كمصمم" })).toBeVisible();
    await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page.goto("/ar/designers/sign-in");
    await expect(page.getByRole("heading", { level: 1, name: "دخول المصممين" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("the portal pages need a designer session and stay out of search", async ({ page, request }) => {
    await page.goto("/designers/portal");
    await expect(page).toHaveURL(/\/designers\/sign-in$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    expect(
      (await request.get("/api/designer/files/abcdefghijklmnopqrstuvwx", { maxRedirects: 0 })).status(),
    ).toBe(401);
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /designers/portal");
  });
});
