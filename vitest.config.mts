import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// DB tests run against DATABASE_URL_TEST (written to .env.local by `npm run db:start`, or set in CI).
if (!process.env.DATABASE_URL_TEST && existsSync(".env.local")) process.loadEnvFile(".env.local");
const testDatabaseUrl = process.env.DATABASE_URL_TEST ?? "";

const shared = {
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside Next's server bundle; tests are server-side by definition.
      "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)),
    },
  },
};

export default defineConfig({
  ...shared,
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.db.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "db",
          include: ["src/**/*.db.test.ts"],
          environment: "node",
          globalSetup: ["test/db-global-setup.ts"],
          // One worker: tests share the test database.
          fileParallelism: false,
          env: { DATABASE_URL: testDatabaseUrl, NODE_ENV: "test" },
          testTimeout: 20_000,
        },
      },
    ],
  },
});
