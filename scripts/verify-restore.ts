// Sanity check of a restored database (after pg_restore, in a restore rehearsal or a real recovery).
//   DATABASE_URL=<restored db> npm run restore:verify
// Read-only. Confirms that data, the migration history and the database rules (triggers, sequences)
// all came back, and prints row counts to compare with what you expect.
import { existsSync, readdirSync } from "node:fs";
import { createPrismaClient } from "../src/server/db/client";

if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

const tables = [
  "users",
  "customers",
  "leads",
  "lead_activities",
  "quotations",
  "quotation_revisions",
  "projects",
  "file_assets",
  "audit_logs",
  "site_settings",
  "designer_accounts",
  "ai_drafts",
];
const triggers = [
  "audit_logs_append_only",
  "consent_records_append_only",
  "quotation_revisions_locked",
  "quotation_line_items_locked",
  "project_stage_changes_append_only",
  "designer_messages_append_only",
  "protect_decided_ai_draft",
  "designer_no_staff_roles",
];
const sequences = [
  "enquiry_reference_seq",
  "quotation_number_seq",
  "order_number_seq",
  "project_reference_seq",
];

const db = createPrismaClient();
let failed = false;
const fail = (message: string) => {
  failed = true;
  console.log(`[ FAIL ] ${message}`);
};

try {
  for (const table of tables) {
    try {
      const [row] = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${table}"`);
      console.log(`[  ok  ] ${table}: ${row?.n ?? 0} rows`);
    } catch {
      fail(`table ${table} is missing`);
    }
  }
  const expected = readdirSync("prisma/migrations", { withFileTypes: true }).filter((d) =>
    d.isDirectory(),
  ).length;
  const [applied] = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  if (Number(applied?.n) === expected) console.log(`[  ok  ] migration history: ${expected} applied`);
  else fail(`migration history has ${applied?.n} applied, this version expects ${expected}`);

  const found = await db.$queryRaw<
    { tgname: string }[]
  >`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal`;
  for (const name of triggers)
    if (found.some((t) => t.tgname === name)) console.log(`[  ok  ] trigger ${name}`);
    else fail(`trigger ${name} did not come back`);
  const seqs = await db.$queryRaw<{ sequencename: string }[]>`SELECT sequencename FROM pg_sequences`;
  for (const name of sequences)
    if (seqs.some((s) => s.sequencename === name)) console.log(`[  ok  ] sequence ${name}`);
    else fail(`sequence ${name} did not come back`);
  const [owners] = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "user_roles" ur JOIN "roles" r ON r.id = ur.role_id WHERE r.key = 'owner'`;
  if (Number(owners?.n) >= 1) console.log("[  ok  ] an owner account exists");
  else fail("no owner account in the restored data");
} finally {
  await db.$disconnect();
}
console.log(failed ? "\nRestore check FAILED." : "\nRestore check passed.");
process.exit(failed ? 1 : 0);
