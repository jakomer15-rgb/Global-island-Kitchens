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

/** Models the owner may pick for the sales chat (Admin → AI agent). Sonnet is the approved default. */
export const chatModels = ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"] as const;
export type ChatModel = (typeof chatModels)[number];

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
    /** The showroom's Google Maps or Google Business Profile link; null uses a search for the address. */
    mapUrl: z
      .string()
      .trim()
      .max(500)
      .regex(/^(https:\/\/.+)?$/, "Enter a full link starting with https://")
      .transform((v) => v || null)
      .nullable()
      .default(null),
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
  /** Quotation documents. VAT stays off until the owner confirms registration (OPEN_QUESTIONS #48). */
  quotation: z
    .object({
      vatEnabled: z.boolean(),
      /** 1000 = 10% (Bahrain's standard rate). */
      vatRateBasisPoints: z.number().int().min(0).max(10_000),
      vatNumber: optionalText(30),
      termsEn: optionalText(4000),
      termsAr: optionalText(4000),
      /** Days a quotation stays valid by default; null means staff choose a date each time. */
      validityDays: z.number().int().min(1).max(365).nullable(),
    })
    .refine((q) => !q.vatEnabled || (q.vatNumber && q.vatRateBasisPoints > 0), {
      message: "Enter the VAT registration number and rate before turning VAT on.",
      path: ["vatEnabled"],
    }),
  /**
   * AI assistants. Off by default; they also need ANTHROPIC_API_KEY on the server. They only write
   * drafts that staff review: nothing is sent to customers or published by an assistant.
   */
  ai: z.object({
    enabled: z.boolean(),
    leadAssistant: z.boolean(),
    contentAssistant: z.boolean(),
    /** Public "furniture assistant" page: visitors type a question that is processed by the AI provider. */
    furnitureAssistant: z.boolean(),
  }),
  /**
   * The "GIK Smart Assistant" sales chat on every public page (Admin → AI agent). Its own switch,
   * separate from the drafting assistants: visitors' chat messages go to the AI provider, which the
   * owner approved on 2026-11-09. Also needs ANTHROPIC_API_KEY on the server.
   */
  chatAgent: z.object({
    enabled: z.boolean(),
    model: z.enum(chatModels).default("claude-sonnet-5-5"),
    /** Extra instructions and personality notes from the owner, added to the built-in rules. */
    instructions: optionalText(4000).default(null),
    /** Replace the built-in welcome message (empty keeps the owner's original text). */
    welcomeEn: optionalText(800).default(null),
    welcomeAr: optionalText(800).default(null),
    /** Ceiling on chat messages answered per day across the whole site (cost control). */
    dailyMessageLimit: z.number().int().min(20).max(20000).default(1500),
    /** Sales team addresses emailed for every chat lead. Empty uses NOTIFY_EMAILS from the server. */
    notifyEmails: z
      .array(z.string().trim().toLowerCase().email("Enter valid email addresses, one per line."))
      .max(10, "At most 10 addresses.")
      .default([]),
    /** Sales team WhatsApp numbers (international digits) for new-lead alerts, once WhatsApp is set up. */
    notifyWhatsApp: z
      .array(
        z
          .string()
          .regex(/^[1-9]\d{6,14}$/, "Enter WhatsApp numbers with the country code, e.g. 97334597636."),
      )
      .max(5, "At most 5 numbers.")
      .default([]),
  }),
  /**
   * Follow-ups to customers who stopped replying (Stage 4, Admin → AI agent). When on, the daily job
   * asks the AI to draft a follow-up for open leads with no contact for `afterDays` days and email
   * consent on record. Drafts wait for approval; nothing is sent automatically. Off by default.
   */
  salesFollowUp: z.object({
    autoDraft: z.boolean().default(false),
    afterDays: z.number().int().min(2).max(60).default(4),
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
    hoursEn: "Saturday to Thursday, 9:00 AM – 8:00 PM. Closed Friday.",
    hoursAr: "من السبت إلى الخميس، 9:00 صباحًا – 8:00 مساءً. الجمعة مغلق.",
    mapUrl: null,
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
  ai: { enabled: false, leadAssistant: true, contentAssistant: true, furnitureAssistant: false },
  chatAgent: {
    enabled: false,
    model: "claude-sonnet-5-5",
    instructions: null,
    welcomeEn: null,
    welcomeAr: null,
    dailyMessageLimit: 1500,
    notifyEmails: [],
    notifyWhatsApp: [],
  },
  salesFollowUp: { autoDraft: false, afterDays: 4 },
  quotation: {
    vatEnabled: false,
    vatRateBasisPoints: 1000,
    vatNumber: null,
    termsEn: null,
    termsAr: null,
    validityDays: null,
  },
};

/** Validates a stored value, falling back to the default if it's missing or invalid. */
export function parseSetting<K extends SettingKey>(key: K, value: unknown): Settings[K] {
  const parsed = settingSchemas[key].safeParse(value);
  return (parsed.success ? parsed.data : settingDefaults[key]) as Settings[K];
}
