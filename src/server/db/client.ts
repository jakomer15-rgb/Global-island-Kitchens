import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma over node-postgres. Used by the app singleton (./index.ts), the seed, scripts and DB tests.
 * Sessions run in UTC so timestamps are stored correctly whatever the server's local time zone.
 */
export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) throw new Error("DATABASE_URL is not set. Run `npm run db:start` (see README).");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, options: "-c TimeZone=UTC" }) });
}

export type Db = PrismaClient;
/** A client or an interactive transaction. */
export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
