import { Check } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CtaBand } from "@/components/site/cta-band";
import { PageHero } from "@/components/site/page-hero";
import { Swatch, type SwatchName } from "@/components/site/swatch";
import { pathFor } from "@/config/routes";
import { materialsPage as c } from "@/content/pages";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/materials">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return pageMetadata({
    title: c.metaTitle[locale],
    description: c.metaDescription[locale],
    path: pathFor("materials"),
    locale,
  });
}

const families: { key: "egger" | "mdf"; swatches: SwatchName[] }[] = [
  { key: "egger", swatches: ["oak", "walnut", "stone", "solid"] },
  { key: "mdf", swatches: ["paintedLight", "paintedDark"] },
];

export default async function MaterialsPage({ params }: PageProps<"/[locale]/materials">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [tm, t] = await Promise.all([
    getTranslations({ locale, namespace: "Materials" }),
    getTranslations({ locale, namespace: "Page" }),
  ]);

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: c.eyebrow[locale], path: pathFor("materials") }]}
        eyebrow={c.eyebrow[locale]}
        title={c.title[locale]}
        intro={c.intro[locale]}
      />

      {families.map((family, fi) => (
        <section
          key={family.key}
          aria-labelledby={`${family.key}-title`}
          className={fi % 2 ? "bg-sand py-20 md:py-28" : "py-20 md:py-28"}
        >
          <div className="container-site grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="eyebrow text-walnut tabular-nums" dir="ltr">
                {String(fi + 1).padStart(2, "0")}
              </p>
              <h2 id={`${family.key}-title`} className="mt-4 font-display text-display-lg">
                {tm(`${family.key}.title`)}
              </h2>
              <p className="mt-5 text-ink-muted">{tm(`${family.key}.body`)}</p>
              <ul className="mt-8 space-y-3">
                {(family.key === "egger" ? c.eggerPoints : c.mdfPoints)[locale].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <Check aria-hidden className="mt-1.5 size-4 shrink-0 text-walnut" strokeWidth={1.75} />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <ul className="grid grid-cols-2 gap-3 lg:col-span-6 lg:col-start-7">
              {family.swatches.map((s) => (
                <li key={s}>
                  <div className="aspect-[4/5] overflow-hidden shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]">
                    <Swatch name={s} />
                  </div>
                  <p className="mt-3 text-sm text-ink-muted">{tm(`swatches.${s}`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <section aria-labelledby="other-title" className="py-20 md:py-28">
        <div className="container-site grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 id="other-title" className="font-display text-display-lg">
              {c.otherTitle[locale]}
            </h2>
            <p className="mt-5 text-ink-muted">{c.otherBody[locale]}</p>
          </div>
          <div className="border-t border-charcoal/20 pt-6 lg:col-span-6 lg:col-start-7">
            <h2 className="font-display text-display-md">{c.rangeTitle[locale]}</h2>
            <p className="mt-4 text-ink-muted">{c.rangeBody[locale]}</p>
            <p className="mt-8 text-xs text-ink-muted">{t("swatchNote")}</p>
          </div>
        </div>
      </section>

      <CtaBand locale={locale} />
    </>
  );
}
