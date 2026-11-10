import { z } from "zod";
import { requireActor } from "@/server/auth/session";
import { bahrainTime, CsvPhone, toCsv } from "@/server/chat/admin";
import { customerSorts, customerTypes, exportCustomers } from "@/server/crm/customers";
import { db } from "@/server/db";
import { clientIpHash } from "@/server/request";

const query = z.object({
  q: z.string().max(100).optional().catch(undefined),
  type: z
    .enum(customerTypes as [string, ...string[]])
    .optional()
    .catch(undefined),
  sort: z.enum(customerSorts).optional().catch(undefined),
});

const words = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const yesNo = (v: boolean | null) => (v === null ? "not given" : v ? "yes" : "no");

/** Customers (same filters as the list) as a CSV file for Excel. Audited: it holds contact details. */
export async function GET(request: Request): Promise<Response> {
  const actor = await requireActor("customer.read");
  const filters = query.parse(Object.fromEntries(new URL(request.url).searchParams));
  const customers = await exportCustomers(db, actor, filters as never, await clientIpHash());
  const header = [
    "Name",
    "Company",
    "Type",
    "Phone",
    "Email",
    "Location",
    "Language",
    "Leads",
    "Email consent",
    "WhatsApp consent",
    "Customer since",
    "Notes",
  ];
  const rows = customers.map((c) => [
    c.name,
    c.company ?? "",
    words(c.type),
    new CsvPhone(c.phone),
    c.email ?? "",
    c.location ?? "",
    c.preferredLanguage === "ar" ? "Arabic" : "English",
    c._count.leads,
    yesNo(c.consentEmail),
    yesNo(c.consentWhatsapp),
    c.createdAt,
    c.notes ?? "",
  ]);
  const stamp = bahrainTime(new Date()).slice(0, 10);
  return new Response(toCsv([header, ...rows]), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="gik-customers-${stamp}.csv"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
