import "server-only";
import { createPrismaClient, type Db } from "./client";

const globalForDb = globalThis as unknown as { gikDb?: Db };

/**
 * App-wide Prisma client, created on first use (not on import) so `next build` never needs a
 * database. Reused across hot reloads in development.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, property) {
    globalForDb.gikDb ??= createPrismaClient();
    return Reflect.get(globalForDb.gikDb, property, globalForDb.gikDb);
  },
});
