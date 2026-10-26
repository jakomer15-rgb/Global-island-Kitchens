import { db } from "@/server/db";
import { myFileUrl } from "@/server/designers/designers";
import { getDesigner } from "@/server/designers/session";
import { NotFoundError, RuleError } from "@/server/errors";
import { getStorage } from "@/server/storage/driver";

const ID = /^[a-z0-9]{20,40}$/;

/** A file on one of the signed-in designer's own projects, through a 60-second signed link. */
export async function GET(request: Request, ctx: RouteContext<"/api/designer/files/[id]">) {
  const designer = await getDesigner();
  if (!designer) return new Response("Sign in required", { status: 401 });
  const { id } = await ctx.params;
  const storage = getStorage();
  if (!ID.test(id) || !storage) return new Response("Not found", { status: 404 });
  try {
    const url = await myFileUrl(db, storage, designer, id);
    return Response.redirect(new URL(url, request.url), 302);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof RuleError) {
      return new Response("Not found", { status: 404 });
    }
    throw error;
  }
}
