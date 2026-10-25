import { useTranslations } from "next-intl";

export function SkipLink() {
  const t = useTranslations("Common");
  return (
    <a
      href="#main"
      className="sr-only z-50 bg-charcoal px-4 py-3 text-sm text-ivory focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
    >
      {t("skipToContent")}
    </a>
  );
}
