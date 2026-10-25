import { decorLibrary as c } from "@/content/cms";
import type { Locale } from "@/i18n/routing";

export interface PublicDecor {
  id: string;
  board: "egger_laminate" | "egger_melamine" | "painted_mdf";
  code: string;
  nameEn: string;
  nameAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  texture: string | null;
  swatchHex: string | null;
  imageFileId: string | null;
  availability: "unverified" | "in_stock" | "to_order" | "discontinued";
}

const boards = ["egger_laminate", "egger_melamine", "painted_mdf"] as const;

/** Published décors from the admin's materials library, grouped by board. Hidden while empty. */
export function DecorLibrary({ items, locale }: { items: PublicDecor[]; locale: Locale }) {
  if (items.length === 0) return null;
  const ar = locale === "ar";

  return (
    <section aria-labelledby="decor-title" className="border-t border-line py-20 md:py-28">
      <div className="container-site">
        <h2 id="decor-title" className="font-display text-display-lg">
          {c.title[locale]}
        </h2>
        <p className="mt-5 max-w-copy text-ink-muted">{c.intro[locale]}</p>
        {boards.map((board) => {
          const group = items.filter((d) => d.board === board);
          if (group.length === 0) return null;
          return (
            <div key={board} className="mt-14">
              <h3 className="eyebrow text-walnut">{c.boards[board][locale]}</h3>
              <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
                {group.map((d) => {
                  const name = (ar ? d.nameAr : d.nameEn) ?? d.nameEn;
                  const description = ar ? d.descriptionAr : d.descriptionEn;
                  return (
                    <li key={d.id}>
                      <div
                        className="aspect-square overflow-hidden shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
                        style={{ background: d.swatchHex ?? "var(--color-sand)" }}
                      >
                        {d.imageFileId && (
                          // eslint-disable-next-line @next/next/no-img-element -- website images are served by /media
                          <img
                            src={`/media/${d.imageFileId}`}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        )}
                      </div>
                      <p className="mt-3 font-medium">{name}</p>
                      <p className="text-sm text-ink-muted" dir="ltr">
                        {d.code}
                        {d.texture && ` · ${d.texture}`}
                      </p>
                      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
                      <p className="mt-1 text-xs text-ink-muted">{c.availability[d.availability][locale]}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        <p className="mt-12 text-xs text-ink-muted">{c.swatchNote[locale]}</p>
      </div>
    </section>
  );
}
