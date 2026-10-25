import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CtaBand } from "@/components/site/cta-band";
import { PageHero } from "@/components/site/page-hero";
import { JsonLd } from "@/components/seo/json-ld";
import { pathFor } from "@/config/routes";
import { faqs } from "@/content/faq";
import { faqPage as c } from "@/content/pages";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/faq">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return pageMetadata({
    title: c.metaTitle[locale],
    description: c.metaDescription[locale],
    path: pathFor("faq"),
    locale,
  });
}

export default async function FaqPage({ params }: PageProps<"/[locale]/faq">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.question[locale],
            acceptedAnswer: { "@type": "Answer", text: f.answer[locale] },
          })),
        }}
      />
      <PageHero
        locale={locale}
        crumbs={[{ label: c.eyebrow[locale], path: pathFor("faq") }]}
        eyebrow={c.eyebrow[locale]}
        title={c.title[locale]}
      />
      <section className="py-16 md:py-24">
        <div className="container-site max-w-4xl">
          {faqs.map((f) => (
            <details key={f.id} className="group border-b border-line">
              <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-6 py-6 font-display text-display-md [&::-webkit-details-marker]:hidden">
                {f.question[locale]}
                <span
                  aria-hidden
                  className="mt-2 text-xl text-walnut transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-copy pb-8 text-ink-muted">{f.answer[locale]}</p>
            </details>
          ))}
        </div>
      </section>
      <CtaBand locale={locale} />
    </>
  );
}
