import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { FurnitureForm } from "@/components/assistant/furniture-form";
import { PageHero } from "@/components/site/page-hero";
import { furniturePage as c } from "@/content/assistant";
import type { Locale } from "@/i18n/routing";
import { aiAvailable } from "@/server/ai/drafts";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Furniture assistant", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function FurnitureAssistantPage({ params }: PageProps<"/[locale]/furniture-assistant">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  // Not found unless the owner switched it on (Admin → Settings → AI assistants).
  if (!(await aiAvailable(db, "furnitureAssistant"))) notFound();
  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: c.eyebrow[locale], path: "/furniture-assistant" }]}
        eyebrow={c.eyebrow[locale]}
        title={c.title[locale]}
        intro={c.intro[locale]}
      />
      <section className="py-14 md:py-20">
        <div className="container-site max-w-2xl">
          <FurnitureForm locale={locale} />
        </div>
      </section>
    </>
  );
}
