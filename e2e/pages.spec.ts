import { seriousViolations } from "./axe";
import { expect, test } from "@playwright/test";

/** Every public page (blog excluded: no articles yet). Kept in sync with src/config/routes.ts. */
const paths = [
  "/",
  "/about",
  "/kitchens/wooden",
  "/kitchens/aluminium",
  "/wardrobes",
  "/walk-in-closets",
  "/bedroom-furniture",
  "/tv-units",
  "/wall-cladding",
  "/bathroom-vanities",
  "/bespoke",
  "/materials",
  "/projects",
  "/projects/capri-suites-janabiya",
  "/designers",
  "/request-a-quote",
  "/book-a-consultation",
  "/showroom",
  "/faq",
  "/contact",
  "/privacy-policy",
  "/terms",
];
const localized = paths.flatMap((p) => [p, p === "/" ? "/ar" : `/ar${p}`]);

test.describe("every page", () => {
  for (const path of localized) {
    test(`${path} renders with one h1, a title and canonical`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page).toHaveTitle(/Global Island Kitchens/);
      const canonical = await page.locator("link[rel=canonical]").getAttribute("href");
      expect(new URL(canonical!).pathname).toBe(path);
      await expect(page.locator("html")).toHaveAttribute("dir", path.startsWith("/ar") ? "rtl" : "ltr");
    });
  }

  test("titles are unique across pages", async ({ page }) => {
    test.setTimeout(180_000);
    const titles = new Map<string, string>();
    for (const path of localized) {
      await page.goto(path);
      const title = await page.title();
      expect(titles.get(title), `${path} duplicates ${titles.get(title)}`).toBeUndefined();
      titles.set(title, path);
    }
  });
});

test("no page links to a missing page", async ({ page, request }) => {
  test.setTimeout(180_000);
  const seen = new Set<string>();
  for (const path of localized) {
    await page.goto(path);
    const hrefs = await page
      .locator("a[href^='/']")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    for (const href of hrefs) seen.add(href.split("#")[0] || "/");
  }
  for (const href of seen) {
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
  }
});

test.describe("accessibility (axe, WCAG 2.1 AA)", () => {
  for (const path of localized) {
    test(`${path}`, async ({ page, isMobile }) => {
      // Full sweep on desktop; mobile checks a representative sample.
      test.skip(
        isMobile && !["/", "/ar", "/wardrobes", "/ar/projects", "/contact", "/ar/faq"].includes(path),
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
});

test("project pages are kept out of search until photos exist; unknown projects 404", async ({
  page,
  request,
}) => {
  await page.goto("/projects/vista-juffair");
  await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
  expect((await request.get("/projects/not-a-project")).status()).toBe(404);
});

test("quotation page offers a pre-filled email and real phone numbers", async ({ page }) => {
  await page.goto("/request-a-quote");
  const mail = await page.locator("main a[href^='mailto:']").first().getAttribute("href");
  expect(mail).toMatch(/^mailto:globalkitchen\.bh@gmail\.com\?subject=Quotation%20request&body=/);
  await expect(page.locator("main a[href='tel:+97334597636']")).toBeVisible();
});

test("products menu opens with the keyboard and lists every product", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop navigation");
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "What we make" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  for (const name of [
    "Wooden kitchens",
    "Aluminium kitchens",
    "Wardrobes",
    "Walk-in closets",
    "Bedroom furniture",
    "TV units",
    "Wall cladding",
    "Bathroom vanities",
    "More we make",
    "Materials & finishes",
  ]) {
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name, exact: true }),
    ).toBeVisible();
  }
});

test("FAQ answers open and the page carries FAQPage structured data", async ({ page }) => {
  await page.goto("/faq");
  const first = page.locator("details").first();
  await first.locator("summary").click();
  await expect(first).toHaveAttribute("open", "");
  const ld = await page.locator("script[type='application/ld+json']").allTextContents();
  expect(ld.some((s) => s.includes('"FAQPage"'))).toBe(true);
});
