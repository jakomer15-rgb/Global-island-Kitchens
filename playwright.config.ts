import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
// Locally, use the installed Google Chrome; CI installs Playwright's own Chromium.
const browser = process.env.CI ? {} : { channel: "chrome" };
if (!process.env.DATABASE_URL_TEST && existsSync(".env.local")) process.loadEnvFile(".env.local");

/** E2E tests run against a production build (`npm run build` first) using the test database. */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...browser } },
    { name: "mobile", use: { ...devices["Pixel 7"], ...browser } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Never the development database.
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      LOCAL_STORAGE_DIR: ".data/uploads-e2e",
      // Test-only: local file storage in a production build (real deployments use S3/R2).
      STORAGE_DRIVER: "local",
    },
  },
});
