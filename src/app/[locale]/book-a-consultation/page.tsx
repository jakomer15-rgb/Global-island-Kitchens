import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
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
      <section aria-labelledby="steps-title" className="py-20 md:py-28">
        <div className="container-site grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h2 id="steps-title" className="font-display text-display-lg">
              {c.stepsTitle[locale]}
            </h2>
            <ol className="mt-8">
              {c.steps[locale].map((step, i) => (
                <li key={step} className="flex gap-5 border-t border-line py-5">
                  <span className="pt-1 eyebrow text-walnut tabular-nums" dir="ltr">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-10">
              <ContactActions
                locale={locale}
                subject={c.emailSubject[locale]}
                body={c.emailBody[locale]}
                emailLabel={t("emailWithTemplate")}
              />
            </div>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <h2 className="font-display text-display-md">{t("visitTitle")}</h2>
            <div className="mt-4">
              <ContactDetails locale={locale} showHeadOffice={false} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
