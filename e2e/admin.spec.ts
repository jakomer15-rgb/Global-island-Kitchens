import { expect, test, type Page } from "@playwright/test";
import { seriousViolations } from "./axe";
import { E2E_STAFF } from "./global-setup";

test.use({ extraHTTPHeaders: { "x-forwarded-for": `10.${rand(255)}.${rand(255)}.${rand(255)}` } });

function rand(n: number) {
  return Math.floor(Math.random() * n);
}
const uid = () => Math.random().toString(36).slice(2, 8);

async function signIn(page: Page, email = E2E_STAFF.email, password = E2E_STAFF.password) {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}

const pages = [
  ["/admin", "Dashboard"],
  ["/admin/follow-ups", "Follow-ups"],
  ["/admin/leads", "Leads"],
  ["/admin/customers", "Customers"],
  ["/admin/consultations", "Consultations"],
  ["/admin/content", "Homepage and banner"],
  ["/admin/materials", "Materials library"],
  ["/admin/portfolio", "Portfolio"],
  ["/admin/testimonials", "Testimonials"],
  ["/admin/blog", "Blog"],
  ["/admin/media", "Website images"],
  ["/admin/settings", "Settings"],
  ["/admin/staff", "Staff"],
  ["/admin/staff/roles", "Roles and permissions"],
  ["/admin/audit", "Audit log"],
  ["/admin/notifications", "Notifications"],
] as const;

test.describe("admin portal", () => {
  test.skip(({ isMobile }) => isMobile, "admin journeys run once, on desktop");

  test("every page opens for the owner without accessibility problems", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);
    for (const [path, heading] of pages) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading }), path).toBeVisible();
      expect(await seriousViolations(page), path).toEqual([]);
    }
  });

  test("a new sales manager sees only the CRM", async ({ page, browser }) => {
    await signIn(page);
    await page.goto("/admin/staff");
    const email = `sales-${uid()}@example.test`;
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Create account" }) });
    await form.getByLabel("Full name").fill("E2E Sales");
    await form.getByLabel("Email").fill(email);
    await form.getByLabel("Temporary password").fill("a sales password that is long");
    await form.getByLabel(/Sales & Project Manager/).check();
    await form.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/Account created/)).toBeVisible();
    await expect(form.getByLabel("Email")).toHaveValue("");

    const other = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": `10.9.${rand(255)}.${rand(255)}` },
    });
    const sales = await other.newPage();
    await signIn(sales, email, "a sales password that is long");
    const nav = sales.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Leads" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Staff" })).toHaveCount(0);
    await sales.goto("/admin/staff");
    await expect(sales).toHaveURL(/\/admin\/no-access/);
    await sales.goto("/admin/settings");
    await expect(sales).toHaveURL(/\/admin\/no-access/);
    await other.close();

    await page.goto("/admin/audit?action=staff.");
    await expect(page.getByText("staff.created").first()).toBeVisible();
  });

  test("a banner saved in the admin appears on the public site", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/content");
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Save banner" }) });
    const text = `Showroom closed for inventory ${uid()}`;
    // Turning it on without Arabic is refused and keeps what was typed.
    await form.getByLabel("Show the banner").check();
    await form.getByLabel("Text (English)").fill(text);
    await form.getByLabel("Text (Arabic)").fill("");
    await form.getByRole("button", { name: "Save banner" }).click();
    await expect(form.getByText(/English and Arabic before turning it on/)).toBeVisible();
    await expect(form.getByLabel("Text (English)")).toHaveValue(text);

    await form.getByLabel("Text (Arabic)").fill("صالة العرض مغلقة للجرد");
    await form.getByRole("button", { name: "Save banner" }).click();
    await expect(form.getByText(/Saved/)).toBeVisible();
    try {
      await page.goto("/contact");
      await expect(page.getByRole("note")).toHaveText(text);
      await page.goto("/ar/contact");
      await expect(page.getByRole("note")).toHaveText("صالة العرض مغلقة للجرد");
    } finally {
      await page.goto("/admin/content");
      await form.getByLabel("Show the banner").uncheck();
      await form.getByRole("button", { name: "Save banner" }).click();
      await expect(form.getByText(/Saved/)).toBeVisible();
    }
    await page.goto("/contact");
    await expect(page.getByText(text)).toHaveCount(0);
  });

  test("a checked EGGER décor and a bilingual post are published", async ({ page }) => {
    await signIn(page);
    const code = `H${rand(9000) + 1000} ST${uid()}`;
    await page.goto("/admin/materials/new");
    await page.getByLabel("Board").selectOption("egger_melamine");
    await page.getByLabel("Décor code / colour reference").fill(code);
    await page.getByLabel("Name (English)").fill("E2E Halifax Oak");
    await page.getByLabel("Name (Arabic)").fill("بلوط هاليفاكس");
    await page.getByLabel("Swatch colour").fill("#8b6a4f");
    await page.getByLabel("Show on the website").check();
    await page.getByRole("button", { name: "Add material" }).click();
    await expect(page.getByText(/Check the décor against the current range/)).toBeVisible();
    await page.getByLabel(/I checked this décor/).check();
    await page.getByRole("button", { name: "Add material" }).click();
    await expect(page).toHaveURL(/\/admin\/materials$/);
    await page.goto("/materials");
    await expect(page.getByText(code)).toBeVisible();
    await page.goto("/ar/materials");
    await expect(page.getByText("بلوط هاليفاكس").first()).toBeVisible();

    const slug = `e2e-post-${uid()}`;
    await page.goto("/admin/blog/new");
    await page.getByLabel("Web address").fill(slug);
    await page.getByLabel("Title (English)").fill("Caring for painted MDF");
    await page
      .getByLabel("Text (English)")
      .fill("Wipe with a soft damp cloth.\n\n## Avoid\n\n- Abrasive cleaners\n- Standing water");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page).toHaveURL(/\/admin\/blog\/[a-z0-9]+$/);
    // Drafts aren't public.
    expect((await page.request.get(`/blog/${slug}`)).status()).toBe(404);

    await page.getByLabel("Title (Arabic)").fill("العناية بألواح MDF المطلية");
    await page.getByLabel("Text (Arabic)").fill("امسحوها بقطعة قماش ناعمة ورطبة.");
    await page.getByLabel(/Published/).check();
    await page.getByRole("button", { name: "Save post" }).click();
    await expect(page.getByText("Post saved.")).toBeVisible();

    await page.goto(`/blog/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: "Caring for painted MDF" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Avoid" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Abrasive cleaners" })).toBeVisible();
    await page.goto(`/ar/blog/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: "العناية بألواح MDF المطلية" })).toBeVisible();
    await page.goto("/blog");
    await expect(page.locator(`a[href="/blog/${slug}"]`)).toHaveText("Caring for painted MDF");
  });

  test("a lead can be worked from the leads list", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/leads");
    const first = page.getByRole("table", { name: "Leads" }).getByRole("link").first();
    await first.click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("GIK-");
    const note = `E2E note ${uid()}`;
    await page.getByLabel("Details").fill(note);
    await page.getByRole("button", { name: "Add to history" }).click();
    await expect(page.getByText(note)).toBeVisible();
  });
});

test("admin menu works on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await signIn(page);
  await page.getByRole("button", { name: "Open admin menu" }).click();
  const menu = page.getByRole("dialog", { name: "Admin menu" });
  await menu.getByRole("link", { name: "Leads" }).click();
  await expect(page).toHaveURL(/\/admin\/leads/);
  await expect(menu).toHaveCount(0);
});
