/**
 * Lead score (0–100): how ready a lead looks to buy, from what is known about it. The database keeps
 * the stored score (function `lead_score`, migration 20261111140100_crm_fields); this mirror explains
 * it to staff, part by part. A DB test checks the two agree. No AI is involved: the same facts always
 * give the same score.
 */

export type ScoreInput = {
  status: string;
  temperature: string | null;
  category: string | null;
  requirements: {
    productCategory?: string | null;
    dimensions?: string | null;
    budget?: string | null;
    timeline?: string | null;
    location?: string | null;
  } | null;
  /** From the quotation request, when there is one. */
  measured: boolean;
  area: string | null;
};

export type ScorePart = { key: string; label: string; points: number; max: number };

const filled = (v: string | null | undefined) => Boolean(v && v.trim());

const ratingPoints: Record<string, number> = { hot: 40, warm: 25, cold: 10 };
const stagePoints: Record<string, number> = {
  contacted: 5,
  qualified: 10,
  site_visit: 15,
  measurement: 20,
  quoted: 20,
  negotiation: 25,
};

/** The parts of the score, or null for won and lost leads (they have no score). */
export function leadScoreParts(input: ScoreInput): ScorePart[] | null {
  if (input.status === "won" || input.status === "lost") return null;
  const r = input.requirements ?? {};
  return [
    {
      key: "rating",
      label: "Rating (HOT / WARM / COLD)",
      points: ratingPoints[input.temperature ?? ""] ?? 0,
      max: 40,
    },
    { key: "stage", label: "Pipeline stage", points: stagePoints[input.status] ?? 0, max: 25 },
    {
      key: "product",
      label: "Product known",
      points: filled(input.category) || filled(r.productCategory) ? 5 : 0,
      max: 5,
    },
    {
      key: "dimensions",
      label: "Dimensions known",
      points: filled(r.dimensions) || input.measured ? 10 : 0,
      max: 10,
    },
    { key: "budget", label: "Budget known", points: filled(r.budget) ? 10 : 0, max: 10 },
    { key: "timeline", label: "Timeline known", points: filled(r.timeline) ? 10 : 0, max: 10 },
    {
      key: "location",
      label: "Location known",
      points: filled(r.location) || filled(input.area) ? 5 : 0,
      max: 5,
    },
  ];
}

export function leadScore(input: ScoreInput): number | null {
  const parts = leadScoreParts(input);
  return parts
    ? Math.min(
        100,
        parts.reduce((sum, p) => sum + p.points, 0),
      )
    : null;
}

/** Bands used for colour and filters. */
export function scoreBand(score: number | null): "high" | "medium" | "low" | null {
  if (score === null) return null;
  return score >= 60 ? "high" : score >= 30 ? "medium" : "low";
}
