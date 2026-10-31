import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CtaBand } from "@/components/site/cta-band";
import { PageHero } from "@/components/site/page-hero";
import { ProjectCard } from "@/components/site/project-card";
import { pathFor } from "@/config/routes";
import { projectsPage } from "@/content/pages";
import { galleryOf, segmentLabels } from "@/content/projects";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { getPortfolio } from "@/server/content/portfolio";

export async function generateStaticParams() {
  const projects = await getPortfolio();
  return routing.locales.flatMap((locale) => projects.map((p) => ({ locale, slug: p.slug })));
}

async function getProject(slug: string) {
  return (await getPortfolio()).find((p) => p.slug === slug);
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[slug]">): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = raw as Locale;
  const project = await getProject(slug);
  if (!project) return {};
  const where = project.location[locale];
  return pageMetadata({
    title: `${project.name[locale]}, ${where}`,
    description: `${project.scopeText[locale]} · ${where}${project.size ? ` · ${project.size[locale]}` : ""} · Global Island Kitchens`,
    path: `/projects/${project.slug}`,
    locale,
    // Text-only pages stay out of search results until the project has photos.
    noindex: galleryOf(project).length === 0,
  });
}

export default async function ProjectPage({ params }: PageProps<"/[locale]/projects/[slug]">) {
  const { locale: raw, slug } = await params;
  const locale = raw as Locale;
  setRequestLocale(locale);
  const project = await getProject(slug);
  if (!project) notFound();
  const t = await getTranslations({ locale, namespace: "Page" });
  const gallery = galleryOf(project);
  const more = (await getPortfolio())
    .filter((p) => p.segment === project.segment && p.slug !== project.slug)
    .slice(0, 3);

  const facts = [
    { label: t("segment"), value: segmentLabels[project.segment][locale] },
    { label: t("location"), value: project.location[locale] },
    ...(project.size ? [{ label: t("size"), value: project.size[locale] }] : []),
    { label: t("scope"), value: project.scopeText[locale] },
    ...(project.clientName ? [{ label: t("client"), value: project.clientName }] : []),
  ];

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[
          { label: projectsPage.eyebrow[locale], path: pathFor("projects") },
          { label: project.name[locale], path: `/projects/${project.slug}` },
        ]}
        eyebrow={segmentLabels[project.segment][locale]}
        title={project.name[locale]}
        intro={project.location[locale]}
      />

      {gallery.length > 0 && (
        <section aria-label={project.name[locale]} className="pt-12 md:pt-16">
          {/* The profile's photos are small (about 500-1100 px wide), so they are shown at card size, never full width. */}
          <ul className="container-site grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {gallery.map((img, i) => (
              <li key={img.src} className="overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element -- static files and /media, already optimised */}
                <img
                  src={img.src}
                  alt={img.alt[locale]}
                  width={img.width}
                  height={img.height}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="aspect-[3/2] w-full bg-sand object-cover transition-[scale] duration-[1.2s] ease-out-soft hover:scale-105"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="py-20 md:py-28">
        <div className="container-site grid gap-12 lg:grid-cols-12">
          <dl className="lg:col-span-7">
            {facts.map((f) => (
              <div key={f.label} className="grid gap-2 border-t border-line py-6 sm:grid-cols-3">
                <dt className="text-sm text-ink-muted">{f.label}</dt>
                <dd className="font-display text-display-md sm:col-span-2">{f.value}</dd>
              </div>
            ))}
          </dl>
          <div className="lg:col-span-4 lg:col-start-9">
            {gallery.length === 0 && <p className="text-sm text-ink-muted">{t("projectNote")}</p>}
            <Link
              href={pathFor("projects")}
              className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline decoration-walnut/50 underline-offset-[6px] hover:decoration-walnut"
            >
              <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" /> {t("backToProjects")}
            </Link>
          </div>
        </div>
      </section>

      {more.length > 0 && (
        <section aria-labelledby="more-title" className="bg-sand py-20 md:py-24">
          <div className="container-site">
            <h2 id="more-title" className="font-display text-display-lg">
              {t("moreProjects")}
            </h2>
            <ul className="mt-12 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((p) => (
                <li key={p.slug}>
                  <ProjectCard project={p} locale={locale} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand locale={locale} />
    </>
  );
}
