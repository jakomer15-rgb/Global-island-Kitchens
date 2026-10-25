import { Check } from "lucide-react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ContactActions } from "@/components/site/contact-actions";
import { PageHero } from "@/components/site/page-hero";
import { ProjectCard } from "@/components/site/project-card";
import { pathFor } from "@/config/routes";
import { designersPage as c } from "@/content/pages";

import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { getPortfolio } from "@/server/content/portfolio";
import { getSiteSettings } from "@/server/settings/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/designers">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return pageMetadata({
    title: c.metaTitle[locale],
    description: c.metaDescription[locale],
    path: pathFor("designers"),
    locale,
  });
}

/** Large-scope projects from the profile, as examples of trade work. */
const examples = ["vista-juffair", "capri-suites-janabiya", "villa-janabiya"];

export default async function DesignersPage({ params }: PageProps<"/[locale]/designers">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [{ contact }, portfolio] = await Promise.all([getSiteSettings(), getPortfolio()]);
  const projects = examples
    .map((slug) => portfolio.find((p) => p.slug === slug))
    .filter((p) => p !== undefined);

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: c.eyebrow[locale], path: pathFor("designers") }]}
        eyebrow={c.eyebrow[locale]}
        title={c.title[locale]}
        intro={c.intro[locale]}
      />
      <section className="py-20 md:py-28">
        <div className="container-site grid gap-14 lg:grid-cols-12">
          <ul className="space-y-5 text-lg lg:col-span-7">
            {c.points[locale].map((point) => (
              <li key={point} className="flex items-start gap-4 border-t border-line pt-5">
                <Check aria-hidden className="mt-1.5 size-5 shrink-0 text-walnut" strokeWidth={1.5} />
                {point}
              </li>
            ))}
          </ul>
          <ul className="lg:col-span-4 lg:col-start-9">
            {projects.map((project) => (
              <li key={project.slug}>
                <ProjectCard project={project} locale={locale} />
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section aria-labelledby="start-title" className="bg-sand py-20 md:py-24">
        <div className="container-site">
          <h2 id="start-title" className="font-display text-display-lg">
            {c.sendTitle[locale]}
          </h2>
          <p className="mt-4 mb-10 max-w-copy text-ink-muted">{c.sendBody[locale]}</p>
          <ContactActions locale={locale} contact={contact} subject={c.sendTitle[locale]} />
        </div>
      </section>
    </>
  );
}
