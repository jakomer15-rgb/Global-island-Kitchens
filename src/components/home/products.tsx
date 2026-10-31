import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { productNavKeys } from "@/components/site/nav-items";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { Swatch, type SwatchName } from "@/components/site/swatch";
import { hrefFor, pathFor } from "@/config/routes";
import { productPhotos } from "@/content/photos";
import type { ProductKey } from "@/content/products";
import { Link } from "@/i18n/navigation";

/** Finish illustration for categories without a company photograph yet. */
const fallbackSwatch: Partial<Record<ProductKey, SwatchName>> = {
  aluminiumKitchens: "solid",
  wardrobes: "oak",
};

/** Category cards: the company's photo where there is one (decorative, the card names it), otherwise a finish illustration. */
export function Products() {
  const t = useTranslations("Products");
  const tn = useTranslations("Nav");

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
        <ul className="mt-16 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {productNavKeys.map((key, i) => {
            const href = hrefFor(key);
            const photo = productPhotos[key];
            const content = (
              <>
                <span className="relative block aspect-[4/5] overflow-hidden bg-sand">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- static file, already optimised
                    <img
                      src={photo.src}
                      alt=""
                      width={photo.width}
                      height={photo.height}
                      loading="lazy"
                      decoding="async"
                      className="size-full img-zoom object-cover"
                    />
                  ) : (
                    <span className="block size-full img-zoom">
                      <Swatch name={fallbackSwatch[key] ?? "stone"} />
                    </span>
                  )}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-oak transition-transform duration-700 ease-out-soft group-hover:scale-x-100 rtl:origin-right"
                  />
                </span>
                <span className="mt-5 flex items-start gap-4">
                  <span className="pt-2 eyebrow text-walnut tabular-nums" dir="ltr">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1">
                    <span className="block font-display text-display-md transition-colors group-hover:text-walnut">
                      {t(`items.${key}.name`)}
                    </span>
                    <span className="mt-2 block text-sm text-ink-muted">{t(`items.${key}.body`)}</span>
                  </span>
                  {href && (
                    <ArrowUpRight
                      aria-hidden
                      className="mt-2 size-5 shrink-0 text-walnut transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100"
                    />
                  )}
                </span>
              </>
            );
            return (
              <Reveal as="li" key={key}>
                {href ? (
                  <Link href={href} className="group block">
                    {content}
                  </Link>
                ) : (
                  <div>{content}</div>
                )}
              </Reveal>
            );
          })}
        </ul>
        <p className="mt-16 max-w-copy border-t border-line pt-8 text-ink-muted">
          {t("more")}{" "}
          <Link
            href={pathFor("bespoke")}
            className="text-charcoal underline decoration-walnut/50 underline-offset-[6px] hover:decoration-walnut"
          >
            {tn("bespoke")}
          </Link>
        </p>
      </div>
    </section>
  );
}
