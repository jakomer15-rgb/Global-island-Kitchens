import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 doesn't load env files itself. Locally DATABASE_URL comes from .env.local (written by
// `npm run db:start`); in CI and production it is a real environment variable.
if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Optional so `prisma generate` works without a database (e.g. during `next build`).
  datasource: { url: process.env.DATABASE_URL },
});
