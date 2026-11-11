import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { ActionForm } from "@/components/admin/action-form";
import { AdminSelect } from "@/components/admin/fields";
import { adminInput, Badge, Empty, FilterField, PageHeader, Panel } from "@/components/admin/ui";
import { gccCountries, prospectTypeNames, prospectTypes } from "@/lib/prospect-score";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { RuleError } from "@/server/errors";
import { areaFromAddress, placesConfigured, searchPlaces, type PlaceResult } from "@/server/marketing/places";
import { createProspectAction } from "../actions";

export const metadata: Metadata = { title: "Find businesses" };

const query = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  country: z.enum(Object.keys(gccCountries) as [string, ...string[]]).catch("BH"),
});

const suggestions = [
  "interior design studio",
  "architecture firm",
  "real estate developer",
  "construction company",
  "fit-out contractor",
  "property management company",
];

export default async function PlacesPage({ searchParams }: PageProps<"/admin/marketing/places">) {
  const actor = await requireActor("marketing.manage");
  const raw = await searchParams;
  const { q, country } = query.parse({ q: raw.q, country: raw.country ?? "BH" });
  const configured = placesConfigured();
  let results: PlaceResult[] | null = null;
  let error: string | null = null;
  if (configured && q) {
    try {
      results = await searchPlaces(db, actor, { query: q, country });
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
      error = e.message;
    }
  }

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/marketing" className="underline underline-offset-4">
          ← Prospects
        </Link>
      </p>
      <PageHeader
        title="Find businesses"
        description="Search Google's business listings for designers, architects, developers and contractors, and add the ones that fit. Only the name, area and Google's place id are kept; add their contact details from their own website."
      />
      {!configured ? (
        <Panel>
          <p className="text-sm">
            <Badge tone="warn">Awaiting credentials</Badge> Google Places isn&apos;t connected yet. It needs a
            Google Cloud project with “Places API (New)” enabled and an API key in Vercel
            (GOOGLE_PLACES_API_KEY). Google charges per search. Until then, add prospects by hand or import a
            spreadsheet.
          </p>
        </Panel>
      ) : (
        <>
          <form method="get" className="mb-5 flex flex-wrap items-end gap-3 border border-line bg-white p-4">
            <FilterField label="Look for">
              <input
                name="q"
                defaultValue={q}
                required
                minLength={3}
                maxLength={100}
                placeholder="e.g. interior design studio"
                className={adminInput}
                list="place-suggestions"
              />
              <datalist id="place-suggestions">
                {suggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </FilterField>
            <FilterField label="Country">
              <select name="country" defaultValue={country} className={adminInput}>
                {Object.entries(gccCountries).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </FilterField>
            <button type="submit" className="min-h-10 bg-charcoal px-4 text-sm font-medium text-ivory">
              Search
            </button>
          </form>
          {error && (
            <p role="alert" className="mb-4 border-s-2 border-red-700 bg-red-50 px-4 py-3 text-sm">
              {error}
            </p>
          )}
          {results && results.length === 0 && <Empty>Nothing found. Try other words.</Empty>}
          {results && results.length > 0 && (
            <ul className="space-y-3">
              {results.map((r) => (
                <li
                  key={r.placeId}
                  className="flex flex-wrap items-end justify-between gap-4 border border-line bg-white p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-sm text-ink-muted">{r.address}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {r.types.join(", ").replace(/_/g, " ")}
                      {r.mapsUrl && (
                        <>
                          {" · "}
                          <a href={r.mapsUrl} target="_blank" rel="noopener noreferrer" className="underline">
                            Open in Google Maps
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  {r.prospectId ? (
                    <Link href={`/admin/marketing/${r.prospectId}`} className="text-sm underline">
                      Already a prospect
                    </Link>
                  ) : (
                    <ActionForm
                      action={createProspectAction}
                      submitLabel="Add as prospect"
                      pendingLabel="Adding…"
                      variant="outline"
                      inline
                    >
                      <input type="hidden" name="companyName" value={r.name.slice(0, 200)} />
                      <input type="hidden" name="placeId" value={r.placeId} />
                      <input type="hidden" name="country" value={country} />
                      <input type="hidden" name="area" value={areaFromAddress(r.address) ?? ""} />
                      <input type="hidden" name="source" value="google_places" />
                      <input
                        type="hidden"
                        name="sourceNote"
                        value={`Google Places search: ${q}`.slice(0, 300)}
                      />
                      <AdminSelect
                        label="Type"
                        name="type"
                        defaultValue="interior_designer"
                        options={prospectTypes.map((t) => ({ value: t, label: prospectTypeNames[t] }))}
                      />
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
