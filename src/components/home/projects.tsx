import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ProjectCard } from "@/components/site/project-card";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { pathFor } from "@/config/routes";
import { galleryOf, type Project } from "@/content/projects";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

/**
 * A selection from the portfolio (managed in the admin; projects that are unpublished are skipped),
 * across residential, villa and commercial work. Projects with photographs lead the gallery.
 */
const selection = [
  "al-faris-suite-2-juffair",
  "marassi-bay-flats",
  "cafe-interiors-hamad-town",
  "al-naseem-phase-2",
  "capri-suites-janabiya",
  "retail-interiors-diyar-al-muharraq",
  "cafe-booth-sitra",
  "vista-juffair",
  "villas-hidd",
  "villa-janabiya",
];

/** Grid placement for five cards: a wide lead card and one beside it, then a row of three. */
const placement = ["lg:col-span-7", "lg:col-span-5", "lg:col-span-4", "lg:col-span-4", "lg:col-span-4"];

export function Projects({ portfolio }: { portfolio: Project[] }) {
  const t = useTranslations("Projects");
  const tp = useTranslations("Page");
  const locale = useLocale() as Locale;
  const shown = selection
    .map((slug) => portfolio.find((p) => p.slug === slug))
    .filter((p): p is Project => Boolean(p))
    .sort((a, b) => Number(galleryOf(b).length > 0) - Number(galleryOf(a).length > 0))
    .slice(0, placement.length);

  return (
    <section aria-labelledby="projects-title" id="projects" className="scroll-mt-20 py-24 md:py-32">
      <div className="container-site">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <SectionHeading
            index="05"
            id="projects-title"
            eyebrow={t("eyebrow")}
            title={t("title")}
            intro={t("intro")}
          />
          <Button asChild variant="outline" className="hidden md:inline-flex">
            <Link href={pathFor("projects")}>
              {tp("allProjects")} <ArrowRight aria-hidden className="rtl:rotate-180" />
            </Link>
          </Button>
        </div>
        <ul className="mt-16 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-12">
          {shown.map((p, i) => (
            <Reveal as="li" key={p.slug} className={cn(placement[i], i === 0 && "sm:col-span-2")}>
              <ProjectCard
                project={p}
                locale={locale}
                variant={i === 0 ? "lead" : i === 1 ? "fill" : undefined}
              />
            </Reveal>
          ))}
        </ul>
        <Link
          href={pathFor("projects")}
          className="mt-14 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline decoration-walnut/50 underline-offset-[6px] hover:decoration-walnut md:hidden"
        >
          {tp("allProjects")} <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
        </Link>
      </div>
    </section>
  );
}
