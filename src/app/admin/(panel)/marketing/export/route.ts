import { gccCountries, prospectTypeNames } from "@/lib/prospect-score";
import { requireActor } from "@/server/auth/session";
import { bahrainTime, CsvPhone, toCsv } from "@/server/chat/admin";
import { db } from "@/server/db";
import { exportProspects, prospectStatusNames } from "@/server/marketing/prospects";
import { clientIpHash } from "@/server/request";
import { parseProspectFilters } from "../filters";

/** The prospect list (same filters and order) as a CSV file for Excel. Audited. */
export async function GET(request: Request): Promise<Response> {
  const actor = await requireActor("marketing.manage");
  const filters = parseProspectFilters(Object.fromEntries(new URL(request.url).searchParams));
  const rows = await exportProspects(db, actor, { ...filters, page: undefined }, await clientIpHash());
  const csv = toCsv([
    [
      "Company",
      "Type",
      "Contact",
      "Role",
      "Email",
      "Phone",
      "Website",
      "Country",
      "Area",
      "Status",
      "Score",
      "Priority",
      "Last contacted",
      "Opportunity",
      "Notes",
      "Added",
    ],
    ...rows.map((p) => [
      p.companyName,
      prospectTypeNames[p.type],
      p.contactName ?? "",
      p.contactRole ?? "",
      p.email ?? "",
      new CsvPhone(p.phone),
      p.website ?? "",
      gccCountries[p.country as keyof typeof gccCountries] ?? p.country,
      p.area ?? "",
      prospectStatusNames[p.status],
      p.score,
      p.priority,
      p.lastContactedAt ?? "",
      p.opportunity ?? "",
      p.notes ?? "",
      p.createdAt,
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="gik-prospects-${bahrainTime(new Date()).slice(0, 10)}.csv"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
