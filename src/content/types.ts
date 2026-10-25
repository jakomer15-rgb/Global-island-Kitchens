import type { Locale } from "@/i18n/routing";

/**
 * Website content, written only from docs/BUSINESS_FACTS.md. English and Arabic sit side by side so
 * tests can check both exist. Arabic is a draft pending fluent review. Moves to the database
 * (editable in the admin) in Phase 4.
 */
export type L = Record<Locale, string>;
export type LList = Record<Locale, string[]>;

export function pick<T>(value: Record<Locale, T>, locale: Locale): T {
  return value[locale];
}
