import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { pathFor } from "@/config/routes";
import { getProject, type Segment } from "@/content/projects";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/** A selection from src/content/projects.ts (no client names or photos until permitted). */
const selection: { segment: Segment; slugs: string[] }[] = [
  {
    segment: "residential",
    slugs: ["al-faris-suite-2-juffair", "marassi-bay-flats", "vista-juffair", "capri-suites-janabiya"],
  },
  { segment: "villas", slugs: ["villas-hidd", "al-naseem-phase-2", "villa-janabiya"] },
  {
    segment: "commercial",
    slugs: ["cafe-interiors-hamad-town", "retail-interiors-diyar-al-muharraq", "cafe-booth-sitra"],
  },
];

export function Projects() {
  const t = useTranslations("Projects");
  const tp = useTranslations("Page");
  const locale = useLocale() as Locale;

  return (
    <section aria-labelledby="projects-title" id="projects" className="scroll-mt-20 py-24 md:py-32">
      <div className="container-site">
        <SectionHeading
          index="05"
          id="projects-title"
          eyebrow={t("eyebrow")}
          title={t("title")}
          intro={t("intro")}
        />
        <div className="mt-16 grid gap-12 lg:grid-cols-3 lg:gap-10">
          {selection.map(({ segment, slugs }) => (
            <Reveal key={segment}>
              <h3 className="border-b border-charcoal pb-4 eyebrow text-charcoal">
                {t(`segments.${segment}`)}
              </h3>
              <ul>
                {slugs.map(getProject).map(
                  (p) =>
                    p && (
                      <li key={p.slug} className="border-b border-line">
                        <Link href={`/projects/${p.slug}`} className="group block py-6">
                          <span className="block font-display text-display-md group-hover:text-walnut">
                            {p.name[locale]}
                          </span>
                          <span className="mt-1 block text-sm text-walnut">
                            {p.location[locale]}
                            {p.size && <span className="text-ink-muted"> · {p.size[locale]}</span>}
                          </span>
                          <span className="mt-2 block text-sm text-ink-muted">{p.scopeText[locale]}</span>
                        </Link>
                      </li>
                    ),
                )}
              </ul>
            </Reveal>
          ))}
        </div>
        <Link
          href={pathFor("projects")}
          className="mt-12 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline decoration-walnut/50 underline-offset-[6px] hover:decoration-walnut"
        >
          {tp("allProjects")} <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
        </Link>
      </div>
    </section>
  );
}
