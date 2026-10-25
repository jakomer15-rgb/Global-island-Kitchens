import { useTranslations } from "next-intl";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";

/**
 * Projects from the company profile (P5–P7). Client and developer names are left out until the
 * owner confirms permission to name them (docs/OPEN_QUESTIONS.md #24). No photos until usage
 * permission is confirmed (#2).
 */
const segments = [
  { key: "residential", items: ["alFaris", "marassi", "vista", "capri"] },
  { key: "villas", items: ["villaHidd", "alNaseem"] },
  { key: "commercial", items: ["selvis", "trolly"] },
] as const;

export function Projects() {
  const t = useTranslations("Projects");

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
          {segments.map((segment) => (
            <Reveal key={segment.key}>
              <h3 className="border-b border-charcoal pb-4 eyebrow text-charcoal">
                {t(`segments.${segment.key}`)}
              </h3>
              <ul>
                {segment.items.map((item) => (
                  <li key={item} className="border-b border-line py-6">
                    <p className="font-display text-display-md">{t(`items.${item}.name`)}</p>
                    <p className="mt-1 text-sm text-walnut">{t(`items.${item}.place`)}</p>
                    <p className="mt-2 text-sm text-ink-muted">{t(`items.${item}.scope`)}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
