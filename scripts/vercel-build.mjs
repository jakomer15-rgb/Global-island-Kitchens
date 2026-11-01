// Vercel runs this instead of `npm run build` (the "vercel-build" script). On production deployments it
// first applies pending migrations and the idempotent seed with the DATABASE_URL Vercel holds, so the
// production database never has to be reached from a local machine. If either step fails, the build
// fails and the current deployment stays live.
import { execSync } from "node:child_process";

const run = (command) => execSync(command, { stdio: "inherit" });

if (process.env.VERCEL_ENV === "production") {
  run("npx prisma migrate deploy");
  run("npx tsx prisma/seed.ts");
}
run("npx next build");
