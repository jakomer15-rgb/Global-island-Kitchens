import { devices, expect, test, type Page } from "@playwright/test";
import { seriousViolations } from "./axe";
import { E2E_STAFF } from "./global-setup";

/**
 * The sales chat (GIK Smart Assistant) end to end, with the test AI provider. Like ai-ui.spec.ts it
 * needs its own production server with AI_PROVIDER=mock (docs/TEST_REPORT.md):
 *   AI_PROVIDER=mock AI_MOCK_FOR_E2E=1 STORAGE_DRIVER=local DATABASE_URL=<test db> npx next start -p 3300
 *   E2E_AI_MOCK=1 E2E_PORT=3300 npx playwright test e2e/chat.spec.ts
 * The specs share the chat's on/off switch, so they run one after another.
 */
test.skip(!process.env.E2E_AI_MOCK, "needs a server with AI_PROVIDER=mock");
// One switch for the whole site: run once (desktop project), in order; the Arabic test uses a phone screen.
test.skip(({ isMobile }) => isMobile, "runs once, on the desktop project");
test.describe.configure({ mode: "serial" });
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `10.7.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  },
});

const uid = () => Math.random().toString(36).slice(2, 8);

async function signIn(page: Page) {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email").fill(E2E_STAFF.email);
  await page.getByLabel("Password").fill(E2E_STAFF.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 20_000 });
}

async function setChat(page: Page, on: boolean) {
  await page.goto("/admin/ai-agent");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Save chat settings" }) });
  const box = form.getByLabel("Show the chat on the website");
  if (on) await box.check();
  else await box.uncheck();
  await form.getByRole("button", { name: "Save chat settings" }).click();
  await expect(form.getByText(/Saved/)).toBeVisible({ timeout: 20_000 });
}

async function openChat(page: Page, locale: "en" | "ar" = "en") {
  await page.goto(locale === "ar" ? "/ar" : "/");
  const name = locale === "ar" ? "تحدثوا مع مساعد GIK الذكي" : "Chat with GIK Smart Assistant";
  await page.getByRole("button", { name }).click();
  const chat = page.getByRole("dialog", {
    name: locale === "ar" ? "مساعد GIK الذكي" : "GIK Smart Assistant",
  });
  await expect(chat).toBeVisible({ timeout: 20_000 });
  return chat;
}

test("the sales chat: quick options, a reply, the contact form and the lead in the admin", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  await signIn(page);
  await setChat(page, true);
  const visitorContext = await browser.newContext({
    extraHTTPHeaders: {
      "x-forwarded-for": `10.8.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    },
  });
  const visitor = await visitorContext.newPage();
  try {
    const chat = await openChat(visitor);
    await expect(chat.getByText("Welcome to Global Island Kitchens!")).toBeVisible();
    await expect(chat.getByText(/You are chatting with an AI assistant/)).toBeVisible();
    expect(await seriousViolations(visitor)).toEqual([]);

    // A quick option shows the product card, from the approved product text
    await chat.getByRole("button", { name: "Wardrobes", exact: true }).first().click();
    await expect(chat.getByRole("heading", { name: "Wardrobes" })).toBeVisible();

    // A typed question: typing indicator, then the reply, then the form the assistant offers
    const name = `E2E Chat ${uid()}`;
    await chat.getByLabel("Your message").fill("A sliding wardrobe in Riffa, please contact me CONTACT_ME");
    await chat.getByLabel("Your message").press("Enter");
    await expect(chat.getByText(/This is a test reply/)).toBeVisible({ timeout: 30_000 });
    const form = chat.getByRole("form", { name: "Request a quotation" });
    await expect(form).toBeVisible();
    expect(await seriousViolations(visitor)).toEqual([]);

    // The form: validation, then a lead
    await visitor.waitForTimeout(3200); // the spam timer
    await form.getByRole("button", { name: "Send to our sales team" }).click();
    await expect(form.getByText("Please enter your name.")).toBeVisible();
    await form.getByLabel("Full name").fill(name);
    await form.getByLabel("WhatsApp or mobile number").fill(`3${String(Date.now()).slice(-7)}`);
    await form.getByLabel(/I have read the/).check();
    await form.getByRole("button", { name: "Send to our sales team" }).click();
    const done = chat.getByText(/Your details have been sent to our sales team/);
    await expect(done).toBeVisible({ timeout: 30_000 });
    const reference = (await chat.getByText(/^GIK-A-\d{4}-\d{5}$/).textContent())!.trim();

    // Staff: the lead, the conversation, the dashboard
    await page.goto(`/admin/leads?q=${encodeURIComponent(name)}`);
    await page.getByRole("link", { name: reference }).click();
    await expect(page.getByRole("heading", { level: 1, name: `${name} · ${reference}` })).toBeVisible();
    await expect(page.getByText("Website chat").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rating (HOT / WARM / COLD)" })).toBeVisible();
    await page.getByRole("link", { name: "Read the conversation" }).click();
    await expect(page.getByText("A sliding wardrobe in Riffa, please contact me CONTACT_ME")).toBeVisible();
    await expect(page.getByText(new RegExp(`Contact form sent .*${reference}`))).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);

    await page.goto("/admin/ai-sales");
    await expect(page.getByRole("link", { name: reference })).toBeVisible();
    const csv = await page.request.get("/admin/ai-sales/export?source=website_chat");
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain(reference);
    // A date that doesn't exist is ignored, not a server error.
    expect((await page.request.get("/admin/ai-sales/export?from=2026-02-31&to=2026-13-01")).status()).toBe(
      200,
    );
  } finally {
    await visitorContext.close();
    await setChat(page, false);
  }
  // Switched off: no button on the site, and the endpoint refuses.
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Chat with GIK Smart Assistant" })).toHaveCount(0);
  const refused = await page.request.post("/api/chat", {
    headers: { origin: new URL(page.url()).origin },
    data: { locale: "en", messages: [{ role: "user", text: "Hello" }] },
  });
  expect(refused.status()).toBe(503);
});

test("the sales chat in Arabic, right to left, without accessibility problems", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await signIn(page);
  await setChat(page, true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- not a context option
  const { defaultBrowserType, ...phone } = devices["Pixel 7"];
  const visitorContext = await browser.newContext({
    ...phone,
    extraHTTPHeaders: {
      "x-forwarded-for": `10.9.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    },
  });
  const visitor = await visitorContext.newPage();
  try {
    const chat = await openChat(visitor, "ar");
    // A phone screen: the chat fills it.
    const box = (await chat.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(visitor.viewportSize()!.width - 1);
    await expect(chat.getByText("أهلًا بكم في Global Island Kitchens!")).toBeVisible();
    await chat.getByRole("button", { name: "تحدثوا مع فريق المبيعات" }).first().click();
    await chat.getByRole("button", { name: "طلب معاودة الاتصال" }).click();
    await expect(chat.getByRole("form", { name: "طلب معاودة الاتصال" })).toBeVisible();
    expect(await visitor.evaluate(() => document.documentElement.dir)).toBe("rtl");
    expect(await seriousViolations(visitor)).toEqual([]);
  } finally {
    await visitorContext.close();
    await setChat(page, false);
  }
});

test("the public chat endpoints refuse other sites and bad input", async ({ request, baseURL }) => {
  const elsewhere = await request.post("/api/chat", {
    headers: { origin: "https://evil.example" },
    data: { locale: "en", messages: [{ role: "user", text: "Hello" }] },
  });
  expect(elsewhere.status()).toBe(403);
  const empty = await request.post("/api/chat", {
    headers: { origin: baseURL! },
    data: { locale: "en", messages: [] },
  });
  expect(empty.status()).toBe(400);
  const contact = await request.post("/api/chat/contact", {
    headers: { origin: baseURL! },
    data: { locale: "en", reason: "callback", name: "x" },
  });
  expect(contact.status()).toBe(400);
});
