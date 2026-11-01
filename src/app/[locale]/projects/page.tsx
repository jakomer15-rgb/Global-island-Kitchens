import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CtaBand } from "@/components/site/cta-band";
import { PageHero } from "@/components/site/page-hero";
import { ProjectCard } from "@/components/site/project-card";
import { Reveal } from "@/components/site/reveal";
import { pathFor } from "@/config/routes";
import { projectsPage as c } from "@/content/pages";
import { segmentLabels, type Segment } from "@/content/projects";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { getCatalog } from "@/server/content/catalog";
import { getPortfolio } from "@/server/content/portfolio";

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

/**
 * Projects grouped by the project categories staff create in the admin (in their order, with
 * uncategorised projects last); until there are any, by segment as before.
 */
export default async function ProjectsPage({ params }: PageProps<"/[locale]/projects">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [projects, catalog, t] = await Promise.all([
    getPortfolio(),
    getCatalog(),
    getTranslations({ locale, namespace: "Page" }),
  ]);
  const bySlug = new Map(projects.map((p) => [p.slug, p]));
  const categorised = catalog.projects
    .map((c) => ({
      id: c.id,
      title: c.name[locale],
      intro: c.description?.[locale],
      items: c.projectSlugs.flatMap((slug) => bySlug.get(slug) ?? []),
    }))
    .filter((g) => g.items.length > 0);
  const placed = new Set(categorised.flatMap((g) => g.items.map((p) => p.slug)));
  const rest = projects.filter((p) => !placed.has(p.slug));
  const groups =
    categorised.length > 0
      ? [
          ...categorised,
          ...(rest.length > 0
            ? [{ id: "other", title: t("otherProjects"), intro: undefined, items: rest }]
            : []),
        ]
      : segments.map((segment) => ({
          id: segment,
          title: segmentLabels[segment][locale],
          intro: undefined,
          items: projects.filter((p) => p.segment === segment),
        }));

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: c.eyebrow[locale], path: pathFor("projects") }]}
        eyebrow={c.eyebrow[locale]}
        title={c.title[locale]}
        intro={c.intro[locale]}
      />
      {groups.map(({ id, title, intro, items }, i) => {
        return (
          <section
            key={id}
            aria-labelledby={`seg-${id}`}
            className={i % 2 ? "bg-sand py-20 md:py-28" : "py-20 md:py-28"}
          >
            <div className="container-site">
              <div className="border-b border-charcoal/30 pb-5">
                <div className="flex items-baseline justify-between gap-6">
                  <h2 id={`seg-${id}`} className="font-display text-display-lg">
                    {title}
                  </h2>
                  <span className="font-display text-3xl text-walnut lining-nums tabular-nums" dir="ltr">
                    {String(items.length).padStart(2, "0")}
                  </span>
                </div>
                {intro && <p className="mt-3 max-w-copy text-ink-muted">{intro}</p>}
              </div>
              <ul className="mt-12 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((project) => (
                  <Reveal as="li" key={project.slug}>
                    <ProjectCard project={project} locale={locale} />
                  </Reveal>
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
