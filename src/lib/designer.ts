import { z } from "zod";
import { locale, name, optionalText, phone, spamTraps } from "./forms/common";
import { boardOptions, quoteCategories, quoteStepSchemas, units } from "./forms/quote";

/**
 * Designer portal forms. Error messages are short codes; the portal shows them in the visitor's
 * language from src/content/portal.ts.
 */

export const professions = ["interior_designer", "architect", "contractor", "developer", "other"] as const;
export type Profession = (typeof professions)[number];

export const registerSchema = z.object({ ...spamTraps, locale }).and(
  z.object({
    name,
    company: optionalText(120),
    profession: z.enum(professions, { message: "required" }),
    phone,
    email: z.string().trim().toLowerCase().max(254, "email").email("email"),
    password: z.string().min(12, "passwordShort").max(128, "passwordLong"),
    privacyAccepted: z.literal(true, { message: "privacy" }),
  }),
);
export type RegisterInput = z.input<typeof registerSchema>;
export type Register = z.output<typeof registerSchema>;

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export const MAX_DESIGNER_MATERIALS = 12;

export const designerProjectSchema = z
  .object({ ...spamTraps, locale })
  .and(
    z.object({
      title: z.string().trim().min(2, "required").max(120, "tooLong"),
      category: z.enum(quoteCategories, { message: "category" }),
      clientLabel: optionalText(80),
      area: optionalText(120),
      targetDate: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "date")
        .optional()
        .or(z.literal("").transform(() => undefined)),
      message: optionalText(2000),
      boards: z.array(z.enum(boardOptions)).max(boardOptions.length),
      materialIds: z.array(z.string().min(10).max(40)).max(MAX_DESIGNER_MATERIALS, "tooManyMaterials"),
      finishNotes: optionalText(500),
    }),
  )
  .and(quoteStepSchemas.measurements)
  .and(quoteStepSchemas.files);
export type DesignerProjectInput = z.input<typeof designerProjectSchema>;
export type DesignerProject = z.output<typeof designerProjectSchema>;

export const designerMessageSchema = z.object({
  body: z.string().trim().min(1, "required").max(2000, "tooLong"),
});

export { units };

/** What a designer sees of a project's progress, from the lead and the project behind it. */
export type DesignerProgress =
  | "received"
  | "in_review"
  | "quotation_ready"
  | "approved"
  | "in_production"
  | "installation"
  | "completed"
  | "closed";

export function designerProgress(input: {
  leadStatus: "new" | "contacted" | "qualified" | "quoted" | "won" | "lost";
  projectStage: string | null;
}): DesignerProgress {
  if (input.leadStatus === "lost") return "closed";
  if (input.projectStage === "completion") return "completed";
  if (input.projectStage === "installation") return "installation";
  if (input.projectStage === "production") return "in_production";
  if (input.leadStatus === "won") return "approved";
  if (input.leadStatus === "quoted") return "quotation_ready";
  if (input.leadStatus === "new") return "received";
  return "in_review";
}
