import { useTranslations } from "next-intl";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { Swatch, type SwatchName } from "@/components/site/swatch";

const families: { key: "egger" | "mdf"; swatches: SwatchName[] }[] = [
  { key: "egger", swatches: ["oak", "walnut", "stone", "solid"] },
  { key: "mdf", swatches: ["paintedLight", "paintedDark"] },
];

export function Materials() {
  const t = useTranslations("Materials");

  return (
    <section aria-labelledby="materials-title" id="materials" className="scroll-mt-20 bg-sand py-24 md:py-32">
      <div className="container-site">
        <SectionHeading
          index="02"
          id="materials-title"
          eyebrow={t("eyebrow")}
          title={t("title")}
          intro={t("intro")}
        />

        <div className="mt-16 grid gap-14 lg:grid-cols-12 lg:gap-10">
          {families.map((family) => (
            <Reveal key={family.key} className={family.key === "egger" ? "lg:col-span-7" : "lg:col-span-5"}>
              <ul
                className={`grid gap-3 ${family.key === "egger" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}
              >
                {family.swatches.map((s) => (
                  <li key={s}>
                    <div className="aspect-[3/4] overflow-hidden shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]">
                      <Swatch name={s} />
                    </div>
                    <p className="mt-3 text-sm text-ink-muted">{t(`swatches.${s}`)}</p>
                  </li>
                ))}
              </ul>
              <h3 className="mt-8 font-display text-display-md">{t(`${family.key}.title`)}</h3>
              <p className="mt-3 max-w-copy text-ink-muted">{t(`${family.key}.body`)}</p>
            </Reveal>
          ))}
        </div>

        <p className="mt-14 border-t border-line pt-6 text-xs text-ink-muted">{t("swatchNote")}</p>
      </div>
    </section>
  );
}
