import { z } from "zod";
import { normalisePhone } from "@/lib/phone";

/**
 * Shared field rules for the public forms. Messages are keys under `Forms.errors` in
 * src/messages/*.json, so the browser shows them in the visitor's language.
 */

export const text = (max: number) => z.string().trim().max(max, "tooLong");
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .optional()
    .transform((v) => v || undefined);

export const name = z.string().trim().min(2, "name").max(100, "tooLong");

export const phone = z
  .string()
  .trim()
  .min(1, "required")
  .max(30, "phone")
  .transform((v, ctx) => {
    const e164 = normalisePhone(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "phone" });
      return z.NEVER;
    }
    return e164;
  });

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "email")
  .optional()
  .transform((v) => v || undefined)
  .pipe(z.string().email("email").optional());

/** Optional marketing consent per channel (unticked by default); the privacy notice is acknowledged separately. */
export const consent = {
  consentEmail: z.boolean().default(false),
  consentWhatsapp: z.boolean().default(false),
  privacyAccepted: z.literal(true, { message: "privacy" }),
};

/** Spam traps: a hidden field real visitors never fill, and the time the form was opened. */
export const spamTraps = {
  website: z.string().max(0).optional().or(z.literal("")),
  startedAt: z.coerce.number().int().positive(),
};

export const locale = z.enum(["en", "ar"]);

/** Minimum time a human needs to fill a form; faster submissions are treated as bots. */
export const MIN_FILL_MS = 3000;

export function looksLikeBot(input: { website?: string; startedAt: number }, now = Date.now()) {
  return Boolean(input.website) || now - input.startedAt < MIN_FILL_MS || input.startedAt > now + 60_000;
}
