import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConsultationForm } from "@/components/forms/consultation-form";
import { FormMessages } from "@/components/forms/form-messages";
import { ContactActions } from "@/components/site/contact-actions";
import { ContactDetails } from "@/components/site/contact-details";
import { PageHero } from "@/components/site/page-hero";
import { pathFor } from "@/config/routes";
import { consultationPage as c } from "@/content/pages";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/book-a-consultation">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return pageMetadata({
    title: c.metaTitle[locale],
    description: c.metaDescription[locale],
    path: pathFor("bookConsultation"),
    locale,
  });
}

/** Booking by phone or email for now; the online booking form arrives with the backend in Phase 4. */
export default async function BookConsultationPage({ params }: PageProps<"/[locale]/book-a-consultation">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Page" });

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: c.eyebrow[locale], path: pathFor("bookConsultation") }]}
        eyebrow={c.eyebrow[locale]}
        title={c.title[locale]}
        intro={c.intro[locale]}
      />
      <section aria-label={c.eyebrow[locale]} className="py-16 md:py-24">
        <div className="container-site grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <FormMessages>
              <ConsultationForm />
            </FormMessages>
          </div>
          <aside className="lg:col-span-4 lg:col-start-9">
            <h2 className="font-display text-display-md">{t("visitTitle")}</h2>
            <div className="mt-4">
              <ContactDetails locale={locale} showHeadOffice={false} />
            </div>
            <h2 className="mt-10 font-display text-2xl">{c.stepsTitle[locale]}</h2>
            <div className="mt-4">
              <ContactActions
                locale={locale}
                subject={c.emailSubject[locale]}
                body={c.emailBody[locale]}
                emailLabel={t("emailWithTemplate")}
              />
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
