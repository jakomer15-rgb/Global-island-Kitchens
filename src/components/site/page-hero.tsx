import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/seo/json-ld";
import { siteUrl } from "@/config/site";
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
}: {
  locale: Locale;
  /** Trail after "Home"; the last item is the current page. */
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  const t = await getTranslations({ locale, namespace: "Page" });
  const trail = [{ label: t("home"), path: "/" }, ...crumbs];

  return (
    <header className="border-b border-line">
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
      <div className="container-site py-14 md:py-20">
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
                      <Link href={c.path} className="underline-offset-4 hover:text-charcoal hover:underline">
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
        <p className="mt-10 eyebrow text-walnut">{eyebrow}</p>
        <h1 className="mt-6 max-w-4xl font-display text-display-xl text-balance">{title}</h1>
        {intro && <p className="mt-6 max-w-copy text-lg text-ink-muted">{intro}</p>}
      </div>
    </header>
  );
}
