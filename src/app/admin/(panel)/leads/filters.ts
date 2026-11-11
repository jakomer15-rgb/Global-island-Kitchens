import { z } from "zod";
import type { LeadFilters } from "@/server/crm/leads";
import { followUpFilters, leadSorts, leadSources, leadStatuses } from "@/server/crm/leads";
import { customerTypes } from "@/server/crm/customers";
import { products } from "@/content/products";

/** Values of a lead's product (`category`): the product pages, plus the two wizard-only choices. */
export const productKeys = [...products.map((p) => p.key), "bespoke", "completeProject"];

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  // A real calendar day (2026-02-31 is ignored, not a server error).
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  })
  .optional()
  .catch(undefined);

/** Query-string filters of the leads list, pipeline and export. Anything invalid is ignored. */
export const leadFiltersSchema = z.object({
  status: z
    .enum(leadStatuses as [string, ...string[]])
    .optional()
    .catch(undefined),
  stage: z.enum(["open"]).optional().catch(undefined),
  source: z
    .enum(leadSources as [string, ...string[]])
    .optional()
    .catch(undefined),
  assignedTo: z.string().max(40).optional().catch(undefined),
  temperature: z.enum(["hot", "warm", "cold", "none"]).optional().catch(undefined),
  customerType: z
    .enum(customerTypes as [string, ...string[]])
    .optional()
    .catch(undefined),
  category: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,60}$/)
    .optional()
    .catch(undefined),
  followUp: z.enum(followUpFilters).optional().catch(undefined),
  minScore: z.coerce.number().int().min(0).max(100).optional().catch(undefined),
  from: day,
  to: day,
  q: z.string().max(100).optional().catch(undefined),
  sort: z.enum(leadSorts).optional().catch(undefined),
  page: z.coerce.number().int().positive().max(10_000).optional().catch(undefined),
});

export type LeadQuery = z.infer<typeof leadFiltersSchema>;

export function parseLeadQuery(raw: Record<string, string | string[] | undefined>): LeadQuery {
  return leadFiltersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
}

/** Query → service filters. Dates are Bahrain days (UTC+3); "to" includes the whole day. */
export function toLeadFilters(q: LeadQuery): LeadFilters {
  return {
    ...q,
    minScore: q.minScore === 0 ? undefined : q.minScore,
    from: q.from ? new Date(`${q.from}T00:00:00+03:00`) : undefined,
    to: q.to ? new Date(new Date(`${q.to}T00:00:00+03:00`).getTime() + 86_400_000) : undefined,
  } as LeadFilters;
}

/** The query as URL parameters (empty values left out), e.g. to keep filters on export or paging. */
export function leadQueryParams(
  q: LeadQuery,
  over: Partial<Record<keyof LeadQuery, string | undefined>> = {},
) {
  const merged = { ...q, ...over } as Record<string, unknown>;
  return new URLSearchParams(
    Object.entries(merged)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  );
}
