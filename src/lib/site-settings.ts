import { z } from "zod";
import { company } from "@/config/company";

/**
 * Website settings editable in the admin (no code changes needed). Shared by the server (which
 * stores them) and the UI (which receives them as props). Each key has a schema and a
 * default taken from docs/BUSINESS_FACTS.md via src/config/company.ts.
 */

const phone = z.object({
  display: z.string().trim().min(6).max(30),
  e164: z.string().regex(/^\+[1-9]\d{6,14}$/),
});
const lines = z.array(z.string().trim().min(1).max(120)).min(1).max(5);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();

export const settingSchemas = {
  contact: z.object({
    /** The first number is the main one (header, call buttons). */
    phones: z.tuple([phone], phone).refine((p) => p.length <= 3, "At most three numbers."),
    email: z.string().trim().toLowerCase().email(),
    instagramHandle: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._]{1,30}$/),
    /** International digits, e.g. 97334597636; null hides the WhatsApp button. */
    whatsappNumber: z
      .string()
      .trim()
      .regex(/^[1-9]\d{6,14}$/)
      .nullable(),
  }),
  locations: z.object({
    showroomEn: lines,
    showroomAr: lines,
    headOfficeEn: lines,
    headOfficeAr: lines,
    hoursEn: z.string().trim().min(1).max(80),
    hoursAr: z.string().trim().min(1).max(80),
  }),
  banner: z
    .object({
      enabled: z.boolean(),
      textEn: optionalText(160),
      textAr: optionalText(160),
    })
    .refine((b) => !b.enabled || (b.textEn && b.textAr), {
      message: "Write the banner in English and Arabic before turning it on.",
      path: ["enabled"],
    }),
  homeHero: z.object({
    eyebrowEn: optionalText(80),
    titleEn: optionalText(120),
    accentEn: optionalText(80),
    introEn: optionalText(400),
    eyebrowAr: optionalText(80),
    titleAr: optionalText(120),
    accentAr: optionalText(80),
    introAr: optionalText(400),
  }),
  seo: z.object({
    titleEn: optionalText(60),
    descriptionEn: optionalText(160),
    titleAr: optionalText(60),
    descriptionAr: optionalText(160),
  }),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type Settings = { [K in SettingKey]: z.output<(typeof settingSchemas)[K]> };
export type ContactSettings = Settings["contact"];
export type LocationSettings = Settings["locations"];

export const settingDefaults: Settings = {
  contact: {
    phones: [{ ...company.phones[0] }, ...company.phones.slice(1).map((p) => ({ ...p }))],
    email: company.email,
    instagramHandle: company.instagram.handle,
    whatsappNumber: company.whatsappNumber,
  },
  locations: {
    showroomEn: [...company.showroom.lines],
    showroomAr: [...company.showroom.linesAr],
    headOfficeEn: [...company.headOffice.lines],
    headOfficeAr: [...company.headOffice.linesAr],
    hoursEn: "9:00 AM – 8:00 PM",
    hoursAr: "9:00 صباحًا – 8:00 مساءً",
  },
  // Empty values fall back to the built-in copy (src/messages).
  banner: { enabled: false, textEn: null, textAr: null },
  homeHero: {
    eyebrowEn: null,
    titleEn: null,
    accentEn: null,
    introEn: null,
    eyebrowAr: null,
    titleAr: null,
    accentAr: null,
    introAr: null,
  },
  seo: { titleEn: null, descriptionEn: null, titleAr: null, descriptionAr: null },
};

/** Validates a stored value, falling back to the default if it's missing or invalid. */
export function parseSetting<K extends SettingKey>(key: K, value: unknown): Settings[K] {
  const parsed = settingSchemas[key].safeParse(value);
  return (parsed.success ? parsed.data : settingDefaults[key]) as Settings[K];
}
