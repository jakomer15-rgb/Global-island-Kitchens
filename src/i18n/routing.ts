import { defineRouting } from "next-intl/routing";

/**
 * English is unprefixed (/), Arabic lives under /ar. No automatic language detection and no
 * locale cookie: visitors choose with the language switcher, so nothing is stored in the browser.
 */
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
  // hreflang alternates are emitted per page in metadata.
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];

export const localeDirection: Record<Locale, "ltr" | "rtl"> = { en: "ltr", ar: "rtl" };

export const htmlLang: Record<Locale, string> = { en: "en-BH", ar: "ar-BH" };
