import { z } from "zod";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { bahrainTime, exportLeadsCsv } from "@/server/chat/admin";
import { leadSources, leadStatuses } from "@/server/crm/leads";
import { db } from "@/server/db";
import { clientIpHash } from "@/server/request";

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  // A real calendar day (2026-02-31 and 2026-13-01 are ignored, not a server error).
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  })
  .optional()
  .catch(undefined);
const query = z.object({
  source: z
    .enum(leadSources as [string, ...string[]])
    .optional()
    .catch(undefined),
  temperature: z.enum(["hot", "warm", "cold"]).optional().catch(undefined),
  status: z
    .enum(leadStatuses as [string, ...string[]])
    .optional()
    .catch(undefined),
  from: day,
  to: day,
});

/** Leads as a CSV file for Excel. Needs lead.read and customer.read (it has contact details). */
export async function GET(request: Request): Promise<Response> {
  const actor = await requireActor("lead.read");
  if (!can(actor, "customer.read")) return new Response("Not allowed", { status: 403 });
  const params = query.parse(Object.fromEntries(new URL(request.url).searchParams));
  // Dates are Bahrain days (UTC+3): "to" includes the whole day.
  const from = params.from ? new Date(`${params.from}T00:00:00+03:00`) : undefined;
  const to = params.to ? new Date(new Date(`${params.to}T00:00:00+03:00`).getTime() + 86_400_000) : undefined;
  const { csv } = await exportLeadsCsv(
    db,
    actor,
    {
      source: params.source as never,
      temperature: params.temperature,
      status: params.status as never,
      from,
      to,
    },
    await clientIpHash(),
  );
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
