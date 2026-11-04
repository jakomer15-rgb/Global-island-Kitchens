import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd } from "@/components/seo/json-ld";
import { ContactDetails } from "@/components/site/contact-details";
import { CtaBand } from "@/components/site/cta-band";
import { PageHero } from "@/components/site/page-hero";
import { pathFor } from "@/config/routes";
import { showroomPage as c } from "@/content/pages";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { organizationJsonLd } from "@/lib/structured-data";
import { getSiteSettings } from "@/server/settings/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/showroom">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return pageMetadata({
    title: c.metaTitle[locale],
    description: c.metaDescription[locale],
    path: pathFor("showroom"),
    locale,
  });
}

// No embedded map: the exact location pin hasn't been confirmed (docs/OPEN_QUESTIONS.md #9).
export default async function ShowroomPage({ params }: PageProps<"/[locale]/showroom">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const { contact, locations } = await getSiteSettings();
  const t = await getTranslations({ locale, namespace: "Page" });

  return (
    <>
      <JsonLd data={organizationJsonLd(locale, contact, locations)} />
      <PageHero
        locale={locale}
        crumbs={[{ label: c.eyebrow[locale], path: pathFor("showroom") }]}
        eyebrow={c.eyebrow[locale]}
        title={c.title[locale]}
        intro={c.intro[locale]}
      />
      <section aria-labelledby="details-title" className="py-20 md:py-28">
        <div className="container-site grid gap-12 lg:grid-cols-12">
          <h2 id="details-title" className="font-display text-display-lg lg:col-span-4">
            {t("contactDetails")}
          </h2>
          <div className="lg:col-span-7 lg:col-start-6">
            <ContactDetails locale={locale} contact={contact} locations={locations} />
          </div>
        </div>
      </section>
      <CtaBand locale={locale} />
    </>
  );
}
