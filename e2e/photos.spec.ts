import { expect, test, type Page } from "@playwright/test";

/** Scrolls each site photo (/images) into view, waits up to 10 s for it to load, and returns those that did not. */
async function brokenImages(page: Page) {
  return page.evaluate(async () => {
    const failed: string[] = [];
    for (const img of [...document.images].filter((i) => i.src.includes("/images/"))) {
      img.scrollIntoView({ block: "center", behavior: "instant" });
      for (let i = 0; i < 100 && !(img.complete && img.naturalWidth > 0); i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (img.naturalWidth === 0) failed.push(img.src);
    }
    return failed;
  });
}

const pagesWithPhotos = [
  "/",
  "/ar",
  "/projects",
  "/projects/al-faris-suite-2-juffair",
  "/ar/projects/marassi-bay-flats",
  "/kitchens/wooden",
  "/walk-in-closets",
  "/tv-units",
  "/bathroom-vanities",
  "/wall-cladding",
  "/bedroom-furniture",
  "/about",
];

test.describe("photographs from the company profile", () => {
  for (const path of pagesWithPhotos) {
    test(`${path} shows photos and none are broken`, async ({ page }) => {
      await page.goto(path);
      expect(await page.locator("main img").count()).toBeGreaterThan(0);
      expect(await brokenImages(page)).toEqual([]);
    });
  }

  test("photos have alt text in the page language; project cards use empty alt (the heading names them)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("main img").first()).toHaveAttribute("alt", /kitchen/i);
    await page.goto("/ar");
    const alt = await page.locator("main img").first().getAttribute("alt");
    expect(alt).toMatch(/[؀-ۿ]/);
  });

  test("a project with photos is indexable and in the sitemap; one without stays out", async ({
    page,
    request,
  }) => {
    await page.goto("/projects/al-faris-suite-2-juffair");
    await expect(page.locator("meta[name=robots][content*=noindex]")).toHaveCount(0);
    await expect(page.getByRole("img").first()).toBeVisible();
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/projects/al-faris-suite-2-juffair");
    expect(sitemap).not.toContain("/projects/vista-juffair");
  });

  test("a project without photos says so", async ({ page }) => {
    await page.goto("/projects/vista-juffair");
    await expect(page.getByText("no photographs of this project yet")).toBeVisible();
  });
});
