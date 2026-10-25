import { z } from "zod";
import { db } from "@/server/db";
import { RuleError } from "@/server/errors";
import { json, sameOrigin } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { clientIpHash } from "@/server/request";
import { getStorage } from "@/server/storage/driver";
import { startUpload } from "@/server/storage/files";

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().max(100),
  size: z.number().int(),
});

/**
 * Starts a customer upload: records a pending file and returns a short-lived signed URL the browser
 * uploads to directly, plus a ticket to send with the quotation form.
 */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
  const storage = getStorage();
  if (!storage) return json({ error: "uploadsOff" }, 503);

  const ipHash = await clientIpHash();
  if (!(await rateLimit(db, `upload:${ipHash}`, 30, 60 * 60))) return json({ error: "tooMany" }, 429);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid" }, 400);

  try {
    return json(await startUpload(db, storage, { ...parsed.data, ipHash }), 201);
  } catch (error) {
    if (error instanceof RuleError) return json({ error: error.code }, 400);
    throw error;
  }
}
