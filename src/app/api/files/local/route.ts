import { readFile } from "node:fs/promises";
import { env } from "@/server/env";
import { json } from "@/server/http";
import { storageChoice } from "@/server/storage/driver";
import { safeLocalPath, writeLocal } from "@/server/storage/local";
import { verifyToken } from "@/server/storage/token";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads/policy";

/**
 * Local stand-in for presigned object-storage URLs (development and tests only). Uploads (PUT) and
 * downloads (GET) both need a signed, expiring token issued by the storage driver.
 */
function setup() {
  const e = env();
  if (storageChoice(e) !== "local") return null;
  return { root: e.LOCAL_STORAGE_DIR, secret: `${e.BETTER_AUTH_SECRET}:local-storage` };
}

export async function PUT(request: Request): Promise<Response> {
  const s = setup();
  if (!s) return json({ error: "notFound" }, 404);
  const token = verifyToken(new URL(request.url).searchParams.get("token") ?? "", s.secret);
  if (!token || token.op !== "put" || !token.size || token.size > MAX_UPLOAD_BYTES)
    return json({ error: "forbidden" }, 403);
  if (request.headers.get("content-type") !== token.type) return json({ error: "badType" }, 400);

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length !== token.size) return json({ error: "badSize" }, 400);
  try {
    await writeLocal(s.root, token.key, bytes);
  } catch {
    return json({ error: "exists" }, 409);
  }
  return new Response(null, { status: 200 });
}

export async function GET(request: Request): Promise<Response> {
  const s = setup();
  if (!s) return json({ error: "notFound" }, 404);
  const token = verifyToken(new URL(request.url).searchParams.get("token") ?? "", s.secret);
  if (!token || token.op !== "get") return json({ error: "forbidden" }, 403);
  try {
    const bytes = await readFile(safeLocalPath(s.root, token.key));
    return new Response(bytes, {
      headers: {
        "content-type": token.type ?? "application/octet-stream",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(token.name ?? "file")}`,
        "x-content-type-options": "nosniff",
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return json({ error: "notFound" }, 404);
  }
}
