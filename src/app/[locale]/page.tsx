import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Designers } from "@/components/home/designers";
import { Hero } from "@/components/home/hero";
import { Materials } from "@/components/home/materials";
import { Process } from "@/components/home/process";
import { Products } from "@/components/home/products";
import { Projects } from "@/components/home/projects";
import { Showroom } from "@/components/home/showroom";
import { Why } from "@/components/home/why";
import { JsonLd } from "@/components/seo/json-ld";
import { routing } from "@/i18n/routing";
import { alternates } from "@/lib/seo";
import { organizationJsonLd } from "@/lib/structured-data";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: { absolute: `${t("title")} | Global Island Kitchens` },
    description: t("description"),
    alternates: alternates("/", locale === "ar" ? "ar" : "en"),
  };
}

// Testimonials are not shown: none have been supplied with customer consent (docs/OPEN_QUESTIONS.md #36).
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />
      <Hero />
      <Products />
      <Materials />
      <Why />
      <Process />
      <Projects />
      <Designers />
      <Showroom />
    </>
  );
}
