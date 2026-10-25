import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactActions } from "@/components/site/contact-actions";
import { ContactDetails } from "@/components/site/contact-details";
import { PageHero } from "@/components/site/page-hero";
import { pathFor } from "@/config/routes";
import { contactPage as c } from "@/content/pages";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return pageMetadata({
    title: c.metaTitle[locale],
    description: c.metaDescription[locale],
    path: pathFor("contact"),
    locale,
  });
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Page" });

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: c.eyebrow[locale], path: pathFor("contact") }]}
        eyebrow={c.eyebrow[locale]}
        title={c.title[locale]}
      />
      <section aria-labelledby="details-title" className="py-20 md:py-28">
        <div className="container-site grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 id="details-title" className="font-display text-display-lg">
              {t("contactDetails")}
            </h2>
            <div className="mt-8">
              <ContactActions locale={locale} />
            </div>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <ContactDetails locale={locale} />
          </div>
        </div>
      </section>
    </>
  );
}
