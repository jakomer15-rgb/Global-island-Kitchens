import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CtaBand } from "@/components/site/cta-band";
import { PageHero } from "@/components/site/page-hero";
import { ProjectCard } from "@/components/site/project-card";
import { projectsWithScope, type Project } from "@/content/projects";
import { Swatch, type SwatchName } from "@/components/site/swatch";
import { pathFor } from "@/config/routes";
import { materialsPage } from "@/content/pages";
import { getProduct, type ProductKey } from "@/content/products";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

const stageKeys = [
  "inquiry",
  "measurement",
  "design",
  "quotation",
  "approval",
  "production",
  "installation",
  "completion",
] as const;

const familySwatches: Record<"egger" | "mdf", SwatchName[]> = {
  egger: ["oak", "walnut", "stone", "solid"],
  mdf: ["paintedLight", "paintedDark"],
};

export function productMetadata(key: ProductKey, locale: Locale): Metadata {
  const p = getProduct(key);
  return pageMetadata({
    title: p.metaTitle[locale],
    description: p.metaDescription[locale],
    path: pathFor(key),
    locale,
  });
}

export async function ProductPage({
  productKey,
  locale,
  portfolio,
}: {
  productKey: ProductKey;
  locale: Locale;
  /** The published portfolio (from the page), for related projects. */
  portfolio: Project[];
}) {
  setRequestLocale(locale);
  const p = getProduct(productKey);
  const [t, tm, tp] = await Promise.all([
    getTranslations({ locale, namespace: "Page" }),
    getTranslations({ locale, namespace: "Materials" }),
    getTranslations({ locale, namespace: "Process" }),
  ]);
  const related = projectsWithScope(p.scope, portfolio).slice(0, 6);
  const familyLabel = {
    egger: t("materialsEgger"),
    mdf: t("materialsMdf"),
    aluminium: t("materialsAluminium"),
  };

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: p.name[locale], path: pathFor(productKey) }]}
        eyebrow={t("makes")}
        title={p.name[locale]}
        intro={p.intro[locale]}
      />

      <section aria-labelledby="makes-title" className="py-20 md:py-28">
        <div className="container-site grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 id="makes-title" className="font-display text-display-lg">
              {t("makes")}
            </h2>
            <ul className="mt-8 space-y-4">
              {p.makes[locale].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check aria-hidden className="mt-1.5 size-4 shrink-0 text-walnut" strokeWidth={1.75} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <h2 className="font-display text-display-lg">{t("materials")}</h2>
            <div className="mt-8 space-y-10">
              {p.materials.map((family) => (
                <div key={family}>
                  {family !== "aluminium" && (
                    <ul className="grid grid-cols-4 gap-2">
                      {familySwatches[family].map((s) => (
                        <li key={s} className="aspect-square overflow-hidden" title={tm(`swatches.${s}`)}>
                          <Swatch name={s} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <h3 className="mt-4 font-display text-display-md">{familyLabel[family]}</h3>
                  <p className="mt-2 text-ink-muted">
                    {family === "aluminium" ? materialsPage.otherBody[locale] : tm(`${family}.body`)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-xs text-ink-muted">{t("swatchNote")}</p>
            <Link
              href={pathFor("materials")}
              className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline decoration-walnut/50 underline-offset-[6px] hover:decoration-walnut"
            >
              {t("materialsLink")} <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="process-title" className="bg-sand py-20 md:py-28">
        <div className="container-site">
          <h2 id="process-title" className="font-display text-display-lg">
            {t("process")}
          </h2>
          <ol className="mt-12 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {stageKeys.map((step, i) => (
              <li key={step} className="border-t border-charcoal/20 pt-5">
                <span className="eyebrow text-walnut tabular-nums" dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 font-display text-2xl">{tp(`steps.${step}.title`)}</h3>
                <p className="mt-1 text-sm text-ink-muted">{tp(`steps.${step}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="py-20 md:py-28">
          <div className="container-site">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <h2 id="related-title" className="font-display text-display-lg">
                  {t("related")}
                </h2>
                <p className="mt-3 text-ink-muted">{t("relatedIntro")}</p>
              </div>
              <Link
                href={pathFor("projects")}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium underline decoration-walnut/50 underline-offset-[6px] hover:decoration-walnut"
              >
                {t("allProjects")} <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
              </Link>
            </div>
            <ul className="mt-10 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((project) => (
                <li key={project.slug}>
                  <ProjectCard project={project} locale={locale} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand locale={locale} category={productKey} />
    </>
  );
}
