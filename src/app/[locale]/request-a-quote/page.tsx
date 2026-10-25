import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FormMessages } from "@/components/forms/form-messages";
import { QuoteWizard } from "@/components/forms/quote-wizard";
import { ContactActions } from "@/components/site/contact-actions";
import { PageHero } from "@/components/site/page-hero";
import { pathFor } from "@/config/routes";
import { quotePage as c } from "@/content/pages";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/request-a-quote">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return pageMetadata({
    title: c.metaTitle[locale],
    description: c.metaDescription[locale],
    path: pathFor("requestQuote"),
    locale,
  });
}

/** Six-step quotation request, saved to the database with uploads (src/server/enquiries/submit.ts). */
export default async function RequestQuotePage({ params }: PageProps<"/[locale]/request-a-quote">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, tp] = await Promise.all([
    getTranslations({ locale, namespace: "Page" }),
    getTranslations({ locale, namespace: "Process" }),
  ]);

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: c.eyebrow[locale], path: pathFor("requestQuote") }]}
        eyebrow={c.eyebrow[locale]}
        title={c.title[locale]}
        intro={c.intro[locale]}
      />
      <section aria-label={c.eyebrow[locale]} className="py-16 md:py-24">
        <div className="container-site grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <FormMessages>
              <QuoteWizard />
            </FormMessages>
            <noscript>
              <p className="mt-6 text-ink-muted">{c.intro[locale]}</p>
            </noscript>
          </div>
          <aside aria-labelledby="next-title" className="space-y-8 self-start lg:col-span-4 lg:col-start-9">
            <div className="bg-sand p-8">
              <h2 id="next-title" className="font-display text-display-md">
                {t("process")}
              </h2>
              <ol className="mt-6 space-y-4">
                {(["inquiry", "measurement", "design", "quotation"] as const).map((step, i) => (
                  <li key={step}>
                    <p className="text-sm font-medium">
                      <span className="text-walnut tabular-nums" dir="ltr">
                        {i + 1}.
                      </span>{" "}
                      {tp(`steps.${step}.title`)}
                    </p>
                    <p className="text-sm text-ink-muted">{tp(`steps.${step}.body`)}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2 className="font-display text-2xl">{c.sendTitle[locale]}</h2>
              <p className="mt-2 text-sm text-ink-muted">{t("ctaBody")}</p>
              <div className="mt-5">
                <ContactActions
                  locale={locale}
                  subject={c.emailSubject[locale]}
                  body={c.emailBody[locale]}
                  emailLabel={t("emailWithTemplate")}
                />
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
