import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { pathFor } from "@/config/routes";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/** Closing call to action: request a quotation (`category` pre-selects the product) or book a consultation. */
export async function CtaBand({
  locale,
  title,
  body,
  category,
}: {
  locale: Locale;
  title?: string;
  body?: string;
  category?: string;
}) {
  const t = await getTranslations({ locale, namespace: "Page" });
  return (
    <section
      aria-labelledby="cta-title"
      className="relative overflow-hidden bg-espresso py-24 text-center text-ivory md:py-36"
    >
      {/* Faint vertical rules, as in a drawing sheet. */}
      <div
        aria-hidden
        className="absolute inset-0 [background-image:repeating-linear-gradient(90deg,var(--color-ivory)_0_1px,transparent_1px_90px)] opacity-[0.07]"
      />
      <div className="relative container-site">
        <h2 id="cta-title" className="mx-auto max-w-3xl font-display text-display-xl text-balance">
          {title ?? t("ctaTitle")}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-ivory/70">{body ?? t("ctaBody")}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" variant="light">
            <Link href={{ pathname: pathFor("requestQuote"), query: category ? { category } : undefined }}>
              {t("requestQuote")} <ArrowRight aria-hidden className="rtl:rotate-180" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outlineLight">
            <Link href={pathFor("bookConsultation")}>{t("bookConsultation")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
