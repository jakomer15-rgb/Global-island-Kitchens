import { redirect } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { json } from "@/server/http";
import { fileDownloadUrl } from "@/server/leads/queries";
import { clientIpHash } from "@/server/request";
import { getStorage } from "@/server/storage/driver";

/** Staff file download: checks the session and file.read, audits, then redirects to a 60-second signed URL. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/admin/files/[id]">,
): Promise<Response> {
  const actor = await requireActor("file.read");
  const storage = getStorage();
  if (!storage) return json({ error: "storageOff" }, 503);
  let url: string;
  try {
    url = await fileDownloadUrl(db, storage, actor, (await params).id, await clientIpHash());
  } catch (error) {
    if (error instanceof NotFoundError) return json({ error: "notFound" }, 404);
    throw error;
  }
  redirect(url);
}
