import { z } from "zod";
import type { Tone } from "@/components/admin/ui";
import { gccCountries, prospectTypes } from "@/lib/prospect-score";
import type { ProspectFilters } from "@/server/marketing/prospects";

export const priorityTone: Record<string, Tone> = { high: "good", medium: "warn", low: "neutral" };
export const prospectStatusTone: Record<string, Tone> = {
  new: "info",
  contacted: "neutral",
  interested: "good",
  not_interested: "neutral",
  converted: "good",
  do_not_contact: "bad",
};

export const prospectFiltersSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  type: z.enum(prospectTypes).optional().catch(undefined),
  country: z
    .enum(Object.keys(gccCountries) as [string, ...string[]])
    .optional()
    .catch(undefined),
  status: z
    .enum(["new", "contacted", "interested", "not_interested", "converted", "do_not_contact"])
    .optional()
    .catch(undefined),
  priority: z.enum(["high", "medium", "low"]).optional().catch(undefined),
  source: z
    .enum(["manual", "import", "google_places", "referral", "event", "other"])
    .optional()
    .catch(undefined),
  assignedTo: z.string().max(40).optional().catch(undefined),
  sort: z.enum(["score", "newest", "name", "last_contacted"]).optional().catch(undefined),
  page: z.coerce.number().int().positive().max(10_000).optional().catch(undefined),
});

export function parseProspectFilters(raw: Record<string, string | string[] | undefined>): ProspectFilters {
  return prospectFiltersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  ) as ProspectFilters;
}

export function filterParams(
  f: ProspectFilters,
  over: Partial<Record<keyof ProspectFilters, string | undefined>> = {},
) {
  return new URLSearchParams(
    Object.entries({ ...f, ...over })
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  );
}
