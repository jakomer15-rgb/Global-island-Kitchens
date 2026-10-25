import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/site/page-hero";
import { pathFor } from "@/config/routes";
import { blogPage as c } from "@/content/cms";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { getBlogPosts } from "@/server/content/public";

export async function generateMetadata({ params }: PageProps<"/[locale]/blog">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return pageMetadata({
    title: c.metaTitle[locale],
    description: c.metaDescription[locale],
    path: pathFor("blog"),
    locale,
  });
}

const dateFormat = (locale: Locale) =>
  new Intl.DateTimeFormat(locale === "ar" ? "ar-BH" : "en-GB", {
    dateStyle: "long",
    timeZone: "Asia/Bahrain",
  });

/** Published posts; the page doesn't exist until the first one is published. */
export default async function BlogPage({ params }: PageProps<"/[locale]/blog">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const posts = await getBlogPosts();
  if (posts.length === 0) notFound();
  const ar = locale === "ar";

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: c.eyebrow[locale], path: pathFor("blog") }]}
        eyebrow={c.eyebrow[locale]}
        title={c.title[locale]}
        intro={c.intro[locale]}
      />
      <section className="py-16 md:py-24">
        <ul className="container-site grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <li key={p.slug} className="border-t border-charcoal/20 pt-6">
              {p.coverFileId && (
                // eslint-disable-next-line @next/next/no-img-element -- website images are served by /media
                <img
                  src={`/media/${p.coverFileId}`}
                  alt=""
                  loading="lazy"
                  className="mb-5 aspect-[3/2] w-full bg-sand object-cover"
                />
              )}
              <p className="text-sm text-ink-muted">
                {c.published[locale]} {p.publishedAt && dateFormat(locale).format(p.publishedAt)}
              </p>
              <h2 className="mt-2 font-display text-display-md">
                <Link href={`/blog/${p.slug}`} className="hover:text-walnut">
                  {ar ? p.titleAr : p.titleEn}
                </Link>
              </h2>
              {(ar ? p.excerptAr : p.excerptEn) && (
                <p className="mt-3 text-ink-muted">{ar ? p.excerptAr : p.excerptEn}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
