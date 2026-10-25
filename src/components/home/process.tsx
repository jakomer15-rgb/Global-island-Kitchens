import { useTranslations } from "next-intl";
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

export function Process() {
  const t = useTranslations("Process");

  return (
    <section
      aria-labelledby="process-title"
      id="process"
      className="scroll-mt-20 bg-charcoal py-24 text-ivory md:py-32"
    >
      <div className="container-site">
        <SectionHeading
          index="04"
          id="process-title"
          eyebrow={t("eyebrow")}
          title={t("title")}
          tone="light"
        />
        <ol className="mt-16 grid gap-px overflow-hidden bg-ivory/12 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step} className="bg-charcoal p-6 md:p-8">
              <span className="eyebrow text-walnut-soft tabular-nums" dir="ltr">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-6 font-display text-display-md">{t(`steps.${step}.title`)}</h3>
              <p className="mt-2 text-sm text-ivory/70">{t(`steps.${step}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
