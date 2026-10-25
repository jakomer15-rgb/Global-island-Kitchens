import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
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

/**
 * Requests go by email (pre-filled template) or phone. The six-step online quotation form, saved
 * to the database, replaces this in Phase 4.
 */
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
      <section aria-labelledby="send-title" className="py-20 md:py-28">
        <div className="container-site grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 id="send-title" className="font-display text-display-lg">
              {c.sendTitle[locale]}
            </h2>
            <ol className="mt-8">
              {c.send[locale].map((item, i) => (
                <li key={item} className="flex gap-5 border-t border-line py-5">
                  <span className="pt-1 eyebrow text-walnut tabular-nums" dir="ltr">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{item}</span>
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
          <aside aria-labelledby="next-title" className="self-start bg-sand p-8 lg:col-span-4 lg:col-start-9">
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
          </aside>
        </div>
      </section>
    </>
  );
}
