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
      className="scroll-mt-20 bg-espresso py-24 text-ivory md:py-32"
    >
      <div className="container-site">
        <SectionHeading
          index="04"
          id="process-title"
          eyebrow={t("eyebrow")}
          title={t("title")}
          tone="light"
        />
        <ol className="mt-16 grid gap-px overflow-hidden bg-ivory/10 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li
              key={step}
              className="group relative bg-espresso p-6 transition-colors duration-500 hover:bg-charcoal md:p-8"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-walnut-soft transition-transform duration-700 ease-out-soft group-hover:scale-x-100 rtl:origin-right"
              />
              <span className="font-display text-4xl text-walnut-soft lining-nums tabular-nums" dir="ltr">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-8 font-display text-display-md">{t(`steps.${step}.title`)}</h3>
              <p className="mt-2 text-sm text-ivory/70">{t(`steps.${step}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
