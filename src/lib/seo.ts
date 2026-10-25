import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";

/** Public path of a page in a locale: English unprefixed, Arabic under /ar. */
export function localizedPath(path: string, locale: Locale) {
  if (locale === "en") return path;
  return path === "/" ? "/ar" : `/ar${path}`;
}

/** Canonical URL plus hreflang alternates for a page that exists in both languages. */
export function alternates(path: string, locale: Locale): Metadata["alternates"] {
  return {
    canonical: localizedPath(path, locale),
    languages: {
      "en-BH": localizedPath(path, "en"),
      "ar-BH": localizedPath(path, "ar"),
      "x-default": localizedPath(path, "en"),
    },
  };
}
