import { z } from "zod";
import { gccCountries } from "@/lib/prospect-score";
import { assertCan, type Actor } from "@/server/auth/staff";
import type { Db } from "@/server/db/client";
import { env as readEnv, type Env } from "@/server/env";
import { RuleError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";

/**
 * Google Places (Text Search, Places API New) for finding businesses: "interior design studio",
 * "real estate developer" in Bahrain or another GCC country. Results are shown live; staff choose which
 * to add as prospects, and only the business name, area and Google's place id are kept: phone, email
 * and website are entered by staff from the business's own public information. Off until
 * GOOGLE_PLACES_API_KEY is set. Each search is billed by Google per request.
 */

export const PLACES_FIELDS =
  "places.id,places.displayName,places.formattedAddress,places.types,places.googleMapsUri";

const placesResponse = z.object({
  places: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.object({ text: z.string() }).optional(),
        formattedAddress: z.string().optional(),
        types: z.array(z.string()).optional(),
        googleMapsUri: z.string().optional(),
      }),
    )
    .optional(),
});

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  types: string[];
  mapsUrl: string | null;
  /** Already in the prospect list. */
  prospectId: string | null;
}

export function placesConfigured(e: Pick<Env, "GOOGLE_PLACES_API_KEY"> = readEnv()): boolean {
  return Boolean(e.GOOGLE_PLACES_API_KEY);
}

/** The Text Search request (exported for tests). */
export function placesRequest(apiKey: string, query: string, country: string) {
  return {
    url: "https://places.googleapis.com/v1/places:searchText",
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
        "x-goog-fieldmask": PLACES_FIELDS,
      },
      body: JSON.stringify({
        textQuery: `${query} in ${gccCountries[country as keyof typeof gccCountries]}`,
        regionCode: country,
        languageCode: "en",
        pageSize: 20,
      }),
      signal: AbortSignal.timeout(15_000),
    } satisfies RequestInit,
  };
}

/** The area from an address such as "Building 1, Road 2, Seef, Bahrain" → "Seef". */
export function areaFromAddress(address: string): string | null {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(
      (p) => p && !/^(building|bldg|road|rd|block|blk|flat|office|shop|po box)\b/i.test(p) && !/^\d/.test(p),
    );
  const withoutCountry = parts.filter(
    (p) => !Object.values(gccCountries).some((c) => c.toLowerCase() === p.toLowerCase()),
  );
  return withoutCountry.at(-1)?.slice(0, 120) ?? null;
}

export async function searchPlaces(
  db: Db,
  actor: Actor,
  input: { query: string; country: string },
  options: { env?: Env; fetch?: typeof fetch } = {},
): Promise<PlaceResult[]> {
  assertCan(actor, "marketing.manage");
  const e = options.env ?? readEnv();
  if (!e.GOOGLE_PLACES_API_KEY)
    throw new RuleError(
      "notConfigured",
      "Google Places isn't connected yet (Automation Centre → Integrations).",
    );
  const query = input.query.trim().replace(/\s+/g, " ");
  if (query.length < 3 || query.length > 100)
    throw new RuleError("query", "Describe what to look for (3–100 characters).");
  if (!(input.country in gccCountries)) throw new RuleError("country", "Choose a GCC country.");
  // Each search costs money: at most 30 per person per hour.
  if (!(await rateLimit(db, `places:${actor.id}`, 30, 60 * 60)))
    throw new RuleError("tooMany", "Too many searches. Please wait a while.");
  const { url, init } = placesRequest(e.GOOGLE_PLACES_API_KEY, query, input.country);
  let res: Response;
  try {
    res = await (options.fetch ?? fetch)(url, init);
  } catch {
    throw new RuleError("provider", "Google didn't answer in time. Try again.");
  }
  if (res.status === 400 || res.status === 403)
    throw new RuleError(
      "provider",
      `Google refused the search (${res.status}). Check the API key and that Places API (New) is enabled.`,
    );
  if (!res.ok) throw new RuleError("provider", `Google answered with an error (${res.status}).`);
  const parsed = placesResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new RuleError("provider", "Google answered in an unexpected format.");
  const places = parsed.data.places ?? [];
  const known = await db.prospect.findMany({
    where: { placeId: { in: places.map((p) => p.id) } },
    select: { id: true, placeId: true },
  });
  const byPlace = new Map(known.map((k) => [k.placeId, k.id]));
  return places.map((p) => ({
    placeId: p.id,
    name: p.displayName?.text ?? "(no name)",
    address: p.formattedAddress ?? "",
    types: (p.types ?? []).slice(0, 4),
    mapsUrl:
      p.googleMapsUri &&
      /^https:\/\/(maps\.google\.com|www\.google\.com\/maps|maps\.app\.goo\.gl)/.test(p.googleMapsUri)
        ? p.googleMapsUri
        : null,
    prospectId: byPlace.get(p.id) ?? null,
  }));
}
