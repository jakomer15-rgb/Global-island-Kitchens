import type { Metadata } from "next";
import { company } from "@/config/company";
import type { Locale } from "@/i18n/routing";

/** Public path of a page in a locale: English unprefixed, Arabic under /ar. */
export function localizedPath(path: string, locale: Locale) {
  if (locale === "en") return path;
  return path === "/" ? "/ar" : `/ar${path}`;
}

/**
 * The link-preview version of a photo: its 1200x630 JPEG in public/images/og (made by
 * scripts/prepare-social-images.mjs), since not every app shows WebP. Admin uploads are used as they
 * are; without a photo, the branded card.
 */
export function socialImage(src?: string) {
  const name = src?.match(/^\/images\/([\w-]+)\.webp$/)?.[1];
  if (name) return `/images/og/${name}.jpg`;
  return src ?? "/images/og/default.jpg";
}

/** What WhatsApp, Facebook and X show for a link. A page's openGraph replaces the layout's, so it's complete. */
export function socialMetadata({
  title,
  description,
  path,
  locale,
  image,
}: {
  title: string;
  description: string;
  path: string;
  locale: Locale;
  image?: string;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const url = socialImage(image);
  const sized = url.startsWith("/images/og/") ? { width: 1200, height: 630 } : {};
  return {
    openGraph: {
      type: "website",
      siteName: company.shortName,
      locale: locale === "ar" ? "ar_BH" : "en_BH",
      title,
      description,
      url: localizedPath(path, locale),
      images: [{ url, alt: title, ...sized }],
    },
    twitter: { card: "summary_large_image", title, description, images: [url] },
  };
}

/** Title, description, canonical and hreflang for an inner page. The layout adds "| Global Island Kitchens". */
export function pageMetadata({
  title,
  description,
  path,
  locale,
  image,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  locale: Locale;
  /** The page's main photo, for link previews. */
  image?: string;
  noindex?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: alternates(path, locale),
    ...socialMetadata({ title, description, path, locale, image }),
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
