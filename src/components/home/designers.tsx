import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { pathFor } from "@/config/routes";
import { photos } from "@/content/photos";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export function Designers() {
  const t = useTranslations("Designers");
  const locale = useLocale() as Locale;
  const photo = photos.alFarisBedroom2;

  return (
    <section aria-labelledby="designers-title" className="bg-walnut-deep text-ivory">
      <div className="container-site grid items-center gap-12 py-20 md:py-28 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6">
          <p className="flex items-center gap-4 eyebrow text-walnut-soft">
            <span aria-hidden className="h-px w-10 bg-current opacity-60" />
            {t("eyebrow")}
          </p>
          <h2 id="designers-title" className="mt-6 font-display text-display-lg text-balance">
            {t("title")}
          </h2>
          <p className="mt-6 max-w-copy text-ivory/80">{t("body")}</p>
          <Button asChild variant="light" size="lg" className="mt-10">
            <Link href={pathFor("designers")}>
              {t("cta")} <ArrowRight aria-hidden className="rtl:rotate-180" />
            </Link>
          </Button>
        </div>
        <div className="relative lg:col-span-6">
          <div
            aria-hidden
            className="absolute inset-0 -translate-x-4 -translate-y-4 border border-walnut-soft/40 rtl:translate-x-4"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- static file, already optimised */}
          <img
            src={photo.src}
            alt={photo.alt[locale]}
            width={photo.width}
            height={photo.height}
            loading="lazy"
            decoding="async"
            className="relative aspect-[16/9] w-full bg-walnut object-cover"
          />
        </div>
      </div>
    </section>
  );
}
