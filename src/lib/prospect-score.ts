/**
 * Prospect score (0–100) and priority: how relevant a business is to GIK and how reachable it is. Rules
 * only (no AI), so the same facts always give the same score; shown to staff part by part.
 *   Fit: developer 30; construction, commercial contractor, interior designer, architect 25;
 *        property management, renovation contractor 20; homeowner building new 15; other 5.
 *   Location: Bahrain 25; elsewhere in the GCC 10.
 *   Reachable: email 15, phone 10, website 5.
 *   Response: interested 15, contacted 5.
 * Not interested and do-not-contact score 0.
 */

export const prospectTypes = [
  "interior_designer",
  "architect",
  "construction_company",
  "real_estate_developer",
  "property_management",
  "renovation_contractor",
  "commercial_contractor",
  "homeowner_new_build",
  "other",
] as const;
export type ProspectTypeKey = (typeof prospectTypes)[number];

export const prospectTypeNames: Record<ProspectTypeKey, string> = {
  interior_designer: "Interior designer",
  architect: "Architect",
  construction_company: "Construction company",
  real_estate_developer: "Real estate developer",
  property_management: "Property management company",
  renovation_contractor: "Renovation contractor",
  commercial_contractor: "Commercial project contractor",
  homeowner_new_build: "Homeowner building a new property",
  other: "Other",
};

export const gccCountries = {
  BH: "Bahrain",
  SA: "Saudi Arabia",
  AE: "United Arab Emirates",
  KW: "Kuwait",
  QA: "Qatar",
  OM: "Oman",
} as const;
export type CountryCode = keyof typeof gccCountries;

const fit: Record<ProspectTypeKey, number> = {
  real_estate_developer: 30,
  construction_company: 25,
  commercial_contractor: 25,
  interior_designer: 25,
  architect: 25,
  property_management: 20,
  renovation_contractor: 20,
  homeowner_new_build: 15,
  other: 5,
};

export interface ProspectScoreInput {
  type: ProspectTypeKey;
  country: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: string;
}

export function prospectScoreParts(p: ProspectScoreInput) {
  return [
    { key: "fit", label: "Business type", points: fit[p.type] ?? 0, max: 30 },
    {
      key: "location",
      label: "Location",
      points: p.country === "BH" ? 25 : p.country in gccCountries ? 10 : 0,
      max: 25,
    },
    {
      key: "reach",
      label: "Contact details",
      points: (p.email ? 15 : 0) + (p.phone ? 10 : 0) + (p.website ? 5 : 0),
      max: 30,
    },
    {
      key: "response",
      label: "Response",
      points: p.status === "interested" ? 15 : p.status === "contacted" ? 5 : 0,
      max: 15,
    },
  ];
}

export function prospectScore(p: ProspectScoreInput): { score: number; priority: "high" | "medium" | "low" } {
  if (p.status === "not_interested" || p.status === "do_not_contact") return { score: 0, priority: "low" };
  const score = Math.min(
    100,
    prospectScoreParts(p).reduce((s, x) => s + x.points, 0),
  );
  return { score, priority: score >= 60 ? "high" : score >= 35 ? "medium" : "low" };
}
