// Delivers due outbox events once (local development; production uses /api/cron/outbox).
//   npm run outbox:run
import { existsSync } from "node:fs";
import { createPrismaClient } from "../src/server/db/client";
import { processOutbox } from "../src/server/outbox/worker";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const db = createPrismaClient();
processOutbox(db)
  .then((r) =>
    console.log(`Outbox: ${r.claimed} claimed, ${r.done} done, ${r.retried} retrying, ${r.failed} failed.`),
  )
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
