import { ArrowDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { company } from "@/config/company";
import { pathFor } from "@/config/routes";
import { photos } from "@/content/photos";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export interface HeroText {
  eyebrow: string | null;
  title: string | null;
  accent: string | null;
  intro: string | null;
}

/** `text` holds the admin's homepage overrides for this locale; empty values use the built-in copy. */
export function Hero({ text }: { text?: HeroText }) {
  const t = useTranslations("Hero");
  const locale = useLocale() as Locale;
  const photo = photos.heroKitchen;
  const inset = photos.walkInCloset;
  const facts = [
    { value: `${company.yearsOfExperience}+`, label: t("facts.years") },
    { value: `${company.projectsShowcased}+`, label: t("facts.projects") },
    { value: String(company.coreProductLines), label: t("facts.lines") },
  ];

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      {/* Sand panel behind the photographs, running to the page edge on wide screens. */}
      <div aria-hidden className="absolute inset-y-0 end-0 hidden w-[36%] bg-sand lg:block" />

      <div className="relative container-site grid min-h-[calc(100svh-4.5rem)] content-center gap-16 py-14 lg:min-h-[calc(100svh-5rem)] lg:grid-cols-12 lg:gap-10 lg:py-20">
        <div className="self-center lg:col-span-6 lg:pe-6">
          <p className="flex rise items-center gap-4 eyebrow text-walnut">
            <span aria-hidden className="h-px w-10 bg-current opacity-60" />
            {text?.eyebrow ?? t("eyebrow")}
          </p>
          <h1 id="hero-title" className="mt-8 font-display text-display-2xl text-balance">
            {text?.title ?? t("title")}{" "}
            <em className="text-walnut italic rtl:not-italic">{text?.accent ?? t("titleAccent")}</em>
          </h1>
          <p className="mt-8 max-w-copy rise text-lg text-ink-muted [animation-delay:150ms]">
            {text?.intro ?? t("intro")}
          </p>
          <div className="mt-10 flex rise flex-wrap gap-3 [animation-delay:300ms]">
            <Button asChild size="lg">
              <a href="#products">
                {t("primary")} <ArrowDown aria-hidden />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={pathFor("requestQuote")}>{t("secondary")}</Link>
            </Button>
          </div>
        </div>

        <div className="relative pb-10 sm:pb-16 lg:col-span-6 lg:pb-0">
          <div className="relative">
            {/* Offset hairline frame in natural oak. */}
            <div
              aria-hidden
              className="absolute inset-0 translate-x-4 translate-y-4 border border-oak/70 md:translate-x-6 md:translate-y-6 rtl:-translate-x-4 md:rtl:-translate-x-6"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- static file, already optimised */}
            <img
              src={photo.src}
              alt={photo.alt[locale]}
              width={photo.width}
              height={photo.height}
              fetchPriority="high"
              decoding="async"
              className="relative aspect-[5/4] w-full bg-sand-deep object-cover shadow-[0_50px_90px_-45px_rgb(26_23_20/0.55)]"
            />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static file, already optimised */}
          <img
            src={inset.src}
            alt={inset.alt[locale]}
            width={inset.width}
            height={inset.height}
            decoding="async"
            className="absolute start-0 -bottom-2 hidden aspect-[4/3] w-[42%] rise border-[6px] border-ivory bg-sand object-cover shadow-[0_30px_60px_-30px_rgb(26_23_20/0.6)] [animation-delay:450ms] sm:block lg:-start-12 lg:-bottom-6"
          />
        </div>

        <dl
          aria-label={t("factsLabel")}
          className="grid grid-cols-3 border-t border-line pt-8 lg:col-span-12"
        >
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="flex flex-col-reverse border-s border-line ps-4 first:border-s-0 first:ps-0 sm:ps-8"
            >
              <dt className="mt-2 text-xs tracking-wide text-ink-muted sm:text-sm">{fact.label}</dt>
              <dd className="font-display text-display-lg lining-nums tabular-nums" dir="ltr">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
