import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CtaBand } from "@/components/site/cta-band";
import { PageHero } from "@/components/site/page-hero";
import { pathFor } from "@/config/routes";
import { bespokePage as c } from "@/content/pages";
import { moreProducts } from "@/content/products";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/bespoke">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return pageMetadata({
    title: c.metaTitle[locale],
    description: c.metaDescription[locale],
    path: pathFor("bespoke"),
    locale,
  });
}

export default async function BespokePage({ params }: PageProps<"/[locale]/bespoke">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: c.eyebrow[locale], path: pathFor("bespoke") }]}
        eyebrow={c.eyebrow[locale]}
        title={c.title[locale]}
        intro={c.intro[locale]}
      />
      <section className="py-20 md:py-28">
        <ul className="container-site grid gap-x-10 sm:grid-cols-2">
          {moreProducts[locale].map((item, i) => (
            <li key={item} className="flex gap-6 border-t border-charcoal/20 py-8">
              <span className="pt-2 eyebrow text-walnut tabular-nums" dir="ltr">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display text-display-md">{item}</span>
            </li>
          ))}
        </ul>
      </section>
      <CtaBand locale={locale} />
    </>
  );
}
