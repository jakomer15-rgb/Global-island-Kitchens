import { db } from "@/server/db";
import { getStorage } from "@/server/storage/driver";

const ID = /^[a-z0-9]{20,40}$/;
const TTL = 60 * 60;

/**
 * Public website images. Only files staff published (with a credit) are served, never customer
 * uploads: those are private and only reachable through the permission-checked admin route.
 * Redirects to a short-lived signed storage URL; the redirect itself is cached for half the TTL.
 */
export async function GET(_request: Request, ctx: RouteContext<"/media/[id]">) {
  const { id } = await ctx.params;
  const storage = getStorage();
  if (!ID.test(id) || !storage) return new Response("Not found", { status: 404 });
  const file = await db.fileAsset.findFirst({
    where: { id, visibility: "public", status: "verified", quotationRequestId: null },
    select: { storageKey: true, originalName: true, mimeType: true },
  });
  if (!file) return new Response("Not found", { status: 404 });
  const url = await storage.downloadUrl(file.storageKey, file.originalName, file.mimeType, TTL);
  return new Response(null, {
    status: 302,
    headers: {
      location: url,
      "cache-control": `public, max-age=${TTL / 2}`,
    },
  });
}
