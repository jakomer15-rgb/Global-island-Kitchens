import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";

/** Public path of a page in a locale: English unprefixed, Arabic under /ar. */
export function localizedPath(path: string, locale: Locale) {
  if (locale === "en") return path;
  return path === "/" ? "/ar" : `/ar${path}`;
}

/** Title, description, canonical and hreflang for an inner page. The layout adds "| Global Island Kitchens". */
export function pageMetadata({
  title,
  description,
  path,
  locale,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  locale: Locale;
  noindex?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: alternates(path, locale),
    openGraph: { title, description, url: localizedPath(path, locale) },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
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
