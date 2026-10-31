"use client";

import { useLocale, useTranslations } from "next-intl";
import { getPathname, usePathname } from "@/i18n/navigation";

/**
 * Links to the same page in the other language. A plain link (full page load) rather than a
 * client transition: the document's lang and dir change, and English gets its canonical
 * unprefixed URL instead of /en.
 */
export function LanguageSwitcher() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const pathname = usePathname();
  const target = locale === "ar" ? "en" : "ar";

  return (
    <a
      href={getPathname({ href: pathname, locale: target })}
      hrefLang={target}
      lang={target}
      aria-label={t("languageLabel")}
      className="inline-flex min-h-11 items-center px-3 text-sm opacity-85 transition-opacity hover:opacity-100"
    >
      {t("language")}
    </a>
  );
}
