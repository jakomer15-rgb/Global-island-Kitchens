import { audit } from "@/server/audit";
import { getActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { db } from "@/server/db";
import { renderQuotationPdf } from "@/server/quotations/pdf";
import { clientIpHash } from "@/server/request";
import { getStorage } from "@/server/storage/driver";

const ID = /^[a-z0-9]{20,40}$/;

/**
 * Quotation PDF for staff with quotation.read. A sent revision's stored PDF (exactly what the
 * customer received) is served through a 60-second signed URL; a draft is rendered as a preview.
 */
export async function GET(request: Request, ctx: RouteContext<"/admin/quotations/[id]/pdf">) {
  const actor = await getActor();
  if (!actor) return new Response("Sign in required", { status: 401 });
  if (!can(actor, "quotation.read")) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const rev = new URL(request.url).searchParams.get("rev");
  if (!ID.test(id) || (rev !== null && !ID.test(rev))) return new Response("Not found", { status: 404 });

  const revision = await db.quotationRevision.findFirst({
    where: { quotationId: id, ...(rev && { id: rev }) },
    orderBy: { revision: "desc" },
    include: { pdf: true, quotation: { select: { number: true } } },
  });
  if (!revision) return new Response("Not found", { status: 404 });

  await audit(db, {
    actorId: actor.id,
    action: "quotation.pdf_viewed",
    entityType: "quotation",
    entityId: id,
    changes: { revision: revision.revision, stored: Boolean(revision.pdf) },
    ipHash: await clientIpHash(),
  });

  const storage = getStorage();
  if (revision.pdf && storage) {
    const url = await storage.downloadUrl(
      revision.pdf.storageKey,
      revision.pdf.originalName,
      "application/pdf",
      60,
    );
    return Response.redirect(new URL(url, request.url), 302);
  }

  const bytes = await renderQuotationPdf(id, revision.id);
  const name = `${revision.quotation.number}-rev${revision.revision}${revision.lockedAt ? "" : "-draft"}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${name}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
