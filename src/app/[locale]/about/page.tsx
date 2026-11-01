import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogItems } from "@/components/site/catalog-items";
import { CtaBand } from "@/components/site/cta-band";
import { PageHero } from "@/components/site/page-hero";
import { company } from "@/config/company";
import { pathFor } from "@/config/routes";
import { about } from "@/content/pages";
import { factoryPhotos } from "@/content/photos";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { getCatalog } from "@/server/content/catalog";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return pageMetadata({
    title: about.metaTitle[locale],
    description: about.metaDescription[locale],
    path: pathFor("about"),
    locale,
  });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [th, tp, catalog] = await Promise.all([
    getTranslations({ locale, namespace: "Hero" }),
    getTranslations({ locale, namespace: "Products" }),
    getCatalog(),
  ]);
  // Machinery grouped by the factory categories staff add in the admin; the profile's list until then.
  const factory = catalog.factory.filter((c) => c.items.length > 0);
  const facts = [
    { value: `${company.yearsOfExperience}+`, label: th("facts.years") },
    { value: `${company.projectsShowcased}+`, label: th("facts.projects") },
    { value: String(company.coreProductLines), label: th("facts.lines") },
    { value: "2", label: about.sitesLabel[locale] },
  ];

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: about.eyebrow[locale], path: pathFor("about") }]}
        eyebrow={about.eyebrow[locale]}
        title={about.title[locale]}
        intro={about.intro[locale]}
      />

      <section className="py-20 md:py-28">
        <div className="container-site grid gap-14 lg:grid-cols-12">
          <div className="space-y-6 text-lg lg:col-span-7">
            {about.story[locale].map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-10 self-start lg:col-span-4 lg:col-start-9">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col-reverse border-t border-charcoal/20 pt-4">
                <dt className="mt-1 text-sm text-ink-muted">{f.label}</dt>
                <dd className="font-display text-display-lg lining-nums tabular-nums" dir="ltr">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="lines-title" className="bg-sand py-20 md:py-28">
        <div className="container-site">
          <h2 id="lines-title" className="font-display text-display-lg">
            {tp("eyebrow")}
          </h2>
          <p className="mt-4 max-w-copy text-ink-muted">{tp("intro")}</p>
          <ul className="mt-10 flex flex-wrap gap-3">
            {about.productLines[locale].map((line) => (
              <li key={line} className="border border-charcoal/20 px-4 py-2 text-sm">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="team-title" className="py-20 md:py-28">
        <div className="container-site grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 id="team-title" className="font-display text-display-lg text-balance">
              {about.teamTitle[locale]}
            </h2>
          </div>
          <ol className="lg:col-span-6 lg:col-start-7">
            {about.team[locale].map((role, i) => (
              <li key={role} className="flex items-baseline gap-6 border-t border-line py-5">
                <span className="eyebrow text-walnut tabular-nums" dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-display-md">{role}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="factory-title" className="bg-charcoal py-20 text-ivory md:py-28">
        <div className="container-site">
          <h2 id="factory-title" className="font-display text-display-lg">
            {about.factoryTitle[locale]}
          </h2>
          <p className="mt-4 max-w-copy text-ivory/75">{about.factoryIntro[locale]}</p>
          {factory.length > 0 ? (
            factory.map((group) => (
              <div key={group.id} className="mt-14">
                <h3 className="border-b border-ivory/20 pb-4 font-display text-display-md">
                  {group.name[locale]}
                </h3>
                {group.description && (
                  <p className="mt-3 max-w-copy text-ivory/75">{group.description[locale]}</p>
                )}
                <div className="mt-10">
                  <CatalogItems items={group.items} locale={locale} tone="light" />
                </div>
              </div>
            ))
          ) : (
            <ul className="mt-12 grid gap-px bg-ivory/12 sm:grid-cols-2 lg:grid-cols-4">
              {about.machines[locale].map((m, i) => (
                <li key={m} className="bg-charcoal p-6 md:p-8">
                  {factoryPhotos[i] && (
                    // eslint-disable-next-line @next/next/no-img-element -- static file, already optimised
                    <img
                      src={factoryPhotos[i].src}
                      alt={factoryPhotos[i].alt[locale]}
                      width={factoryPhotos[i].width}
                      height={factoryPhotos[i].height}
                      loading="lazy"
                      decoding="async"
                      className="mb-6 aspect-[3/2] w-full bg-white object-contain"
                    />
                  )}
                  <span className="eyebrow text-walnut-soft tabular-nums" dir="ltr">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-6 font-display text-display-md">{m}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <CtaBand locale={locale} />
    </>
  );
}
