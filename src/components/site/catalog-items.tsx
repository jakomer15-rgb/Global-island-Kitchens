import type { CatalogEntry } from "@/content/categories";
import type { Locale } from "@/i18n/routing";
import { Reveal } from "./reveal";
import { Swatch } from "./swatch";

/**
 * Products (or machines) in a category, added in the admin: a photo where there is one (otherwise a
 * finish illustration, marked decorative), the name and a short description.
 */
export function CatalogItems({
  items,
  locale,
  tone = "dark",
}: {
  items: CatalogEntry[];
  locale: Locale;
  tone?: "dark" | "light";
}) {
  return (
    <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Reveal as="li" key={item.id}>
          <div className="aspect-[4/3] overflow-hidden bg-sand">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- served through /media redirects
              <img
                src={item.image.src}
                alt={item.image.alt[locale]}
                width={item.image.width}
                height={item.image.height}
                loading="lazy"
                decoding="async"
                className="size-full img-zoom object-cover"
              />
            ) : (
              <span aria-hidden className="block size-full">
                <Swatch name="stone" />
              </span>
            )}
          </div>
          <h3 className="mt-5 font-display text-display-md">{item.name[locale]}</h3>
          {item.description && (
            <p className={`mt-2 text-sm ${tone === "light" ? "text-ivory/75" : "text-ink-muted"}`}>
              {item.description[locale]}
            </p>
          )}
        </Reveal>
      ))}
    </ul>
  );
}
