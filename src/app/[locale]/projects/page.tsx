import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CtaBand } from "@/components/site/cta-band";
import { PageHero } from "@/components/site/page-hero";
import { ProjectCard } from "@/components/site/project-card";
import { pathFor } from "@/config/routes";
import { projectsPage as c } from "@/content/pages";
import { projects, segmentLabels, type Segment } from "@/content/projects";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/projects">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return pageMetadata({
    title: c.metaTitle[locale],
    description: c.metaDescription[locale],
    path: pathFor("projects"),
    locale,
  });
}

const segments: Segment[] = ["residential", "villas", "commercial"];

export default async function ProjectsPage({ params }: PageProps<"/[locale]/projects">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: c.eyebrow[locale], path: pathFor("projects") }]}
        eyebrow={c.eyebrow[locale]}
        title={c.title[locale]}
        intro={c.intro[locale]}
      />
      {segments.map((segment, i) => {
        const items = projects.filter((p) => p.segment === segment);
        return (
          <section
            key={segment}
            aria-labelledby={`seg-${segment}`}
            className={i % 2 ? "bg-sand py-16 md:py-24" : "py-16 md:py-24"}
          >
            <div className="container-site">
              <div className="flex items-baseline justify-between gap-6 border-b border-charcoal pb-4">
                <h2 id={`seg-${segment}`} className="font-display text-display-lg">
                  {segmentLabels[segment][locale]}
                </h2>
                <span className="text-sm text-ink-muted tabular-nums" dir="ltr">
                  {items.length}
                </span>
              </div>
              <ul className="mt-6 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((project) => (
                  <li key={project.slug}>
                    <ProjectCard project={project} locale={locale} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
      <CtaBand locale={locale} />
    </>
  );
}
