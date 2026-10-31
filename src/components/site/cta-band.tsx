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
    <section aria-labelledby="cta-title" className="bg-walnut-deep py-20 text-ivory md:py-28">
      <div className="container-site grid items-end gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <span aria-hidden className="mb-8 block h-px w-16 bg-walnut-soft" />
          <h2 id="cta-title" className="font-display text-display-xl text-balance">
            {title ?? t("ctaTitle")}
          </h2>
          <p className="mt-5 max-w-copy text-ivory/75">{body ?? t("ctaBody")}</p>
        </div>
        <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
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
