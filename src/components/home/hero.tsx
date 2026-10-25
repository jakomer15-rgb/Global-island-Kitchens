import { ArrowDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Swatch, type SwatchName } from "@/components/site/swatch";
import { company } from "@/config/company";
import { pathFor } from "@/config/routes";
import { Link } from "@/i18n/navigation";

/** Cabinet-front composition for the hero: an illustration of the two board families, not a photo. */
/** Panels tile a 3 × 5 grid exactly, like a run of cabinet doors. */
const elevation: { swatch: SwatchName; className: string }[] = [
  { swatch: "walnut", className: "col-start-1 col-span-2 row-start-1 row-span-2" },
  { swatch: "paintedLight", className: "col-start-3 row-start-1 row-span-3" },
  { swatch: "oak", className: "col-start-1 row-start-3 row-span-2" },
  { swatch: "stone", className: "col-start-2 row-start-3 row-span-2" },
  { swatch: "solid", className: "col-start-3 row-start-4 row-span-2" },
  { swatch: "paintedDark", className: "col-start-1 col-span-2 row-start-5" },
];

export function Hero() {
  const t = useTranslations("Hero");
  const facts = [
    { value: `${company.yearsOfExperience}+`, label: t("facts.years") },
    { value: `${company.projectsShowcased}+`, label: t("facts.projects") },
    { value: String(company.coreProductLines), label: t("facts.lines") },
  ];

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div className="container-site grid min-h-[calc(100svh-4.5rem)] items-center gap-12 py-14 lg:grid-cols-12 lg:gap-10 lg:py-20">
        <div className="lg:col-span-7">
          <p className="eyebrow text-walnut">{t("eyebrow")}</p>
          <h1 id="hero-title" className="mt-8 font-display text-display-2xl text-balance">
            {t("title")} <em className="text-walnut italic rtl:not-italic">{t("titleAccent")}</em>
          </h1>
          <p className="mt-8 max-w-copy text-lg text-ink-muted">{t("intro")}</p>
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
          <div
            aria-hidden
            className="grid aspect-[4/5] grid-cols-3 grid-rows-5 gap-2 bg-sand-deep p-2 shadow-[0_40px_80px_-40px_rgb(35_32_29/0.45)]"
          >
            {elevation.map((panel) => (
              <div key={panel.swatch} className={`relative overflow-hidden ${panel.className}`}>
                <Swatch name={panel.swatch} />
                <span className="absolute end-3 top-1/2 h-10 w-[3px] -translate-y-1/2 rounded-full bg-charcoal/35" />
              </div>
            ))}
          </div>
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
