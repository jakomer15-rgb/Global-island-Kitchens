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
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 20_000 });
}

const pages = [
  ["/admin", "Dashboard"],
  ["/admin/follow-ups", "Follow-ups"],
  ["/admin/leads", "Leads"],
  ["/admin/ai-sales", "AI sales"],
  ["/admin/ai-agent", "AI agent"],
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
  ["/admin/leads/pipeline", "Sales pipeline"],
  ["/admin/customers/duplicates", "Possible duplicate customers"],
  ["/admin/ai-agent/documents/new", "Upload a document"],
  ["/admin/marketing", "Prospects"],
  ["/admin/marketing/new", "Add a prospect"],
  ["/admin/marketing/import", "Import prospects"],
  ["/admin/marketing/places", "Find businesses"],
  ["/admin/marketing/campaigns", "Campaigns"],
  ["/admin/marketing/reports", "Lead generation report"],
  ["/admin/social", "Content calendar"],
  ["/admin/social/posts", "All posts"],
  ["/admin/social/new", "New post"],
  ["/admin/social/plan", "Plan with AI"],
  ["/admin/social/campaigns", "Social campaigns"],
  ["/admin/social/performance", "Performance"],
  ["/admin/analytics", "Business analytics"],
  ["/admin/analytics/ask", "Ask the analytics agent"],
  ["/admin/automation", "Overview"],
  ["/admin/automation/approvals", "Approvals"],
  ["/admin/automation/integrations", "Integrations"],
  ["/admin/automation/workflows", "Workflows"],
  ["/admin/automation/logs", "System log"],
] as const;

test.describe("admin portal", () => {
  test.skip(({ isMobile }) => isMobile, "admin journeys run once, on desktop");

  test("every page opens for the owner without accessibility problems", async ({ page }) => {
    // axe on 30 pages; slow when the whole suite runs in parallel
    test.setTimeout(720_000);
    await signIn(page);
    for (const [path, heading] of pages) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading }), path).toBeVisible();
      expect(await seriousViolations(page), path).toEqual([]);
    }
  });

  test("the Automation Centre switches to Arabic, right to left, and back", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/automation/integrations");
    await page.getByRole("button", { name: /العربية/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "الربط والتكامل" })).toBeVisible();
    await expect(page.locator('main [dir="rtl"][lang="ar"]').first()).toBeVisible();
    // Honest status: the test environment has no email key, so email is never shown as connected.
    await expect(page.getByText("البريد الإلكتروني (Resend)")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page.getByRole("button", { name: /English/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Integrations" })).toBeVisible();
  });

  test("a new sales manager sees only the CRM", async ({ page, browser }) => {
    // Two password hashes and several page loads; slow when the whole suite runs in parallel, and the
    // test database's staff list grows with every run
    test.setTimeout(180_000);
    await signIn(page);
    await page.goto("/admin/staff");
    const email = `sales-${uid()}@example.test`;
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Create account" }) });
    await form.getByLabel("Full name").fill("E2E Sales");
    await form.getByLabel("Email").fill(email);
    await form.getByLabel("Temporary password").fill("a sales password that is long");
    await form.getByLabel(/Sales & Project Manager/).check();
    await form.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/Account created/)).toBeVisible({ timeout: 90_000 });
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
    // Its own enquiry, so the test doesn't depend on leads left by other tests or earlier runs.
    await page.goto("/contact");
    await page.getByLabel("Full name").fill("E2E Lead");
    await page.getByLabel("Phone number").fill(`3${String(rand(1e7)).padStart(7, "0")}`);
    await page.getByLabel("Your message").fill("Please call me about a kitchen.");
    await page.getByLabel(/privacy policy/).check();
    await page.waitForTimeout(3200); // the form rejects submissions faster than a person types
    await page.getByRole("button", { name: "Send message" }).click();
    const status = page.getByRole("status");
    await expect(status).toContainText("We have received it");
    const reference = (await status.locator("strong").textContent())!;

    await signIn(page);
    await page.goto(`/admin/leads?q=${reference}`);
    await page
      .getByRole("table", { name: "Leads" })
      .getByRole("link", { name: reference, exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(reference);
    const note = `E2E note ${uid()}`;
    await page.getByLabel("Details").fill(note);
    await page.getByRole("button", { name: "Add to history" }).click();
    await expect(page.getByText(note)).toBeVisible();
    // Score panel and the new pipeline stages.
    await expect(page.getByRole("heading", { name: "Lead score" })).toBeVisible();
    await expect(page.getByLabel("Stage", { exact: true }).locator("option")).toHaveText([
      "1. New inquiry",
      "2. Contacted",
      "3. Qualified",
      "4. Site visit",
      "5. Measurement",
      "6. Quotation",
      "7. Negotiation",
      "8. Won",
      "9. Lost",
    ]);
  });

  test("a text document is uploaded, checked and published for the chat", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/ai-agent/documents/new");
    const title = `E2E brochure ${uid()}`;
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("File").setInputFiles({
      name: "brochure.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Sliding wardrobes in EGGER décors.\n\nHinged wardrobes in painted MDF."),
    });
    await page.getByRole("button", { name: "Upload and read" }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Text")).toHaveValue(/Sliding wardrobes/);
    await expect(page.getByText("Draft: not used by the chat")).toBeVisible();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/Published\. The chat uses it/)).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("a prospect is added and a campaign prepared for approval", async ({ page }) => {
    await signIn(page);
    const tag = uid();
    await page.goto("/admin/marketing/new");
    await page.getByLabel("Company or person").fill(`E2E Studio ${tag}`);
    await page.getByLabel("Business email").fill(`hello@e2e-${tag}.example`);
    await page.getByLabel("Country").selectOption("QA");
    await page.getByRole("button", { name: "Add prospect" }).click();
    await expect(page.getByRole("heading", { level: 1, name: `E2E Studio ${tag}` })).toBeVisible();
    // Interior designer 25 + Qatar 10 + email 15 = 50: medium.
    await expect(page.getByText("medium priority")).toBeVisible();

    await page.goto("/admin/marketing/campaigns");
    await page.getByLabel("Name").fill(`E2E campaign ${tag}`);
    await page
      .getByLabel("What the emails should say")
      .fill("Introduce our factory to interior designers in Qatar.");
    await page.getByLabel("Country").selectOption("QA");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByRole("heading", { level: 1, name: `E2E campaign ${tag}` })).toBeVisible();
    await page.getByLabel("Subject").fill("Kitchens and wardrobes for {company}");
    await page
      .getByLabel("Email", { exact: true })
      .fill(
        "We manufacture fitted kitchens and wardrobes and would be glad to support your projects in {area}.",
      );
    await page.getByRole("button", { name: "Save email" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.getByRole("button", { name: "Prepare the emails" }).click();
    await expect(page.getByText(/email\(s\) prepared/)).toBeVisible();
    await expect(page.getByRole("link", { name: `E2E Studio ${tag}` })).toBeVisible();
    await page.getByRole("button", { name: "Send for approval" }).click();
    // The page switches to the approval step (the button and its message go away).
    await expect(page.getByText("Waiting for approval").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Approve and send \d+ email/ })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("a social media post is written, approved and marked as posted", async ({ page }) => {
    await signIn(page);
    const title = `E2E post ${uid()}`;
    await page.goto("/admin/social/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Type").selectOption("text");
    await page.getByRole("checkbox", { name: "Instagram" }).uncheck();
    await page.getByRole("checkbox", { name: "LinkedIn" }).check();
    await page.getByLabel("Captions", { exact: true }).selectOption("en");
    await page.getByLabel("Caption (English)").fill("Painted MDF kitchens, designed and made in Bahrain.");
    await page.getByLabel("Hashtags").fill("#Bahrain #Kitchens");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    await page.getByRole("button", { name: "Send for approval" }).click();
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    // No Meta connection in tests: both platforms are posted by hand, then marked.
    const mark = page.getByRole("button", { name: "Mark as posted" });
    await expect(mark).toHaveCount(2);
    await expect(page.locator("pre").filter({ hasText: "#Bahrain #Kitchens" })).toContainText(
      "Painted MDF kitchens, designed and made in Bahrain.",
    );
    await mark.first().click();
    await expect(mark).toHaveCount(1);
    await mark.first().click();
    await expect(mark).toHaveCount(0);
    await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);

    await page.goto("/admin/social");
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  });

  test("business reports switch between periods and can be emailed", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/analytics?report=monthly");
    await expect(page.getByRole("link", { name: "Monthly" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Total enquiries")).toBeVisible();
    await page.getByRole("link", { name: "← Earlier" }).click();
    await expect(page).toHaveURL(/back=1/);
    await expect(page.getByRole("link", { name: "Later →" })).toBeVisible();
    await page.getByRole("checkbox", { name: "Weekly" }).check();
    await page.getByLabel("Send to").fill("reports@gik.example");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Weekly" })).toBeChecked();
    // Back off, so other runs start from the default.
    await page.getByRole("checkbox", { name: "Weekly" }).uncheck();
    await page.getByLabel("Send to").fill("");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("a workflow is switched on, run by hand and logged, then switched off", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/automation/workflows");
    await expect(page.locator("main li[id]")).toHaveCount(9); // the brief's nine workflows
    const card = page.locator("#qualified_follow_up");
    await card.getByRole("checkbox", { name: "Switched on" }).check();
    await card.getByLabel("Follow up after (days)").fill("2");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByText("Saved.")).toBeVisible();
    await card.getByRole("button", { name: "Run now" }).click();
    await expect(card.getByText(/^Done: created \d+/)).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("table", { name: "Run log" }).getByText("Qualified lead → follow-up").first(),
    ).toBeVisible();
    await card.getByRole("checkbox", { name: "Switched on" }).uncheck();
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByText("Saved.")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("leads can be filtered, sorted and exported", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/leads?sort=score&stage=open");
    await expect(page.getByLabel("Sort by")).toHaveValue("score");
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export to Excel (CSV)" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^gik-leads-\d{4}-\d{2}-\d{2}\.csv$/);
    await page.goto("/admin/leads/pipeline");
    await expect(
      page.getByRole("region", { name: /Pipeline stages/ }).getByRole("heading", { name: /Site visit/ }),
    ).toBeVisible();
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
