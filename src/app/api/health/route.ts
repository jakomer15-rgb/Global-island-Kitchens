import { db } from "@/server/db";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";

/** For uptime monitors: 200 when the app can reach its database, 503 otherwise. Reveals nothing else. */
export async function GET(): Promise<Response> {
  try {
    await db.$queryRaw`SELECT 1`;
    return json({ status: "ok" });
  } catch {
    return json({ status: "unavailable" }, 503);
  }
}
