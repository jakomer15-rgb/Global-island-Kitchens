import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createStaffUser } from "../src/server/auth/accounts";
import { createPrismaClient } from "../src/server/db/client";

/** E2E runs against the test database; this account signs in to the admin in the tests. */
export const E2E_STAFF = { email: "e2e-owner@example.test", password: "e2e password that is long" };

export default async function globalSetup() {
  if (!process.env.DATABASE_URL_TEST && existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.DATABASE_URL_TEST;
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw new Error("E2E needs DATABASE_URL_TEST ending in _test.");
  const env = { ...process.env, DATABASE_URL: url };
  const bin = (p: string) => path.join(process.cwd(), "node_modules", p);
  execFileSync(process.execPath, [bin("prisma/build/index.js"), "migrate", "deploy"], { env, stdio: "pipe" });
  execFileSync(process.execPath, [bin("tsx/dist/cli.mjs"), "prisma/seed.ts"], { env, stdio: "pipe" });

  const db = createPrismaClient(url);
  try {
    if (!(await db.user.findUnique({ where: { email: E2E_STAFF.email } }))) {
      await db.$transaction((tx) =>
        createStaffUser(tx, {
          ...E2E_STAFF,
          name: "E2E Owner",
          roleKeys: ["owner"],
          actorId: null,
          via: "e2e",
        }),
      );
    }
  } finally {
    await db.$disconnect();
  }
}
