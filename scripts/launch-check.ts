// Go / no-go check for a production deploy.
//   npm run launch:check            reads the environment (and .env.local if DATABASE_URL is missing)
// Exit code 1 when anything fails. Run it on the production environment before the first deploy and
// after every change to variables or migrations. It never changes anything.
import { existsSync, readdirSync } from "node:fs";
import { allPermissions } from "../src/server/auth/permissions";
import { createPrismaClient } from "../src/server/db/client";
import {
  checkDatabase,
  checkEnvironment,
  hasFailures,
  type DatabaseFacts,
  type Finding,
} from "../src/server/launch-check";

if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

async function databaseFacts(): Promise<DatabaseFacts> {
  const expected = readdirSync("prisma/migrations", { withFileTypes: true }).filter((d) =>
    d.isDirectory(),
  ).length;
  const base: DatabaseFacts = {
    reachable: false,
    migrationsApplied: 0,
    migrationsExpected: expected,
    permissions: 0,
    permissionsExpected: allPermissions.length,
    activeOwners: 0,
    activeStaff: 0,
    contactWhatsapp: false,
    quotationTerms: false,
    publishedMaterials: 0,
    aiEnabled: false,
    aiKeySet: Boolean(process.env.ANTHROPIC_API_KEY),
  };
  if (!process.env.DATABASE_URL) return base;
  const db = createPrismaClient();
  try {
    await db.$queryRaw`SELECT 1`;
    const [migrations] = await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    const settings = Object.fromEntries(
      (await db.siteSetting.findMany()).map((s) => [s.key, s.value as Record<string, unknown>]),
    );
    return {
      ...base,
      reachable: true,
      migrationsApplied: Number(migrations?.n ?? 0),
      permissions: await db.permission.count(),
      activeOwners: await db.user.count({
        where: { kind: "staff", status: "active", roles: { some: { role: { key: "owner" } } } },
      }),
      activeStaff: await db.user.count({ where: { kind: "staff", status: "active", roles: { some: {} } } }),
      contactWhatsapp: Boolean((settings.contact as { whatsappNumber?: string } | undefined)?.whatsappNumber),
      quotationTerms: Boolean(
        (settings.quotation as { termsEn?: string; termsAr?: string } | undefined)?.termsEn ||
        (settings.quotation as { termsAr?: string } | undefined)?.termsAr,
      ),
      publishedMaterials: await db.material.count({ where: { published: true, verifiedAt: { not: null } } }),
      aiEnabled: Boolean((settings.ai as { enabled?: boolean } | undefined)?.enabled),
    };
  } catch {
    return base;
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

const icon = { ok: "  ok  ", warn: " warn ", fail: " FAIL " } as const;
const print = (findings: Finding[]) => {
  for (const f of findings) console.log(`[${icon[f.level]}] ${f.area}: ${f.message}`);
};

const findings = [...checkEnvironment(process.env), ...checkDatabase(await databaseFacts())];
print(findings);
const fails = findings.filter((f) => f.level === "fail").length;
const warns = findings.filter((f) => f.level === "warn").length;
console.log(`\n${fails} failure(s), ${warns} warning(s).`);
if (hasFailures(findings)) {
  console.log("Not ready to launch. Fix the failures above.");
  process.exit(1);
}
console.log(warns ? "Ready, with warnings: decide whether each one can wait." : "Ready to launch.");
