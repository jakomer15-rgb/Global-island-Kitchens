import { useLocale, useTranslations } from "next-intl";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { photos } from "@/content/photos";
import type { Locale } from "@/i18n/routing";

const keys = ["experience", "factory", "scale", "custom"] as const;

export function Why() {
  const t = useTranslations("Why");
  const locale = useLocale() as Locale;
  const photo = photos.panelSaw;

  return (
    <section aria-labelledby="why-title" className="py-24 md:py-32">
      <div className="container-site grid gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <SectionHeading index="03" id="why-title" eyebrow={t("eyebrow")} title={t("title")} />
          <Reveal className="mt-12">
            {/* eslint-disable-next-line @next/next/no-img-element -- static file, already optimised */}
            <img
              src={photo.src}
              alt={photo.alt[locale]}
              width={photo.width}
              height={photo.height}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full bg-sand object-cover grayscale-[30%] sepia-[15%]"
            />
          </Reveal>
        </div>
        <dl className="grid content-start gap-px border border-line bg-line sm:grid-cols-2 lg:col-span-6 lg:col-start-7">
          {keys.map((key, i) => (
            <Reveal key={key} className="bg-ivory p-8 transition-colors duration-300 hover:bg-sand md:p-10">
              <dt className="font-display text-display-md">
                <span
                  aria-hidden
                  className="mb-6 block text-sm tracking-[0.14em] text-walnut tabular-nums"
                  dir="ltr"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {t(`items.${key}.title`)}
              </dt>
              <dd className="mt-3 text-sm text-ink-muted">{t(`items.${key}.body`)}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
