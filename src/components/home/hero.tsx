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

/** 	ext holds the admin's homepage overrides for this locale; empty values use the built-in copy. */
export function Hero({ text }: { text?: HeroText }) {
  const t = useTranslations("Hero");
  const locale = useLocale() as Locale;
  const photo = photos.heroKitchen;
  const facts = [
    { value: `${company.yearsOfExperience}+`, label: t("facts.years") },
    { value: `${company.projectsShowcased}+`, label: t("facts.projects") },
    { value: String(company.coreProductLines), label: t("facts.lines") },
  ];

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div className="container-site grid min-h-[calc(100svh-4.5rem)] items-center gap-12 py-14 lg:grid-cols-12 lg:gap-10 lg:py-20">
        <div className="lg:col-span-7">
          <p className="eyebrow text-walnut">{text?.eyebrow ?? t("eyebrow")}</p>
          <h1 id="hero-title" className="mt-8 font-display text-display-2xl text-balance">
            {text?.title ?? t("title")}{" "}
            <em className="text-walnut italic rtl:not-italic">{text?.accent ?? t("titleAccent")}</em>
          </h1>
          <p className="mt-8 max-w-copy text-lg text-ink-muted">{text?.intro ?? t("intro")}</p>
          <div className="mt-10 flex flex-wrap gap-3">
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

        <div className="relative lg:col-span-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- static file, already optimised */}
          <img
            src={photo.src}
            alt={photo.alt[locale]}
            width={photo.width}
            height={photo.height}
            fetchPriority="high"
            decoding="async"
            className="aspect-[5/4] w-full bg-sand-deep object-cover shadow-[0_40px_80px_-40px_rgb(35_32_29/0.45)]"
          />
        </div>

        <dl
          aria-label={t("factsLabel")}
          className="grid grid-cols-3 gap-6 border-t border-line pt-8 lg:col-span-12"
        >
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-col-reverse">
              <dt className="mt-1 text-sm text-ink-muted">{fact.label}</dt>
              <dd className="font-display text-display-md tabular-nums" dir="ltr">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
