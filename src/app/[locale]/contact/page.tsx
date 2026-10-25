import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactForm } from "@/components/forms/contact-form";
import { FormMessages } from "@/components/forms/form-messages";
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
  const [t, tf] = await Promise.all([
    getTranslations({ locale, namespace: "Page" }),
    getTranslations({ locale, namespace: "Forms.contact" }),
  ]);

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: c.eyebrow[locale], path: pathFor("contact") }]}
        eyebrow={c.eyebrow[locale]}
        title={c.title[locale]}
      />
      <section className="py-16 md:py-24">
        <div className="container-site grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="font-display text-display-lg">{tf("title")}</h2>
            <div className="mt-8">
              <FormMessages>
                <ContactForm />
              </FormMessages>
            </div>
          </div>
          <aside aria-labelledby="details-title" className="lg:col-span-4 lg:col-start-9">
            <h2 id="details-title" className="font-display text-display-md">
              {t("contactDetails")}
            </h2>
            <div className="mt-4">
              <ContactDetails locale={locale} />
            </div>
            <div className="mt-8">
              <ContactActions locale={locale} />
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
