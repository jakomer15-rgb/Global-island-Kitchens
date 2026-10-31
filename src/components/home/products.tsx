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

/**
 * Category tiles on a dark ground: the company's photo where there is one (decorative, the tile
 * names it), otherwise a finish illustration. Name and description sit over a gradient at the foot.
 */
export function Products() {
  const t = useTranslations("Products");
  const tn = useTranslations("Nav");

  return (
    <section
      aria-labelledby="products-title"
      id="products"
      className="scroll-mt-20 bg-charcoal pt-24 text-ivory md:pt-32"
    >
      <div className="container-site">
        <SectionHeading
          index="01"
          id="products-title"
          eyebrow={t("eyebrow")}
          title={t("title")}
          intro={t("intro")}
          tone="light"
        />
      </div>
      <ul className="mt-16 grid gap-0.5 bg-ivory/10 sm:grid-cols-2 lg:grid-cols-4">
        {productNavKeys.map((key, i) => {
          const href = hrefFor(key);
          const photo = productPhotos[key];
          const content = (
            <>
              <span className="absolute inset-0 block bg-espresso">
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
              </span>
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-espresso/90 via-espresso/5 to-transparent"
              />
              <span
                className="absolute start-6 top-5 text-[0.625rem] tracking-[0.14em] text-ivory/60 tabular-nums"
                dir="ltr"
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="absolute inset-x-0 bottom-0 block p-6">
                <span className="flex items-start justify-between gap-3">
                  <span className="block font-display text-display-md">{t(`items.${key}.name`)}</span>
                  {href && (
                    <ArrowUpRight
                      aria-hidden
                      className="mt-1.5 size-5 shrink-0 text-walnut-soft transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100"
                    />
                  )}
                </span>
                <span className="mt-2 block max-w-[17rem] text-sm text-ivory/75">
                  {t(`items.${key}.body`)}
                </span>
              </span>
            </>
          );
          const tile = "group relative block aspect-[4/5] overflow-hidden";
          return (
            <Reveal as="li" key={key}>
              {href ? (
                <Link href={href} className={tile}>
                  {content}
                </Link>
              ) : (
                <div className={tile}>{content}</div>
              )}
            </Reveal>
          );
        })}
      </ul>
      <div className="container-site py-14">
        <p className="max-w-copy text-ivory/70">
          {t("more")}{" "}
          <Link
            href={pathFor("bespoke")}
            className="text-ivory underline decoration-walnut-soft/60 underline-offset-[6px] hover:decoration-walnut-soft"
          >
            {tn("bespoke")}
          </Link>
        </p>
      </div>
    </section>
  );
}
