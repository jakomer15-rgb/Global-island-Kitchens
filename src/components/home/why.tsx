import { useTranslations } from "next-intl";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";

const keys = ["experience", "factory", "scale", "custom"] as const;

export function Why() {
  const t = useTranslations("Why");

  return (
    <section aria-labelledby="why-title" className="py-24 md:py-32">
      <div className="container-site grid gap-14 lg:grid-cols-12">
        <SectionHeading
          index="03"
          id="why-title"
          eyebrow={t("eyebrow")}
          title={t("title")}
          className="lg:col-span-5"
        />
        <dl className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:col-span-7">
          {keys.map((key) => (
            <Reveal key={key} className="border-t border-charcoal/20 pt-6">
              <dt className="font-display text-display-md">{t(`items.${key}.title`)}</dt>
              <dd className="mt-3 text-ink-muted">{t(`items.${key}.body`)}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
