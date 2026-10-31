import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { pathFor } from "@/config/routes";
import { photos } from "@/content/photos";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/** Split section on the deepest ground: photograph edge to edge on one side, the invitation on the other. */
export function Designers() {
  const t = useTranslations("Designers");
  const locale = useLocale() as Locale;
  const photo = photos.alFarisBedroom2;

  return (
    <section aria-labelledby="designers-title" className="bg-espresso text-ivory">
      <div className="grid lg:grid-cols-2">
        <div className="relative min-h-[22rem] lg:min-h-[34rem]">
          {/* eslint-disable-next-line @next/next/no-img-element -- static file, already optimised */}
          <img
            src={photo.src}
            alt={photo.alt[locale]}
            width={photo.width}
            height={photo.height}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full bg-walnut object-cover"
          />
        </div>
        <div className="flex flex-col justify-center px-5 py-20 md:px-10 lg:px-[4.5rem] lg:py-28">
          <p className="flex items-center gap-3 eyebrow text-walnut-soft">
            <span aria-hidden className="h-px w-7 bg-oak" />
            {t("eyebrow")}
          </p>
          <h2 id="designers-title" className="mt-5 max-w-xl font-display text-display-lg text-balance">
            {t("title")}
          </h2>
          <p className="mt-6 max-w-copy text-ivory/75">{t("body")}</p>
          <Button asChild variant="outlineLight" size="lg" className="mt-10 self-start">
            <Link href={pathFor("designers")}>
              {t("cta")} <ArrowRight aria-hidden className="rtl:rotate-180" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
