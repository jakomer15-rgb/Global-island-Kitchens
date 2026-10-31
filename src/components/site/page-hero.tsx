import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/seo/json-ld";
import { siteUrl } from "@/config/site";
import type { Photo } from "@/content/photos";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/lib/seo";

export interface Crumb {
  label: string;
  path: string;
}

/** Inner-page header: breadcrumb trail (with BreadcrumbList JSON-LD), eyebrow, h1 and intro. */
export async function PageHero({
  locale,
  crumbs,
  eyebrow,
  title,
  intro,
  image,
}: {
  locale: Locale;
  /** Trail after "Home"; the last item is the current page. */
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  intro?: string;
  /** A photo shown beside the heading on wide screens, above it on narrow ones. */
  image?: Photo;
}) {
  const t = await getTranslations({ locale, namespace: "Page" });
  const trail = [{ label: t("home"), path: "/" }, ...crumbs];

  return (
    <header className="relative overflow-hidden border-b border-line">
      {/* Sand panel behind the photo, running to the page edge on wide screens. */}
      {image && <div aria-hidden className="absolute inset-y-0 end-0 hidden w-[30%] bg-sand lg:block" />}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: trail.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.label,
            item: new URL(localizedPath(c.path, locale), siteUrl).toString(),
          })),
        }}
      />
      <div className="relative container-site py-14 md:py-20">
        <div className={image ? "grid items-center gap-12 lg:grid-cols-12" : undefined}>
          <div className={image ? "lg:col-span-6" : undefined}>
            <nav aria-label={t("breadcrumb")}>
              <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
                {trail.map((c, i) => {
                  const last = i === trail.length - 1;
                  return (
                    <li key={c.path} className="flex items-center gap-1.5">
                      {last ? (
                        <span aria-current="page" className="text-charcoal">
                          {c.label}
                        </span>
                      ) : (
                        <>
                          <Link
                            href={c.path}
                            className="underline-offset-4 hover:text-charcoal hover:underline"
                          >
                            {c.label}
                          </Link>
                          <ChevronRight aria-hidden className="size-3.5 rtl:rotate-180" />
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
            <p className="mt-12 flex items-center gap-4 eyebrow text-walnut">
              <span aria-hidden className="h-px w-10 bg-current opacity-60" />
              {eyebrow}
            </p>
            <h1 className="mt-6 max-w-4xl font-display text-display-xl text-balance">{title}</h1>
            {intro && <p className="mt-6 max-w-copy text-lg text-ink-muted">{intro}</p>}
          </div>
          {image && (
            <div className="relative lg:col-span-6">
              <div
                aria-hidden
                className="absolute inset-0 translate-x-4 translate-y-4 border border-oak/70 rtl:-translate-x-4"
              />
              {/* eslint-disable-next-line @next/next/no-img-element -- static file, already optimised */}
              <img
                src={image.src}
                alt={image.alt[locale]}
                width={image.width}
                height={image.height}
                decoding="async"
                className="relative aspect-[4/3] w-full bg-sand-deep object-cover shadow-[0_40px_80px_-40px_rgb(26_23_20/0.5)]"
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
