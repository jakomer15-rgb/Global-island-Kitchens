import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Designers } from "@/components/home/designers";
import { Hero } from "@/components/home/hero";
import { Materials } from "@/components/home/materials";
import { PhotoStrip } from "@/components/home/photo-strip";
import { Process } from "@/components/home/process";
import { Products } from "@/components/home/products";
import { Projects } from "@/components/home/projects";
import { Showroom } from "@/components/home/showroom";
import { Testimonials } from "@/components/home/testimonials";
import { Why } from "@/components/home/why";
import { JsonLd } from "@/components/seo/json-ld";
import { routing } from "@/i18n/routing";
import { alternates } from "@/lib/seo";
import { organizationJsonLd } from "@/lib/structured-data";
import { getCatalog } from "@/server/content/catalog";
import { getPortfolio } from "@/server/content/portfolio";
import { getTestimonials } from "@/server/content/public";
import { getSiteSettings } from "@/server/settings/site";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  const { seo } = await getSiteSettings();
  const ar = locale === "ar";
  return {
    title: { absolute: `${(ar ? seo.titleAr : seo.titleEn) ?? t("title")} | Global Island Kitchens` },
    description: (ar ? seo.descriptionAr : seo.descriptionEn) ?? t("description"),
    alternates: alternates("/", locale === "ar" ? "ar" : "en"),
  };
}

// Testimonials appear only once staff publish one with the customer's recorded consent (admin).
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [settings, testimonials, portfolio, catalog] = await Promise.all([
    getSiteSettings(),
    getTestimonials(),
    getPortfolio(),
    getCatalog(),
  ]);
  const hero = settings.homeHero;
  const ar = locale === "ar";

  return (
    <>
      <JsonLd data={organizationJsonLd(locale, settings.contact)} />
      <Hero
        text={{
          eyebrow: ar ? hero.eyebrowAr : hero.eyebrowEn,
          title: ar ? hero.titleAr : hero.titleEn,
          accent: ar ? hero.accentAr : hero.accentEn,
          intro: ar ? hero.introAr : hero.introEn,
        }}
      />
      <Products categories={catalog.products} />
      <PhotoStrip />
      <Materials />
      <Why />
      <Process />
      <Projects portfolio={portfolio} />
      <Testimonials items={testimonials} locale={locale} />
      <Designers />
      <Showroom contact={settings.contact} locations={settings.locations} />
    </>
  );
}
