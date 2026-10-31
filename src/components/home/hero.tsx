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

/**
 * Full-height photographic hero. The sticky header is transparent over it (see HeaderShell), so the
 * section pulls up under the header by its height. `text` holds the admin's homepage overrides for
 * this locale; empty values use the built-in copy.
 */
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
    <section
      aria-labelledby="hero-title"
      className="relative -mt-18 flex min-h-svh items-end overflow-hidden bg-espresso text-ivory lg:-mt-20"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static file, already optimised */}
      <img
        src={photo.src}
        alt={photo.alt[locale]}
        width={photo.width}
        height={photo.height}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 size-full object-cover opacity-60"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-espresso/55 via-espresso/25 to-espresso/90"
      />

      <div className="relative container-site pt-32 pb-16 lg:pb-24">
        <p className="flex rise items-center gap-3 eyebrow text-walnut-soft">
          <span aria-hidden className="h-px w-7 bg-oak" />
          {text?.eyebrow ?? t("eyebrow")}
        </p>
        <div className="mt-6 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <h1
            id="hero-title"
            className="max-w-[15ch] rise font-display text-display-2xl text-balance [animation-delay:100ms] rtl:max-w-[18ch]"
          >
            {text?.title ?? t("title")}{" "}
            <em className="text-sand-deep italic rtl:not-italic">{text?.accent ?? t("titleAccent")}</em>
          </h1>
          <div className="max-w-sm shrink-0 lg:pb-3">
            <p className="rise text-base text-ivory/85 [animation-delay:250ms]">
              {text?.intro ?? t("intro")}
            </p>
            <div className="mt-8 flex rise flex-wrap gap-3 [animation-delay:400ms]">
              <Button asChild variant="light">
                <a href="#products">{t("primary")}</a>
              </Button>
              <Button asChild variant="outlineLight">
                <Link href={pathFor("requestQuote")}>{t("secondary")}</Link>
              </Button>
            </div>
          </div>
        </div>

        <dl
          aria-label={t("factsLabel")}
          className="mt-14 grid grid-cols-3 border-t border-ivory/20 pt-6 lg:mt-20 lg:max-w-2xl"
        >
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="flex flex-col-reverse border-s border-ivory/20 ps-4 first:border-s-0 first:ps-0 sm:ps-8"
            >
              <dt className="mt-1 text-xs tracking-wide text-ivory/70 sm:text-sm">{fact.label}</dt>
              <dd className="font-display text-display-md lining-nums tabular-nums" dir="ltr">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div aria-hidden className="absolute end-12 bottom-10 hidden opacity-65 xl:block">
        <span className="block h-14 w-px scroll-drop bg-gradient-to-b from-ivory to-transparent" />
      </div>
    </section>
  );
}
