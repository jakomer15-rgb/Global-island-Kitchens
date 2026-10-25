import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { hrefFor, type PageKey } from "@/config/routes";
import { Link } from "@/i18n/navigation";

const productKeys = [
  "woodenKitchens",
  "aluminiumKitchens",
  "wardrobes",
  "walkInClosets",
  "bedroomFurniture",
  "tvUnits",
  "wallCladding",
  "bathroomVanities",
] as const satisfies readonly PageKey[];

export function Products() {
  const t = useTranslations("Products");

  return (
    <section aria-labelledby="products-title" id="products" className="scroll-mt-20 py-24 md:py-32">
      <div className="container-site">
        <SectionHeading
          index="01"
          id="products-title"
          eyebrow={t("eyebrow")}
          title={t("title")}
          intro={t("intro")}
        />
        <ul className="mt-16 grid border-t border-line md:grid-cols-2">
          {productKeys.map((key, i) => {
            const href = hrefFor(key);
            const content = (
              <>
                <span className="pt-2 eyebrow text-walnut tabular-nums" dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1">
                  <span className="block font-display text-display-md">{t(`items.${key}.name`)}</span>
                  <span className="mt-2 block text-ink-muted">{t(`items.${key}.body`)}</span>
                </span>
                {href && (
                  <ArrowUpRight
                    aria-hidden
                    className="mt-2 size-5 text-walnut transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100"
                  />
                )}
              </>
            );
            return (
              <Reveal
                as="li"
                key={key}

                className="border-b border-line md:odd:border-e md:odd:pe-10 md:even:ps-10"
              >
                {href ? (
                  <Link href={href} className="group flex gap-6 py-8">
                    {content}
                  </Link>
                ) : (
                  <div className="flex gap-6 py-8">{content}</div>
                )}
              </Reveal>
            );
          })}
        </ul>
        <p className="mt-10 max-w-copy text-ink-muted">{t("more")}</p>
      </div>
    </section>
  );
}
