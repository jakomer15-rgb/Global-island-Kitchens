import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const locales = [
  { path: "/", lang: "en-BH", dir: "ltr", heading: /made in Bahrain/ },
  { path: "/ar", lang: "ar-BH", dir: "rtl", heading: /صُنعت في البحرين/ },
] as const;

for (const l of locales) {
  test.describe(`homepage ${l.path}`, () => {
    test("renders with the right language, direction and one h1", async ({ page }) => {
      const response = await page.goto(l.path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", l.lang);
      await expect(page.locator("html")).toHaveAttribute("dir", l.dir);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(l.heading);
    });

    test("has no serious accessibility violations", async ({ page }) => {
      await page.goto(l.path);
      // Reveal animations finish before scanning so contrast is measured on final colours.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.reload();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });

    test("only links to pages that exist", async ({ page, request }) => {
      await page.goto(l.path);
      const hrefs = await page
        .locator("a[href^='/']")
        .evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
      for (const href of new Set(hrefs.map((h) => h.split("#")[0] || "/"))) {
        const res = await request.get(href);
        expect(res.status(), href).toBe(200);
      }
    });

    test("contact links use the company's real details", async ({ page }) => {
      await page.goto(l.path);
      await expect(page.locator("a[href='tel:+97334597636']").first()).toBeAttached();
      await expect(page.locator("a[href='mailto:globalkitchen.bh@gmail.com']").first()).toBeAttached();
      await expect(page.locator("a[href='https://www.instagram.com/global_islandkitchens/']")).toBeAttached();
    });
  });
}

test("language switcher keeps the page and switches language", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Switch to Arabic" }).click();
  await expect(page).toHaveURL(/\/ar$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("link", { name: "التبديل إلى الإنجليزية" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("unknown pages return 404", async ({ request }) => {
  expect((await request.get("/kitchens/wooden")).status()).toBe(404);
  expect((await request.get("/ar/does-not-exist")).status()).toBe(404);
});

test("/en redirects to the unprefixed English URL", async ({ request }) => {
  const res = await request.get("/en", { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers().location).toMatch(/\/$/);
});

test("mobile menu opens, navigates and closes", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("link", { name: "Materials" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/#materials$/);
});

test("WhatsApp button stays hidden until a number is configured", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("a[href^='https://wa.me/']")).toHaveCount(0);
});
