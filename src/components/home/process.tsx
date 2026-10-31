import { useTranslations } from "next-intl";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";

/** The project stages the business tracks (docs/ARCHITECTURE.md §6). */
const steps = [
  "inquiry",
  "measurement",
  "design",
  "quotation",
  "approval",
  "production",
  "installation",
  "completion",
] as const;

/** Numbered rows on a deep walnut ground: number, stage and a one-line description. */
export function Process() {
  const t = useTranslations("Process");

  return (
    <section
      aria-labelledby="process-title"
      id="process"
      className="scroll-mt-20 bg-walnut-deep py-24 text-ivory md:py-32"
    >
      <div className="container-site">
        <SectionHeading
          index="04"
          id="process-title"
          eyebrow={t("eyebrow")}
          title={t("title")}
          tone="light"
        />
        <ol className="mt-16 border-b border-ivory/15">
          {steps.map((step, i) => (
            <Reveal
              as="li"
              key={step}
              className="grid grid-cols-[3rem_1fr] items-baseline gap-x-6 gap-y-2 border-t border-ivory/15 py-7 transition-colors duration-500 hover:bg-ivory/[0.03] md:grid-cols-[5.5rem_1fr_1.4fr] md:gap-x-10 md:py-8"
            >
              <span className="font-display text-base text-walnut-soft tabular-nums" dir="ltr">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-display-md">{t(`steps.${step}.title`)}</h3>
              <p className="col-start-2 text-ivory/70 md:col-start-auto">{t(`steps.${step}.body`)}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
