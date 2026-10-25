// Local PostgreSQL 17 for development and tests, using the `embedded-postgres` binaries.
// No admin rights or system install needed; data lives in .data/pg-fresh (gitignored).
//
//   npm run db:start   start Postgres. First run creates the cluster with a random password, writes
//                      DATABASE_URL / DATABASE_URL_TEST and a local BETTER_AUTH_SECRET to .env.local,
//                      and creates both databases.
//   Ctrl+C             stop it (data is kept)
//
// Production uses managed Postgres (Neon); this script is never used there.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const root = process.cwd();
const dataDir = path.join(root, ".data", "pg-fresh");
const envFile = path.join(root, ".env.local");
const PORT = Number(process.env.GIK_DB_PORT ?? 5434);
const USER = "gik";
const DATABASES = { DATABASE_URL: "gik_dev", DATABASE_URL_TEST: "gik_test" };

function readEnv() {
  if (!existsSync(envFile)) return {};
  return Object.fromEntries(
    readFileSync(envFile, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

/** Sets keys in .env.local, replacing existing lines and keeping everything else. */
function writeEnv(values) {
  const lines = existsSync(envFile) ? readFileSync(envFile, "utf8").replace(/\s+$/, "").split(/\r?\n/) : [];
  for (const [key, value] of Object.entries(values)) {
    const i = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (i >= 0) lines[i] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  writeFileSync(envFile, lines.join("\n").replace(/\n*$/, "\n"));
}

const url = (password, database) => `postgresql://${USER}:${password}@localhost:${PORT}/${database}`;

const firstRun = !existsSync(dataDir);
const env = readEnv();
const existingPassword = env.DATABASE_URL ? new URL(env.DATABASE_URL).password : null;
if (!firstRun && !existingPassword) {
  console.error("✖ .data/pg-fresh exists but DATABASE_URL is missing from .env.local.");
  console.error("  Restore the line, or delete .data/pg-fresh to start over (this deletes local data).");
  process.exit(1);
}
const password = firstRun ? randomBytes(18).toString("base64url") : existingPassword;

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: USER,
  password,
  port: PORT,
  persistent: true,
  // UTF-8 regardless of the Windows locale (otherwise initdb may pick a code page that can't store Arabic).
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: (message) => process.stderr.write(String(message)),
});

if (firstRun) {
  console.log("Creating a local PostgreSQL cluster in .data/pg-fresh ...");
  await pg.initialise();
}
await pg.start();

for (const [key, database] of Object.entries(DATABASES)) {
  try {
    await pg.createDatabase(database);
    console.log(`Created database ${database}`);
  } catch (error) {
    if (!/already exists/i.test(String(error?.message ?? error))) throw error;
  }
  if (firstRun || !env[key]) writeEnv({ [key]: url(password, database) });
}

// Local secrets (production sets its own in the hosting environment).
if (!env.BETTER_AUTH_SECRET) {
  writeEnv({
    BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"),
    BETTER_AUTH_URL: "http://localhost:3000",
  });
}
if (!env.IP_HASH_SECRET) writeEnv({ IP_HASH_SECRET: randomBytes(32).toString("base64url") });

console.log(`PostgreSQL is running on localhost:${PORT}. Press Ctrl+C to stop.`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  console.log("PostgreSQL stopped.");
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
// Keep the process alive while Postgres runs.
setInterval(() => {}, 1 << 30);
