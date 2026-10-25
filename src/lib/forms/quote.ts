import { z } from "zod";
import { consent, locale, name, optionalEmail, optionalText, phone, spamTraps } from "./common";

/** Step 1 choices: the product pages plus "more we make" and a complete project. */
export const quoteCategories = [
  "woodenKitchens",
  "aluminiumKitchens",
  "wardrobes",
  "walkInClosets",
  "bedroomFurniture",
  "tvUnits",
  "wallCladding",
  "bathroomVanities",
  "bespoke",
  "completeProject",
] as const;

export const boardOptions = ["egger", "mdf", "aluminium", "unsure"] as const;
export const customerTypes = [
  "homeowner",
  "interior_designer",
  "architect",
  "developer",
  "contractor",
  "business",
  "other",
] as const;
export const units = ["cm", "mm", "m"] as const;

/** Largest believable wall in each unit (30 m). */
const maxByUnit = { mm: 30000, cm: 3000, m: 30 } as const;

const dimension = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      ctx.addIssue({ code: "custom", message: "measure" });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

export const wallSchema = z.object({
  label: optionalText(60),
  width: dimension,
  height: dimension,
  depth: dimension,
});

export const MAX_WALLS = 6;
export const MAX_FILES = 8;

export const quoteStepSchemas = {
  category: z.object({ category: z.enum(quoteCategories, { message: "category" }) }),
  measurements: z
    .object({
      unit: z.enum(units),
      walls: z.array(wallSchema).max(MAX_WALLS),
      noMeasurements: z.boolean().default(false),
    })
    .superRefine((v, ctx) => {
      const max = maxByUnit[v.unit];
      v.walls.forEach((w, i) => {
        for (const key of ["width", "height", "depth"] as const) {
          const value = w[key];
          if (value !== undefined && value > max)
            ctx.addIssue({ code: "custom", message: "measure", path: ["walls", i, key] });
        }
      });
      if (!v.noMeasurements && !v.walls.some((w) => w.width !== undefined)) {
        ctx.addIssue({ code: "custom", message: "measureNeeded", path: ["walls", 0, "width"] });
      }
    }),
  materials: z.object({
    boards: z.array(z.enum(boardOptions)).min(1, "boards"),
    finishNotes: optionalText(500),
  }),
  files: z.object({
    files: z
      .array(z.object({ id: z.string().min(10).max(40), ticket: z.string().min(20).max(100) }))
      .max(MAX_FILES, "tooManyFiles"),
  }),
  contact: z.object({
    name,
    phone,
    email: optionalEmail,
    area: optionalText(120),
    customerType: z.enum(customerTypes),
    message: optionalText(2000),
    ...consent,
  }),
};

export const quoteRequestSchema = z
  .object({ ...spamTraps, locale })
  .and(quoteStepSchemas.category)
  .and(quoteStepSchemas.measurements)
  .and(quoteStepSchemas.materials)
  .and(quoteStepSchemas.files)
  .and(quoteStepSchemas.contact);

export type QuoteRequestInput = z.input<typeof quoteRequestSchema>;
export type QuoteRequest = z.output<typeof quoteRequestSchema>;
