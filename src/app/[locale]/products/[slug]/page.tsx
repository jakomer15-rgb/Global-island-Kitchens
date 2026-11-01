import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogItems } from "@/components/site/catalog-items";
import { CtaBand } from "@/components/site/cta-band";
import { PageHero } from "@/components/site/page-hero";
import { routing, type Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { getCatalog, getProductCategory } from "@/server/content/catalog";

/**
 * A product category added in the admin (Manage categories): its name, description, image and the
 * products staff put in it. The built-in product lines keep their own pages.
 */
export async function generateStaticParams() {
  const { products } = await getCatalog();
  return routing.locales.flatMap((locale) =>
    products.filter((c) => !c.pageKey).map((c) => ({ locale, slug: c.slug })),
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/products/[slug]">): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = raw as Locale;
  const category = await getProductCategory(slug);
  if (!category) return {};
  return pageMetadata({
    title: category.name[locale],
    description: category.description?.[locale] ?? category.name[locale],
    path: category.href!,
    locale,
  });
}

export default async function ProductCategoryPage({ params }: PageProps<"/[locale]/products/[slug]">) {
  const { locale: raw, slug } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const category = await getProductCategory(slug);
  if (!category) notFound();
  const t = await getTranslations({ locale, namespace: "Page" });

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: category.name[locale], path: category.href! }]}
        eyebrow={t("makes")}
        title={category.name[locale]}
        intro={category.description?.[locale]}
        image={category.image ?? undefined}
      />
      <section aria-labelledby="range-title" className="py-20 md:py-28">
        <div className="container-site">
          <h2 id="range-title" className="font-display text-display-lg">
            {t("rangeTitle")}
          </h2>
          <div className="mt-12">
            {category.items.length > 0 ? (
              <CatalogItems items={category.items} locale={locale} />
            ) : (
              <p className="max-w-copy text-lg text-ink-muted">{t("rangeEmpty")}</p>
            )}
          </div>
        </div>
      </section>
      <CtaBand locale={locale} />
    </>
  );
}
