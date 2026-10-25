import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/site/page-hero";
import type { LegalDoc } from "@/content/legal";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export function legalMetadata(doc: LegalDoc, path: string, locale: Locale): Metadata {
  return pageMetadata({
    title: doc.metaTitle[locale],
    description: doc.metaDescription[locale],
    path,
    locale,
  });
}

export function LegalPage({ doc, path, locale }: { doc: LegalDoc; path: string; locale: Locale }) {
  setRequestLocale(locale);
  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: doc.title[locale], path }]}
        eyebrow={doc.updated[locale]}
        title={doc.title[locale]}
      />
      <div className="container-site max-w-3xl py-16 md:py-24">
        {doc.sections.map((section) => (
          <section key={section.heading.en} className="border-t border-line py-8">
            <h2 className="font-display text-display-md">{section.heading[locale]}</h2>
            {section.body.map((p) => (
              <p key={p.en} className="mt-4 text-ink-muted">
                {p[locale]}
              </p>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
