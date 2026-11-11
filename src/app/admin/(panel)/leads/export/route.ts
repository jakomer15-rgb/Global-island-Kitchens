import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { bahrainTime, exportLeadsCsv } from "@/server/chat/admin";
import { db } from "@/server/db";
import { clientIpHash } from "@/server/request";
import { parseLeadQuery, toLeadFilters } from "../filters";

/**
 * The leads list, with the same filters and order, as a CSV file for Excel. Needs lead.read and
 * customer.read (it has contact details); every export is audited.
 */
export async function GET(request: Request): Promise<Response> {
  const actor = await requireActor("lead.read");
  if (!can(actor, "customer.read")) return new Response("Not allowed", { status: 403 });
  const query = parseLeadQuery(Object.fromEntries(new URL(request.url).searchParams));
  const { page: _page, ...filters } = toLeadFilters(query);
  void _page;
  const { csv } = await exportLeadsCsv(db, actor, filters, await clientIpHash());
  const stamp = bahrainTime(new Date()).slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="gik-leads-${stamp}.csv"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
