import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Brings the test database up to the committed migrations and seeds it (both idempotent). Tests
 * create uniquely named rows, so earlier runs' data is harmless. Refuses to run against anything
 * but a database whose name ends in "_test".
 */
export default function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set. Run `npm run db:start` first (see README).");
  if (!new URL(url).pathname.endsWith("_test")) {
    throw new Error("DATABASE_URL_TEST must point to a database whose name ends in _test.");
  }
  const env = { ...process.env, DATABASE_URL: url };
  const bin = (p: string) => path.join(process.cwd(), "node_modules", p);
  execFileSync(process.execPath, [bin("prisma/build/index.js"), "migrate", "deploy"], { env, stdio: "pipe" });
  execFileSync(process.execPath, [bin("tsx/dist/cli.mjs"), "prisma/seed.ts"], { env, stdio: "pipe" });
}
