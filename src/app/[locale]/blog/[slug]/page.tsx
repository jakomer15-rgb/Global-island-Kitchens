import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { BlogBody } from "@/components/site/blog-body";
import { PageHero } from "@/components/site/page-hero";
import { JsonLd } from "@/components/seo/json-ld";
import { pathFor } from "@/config/routes";
import { siteUrl } from "@/config/site";
import { blogPage as c } from "@/content/cms";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { localizedPath, pageMetadata } from "@/lib/seo";
import { getBlogPost, getBlogPosts } from "@/server/content/public";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function generateStaticParams() {
  return (await getBlogPosts()).map((p) => ({ slug: p.slug }));
}

async function load(params: PageProps<"/[locale]/blog/[slug]">["params"]) {
  const { locale, slug } = await params;
  if (!SLUG.test(slug)) return null;
  const post = await getBlogPost(slug);
  return post && { post, locale: locale as Locale };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/blog/[slug]">): Promise<Metadata> {
  const found = await load(params);
  if (!found) return {};
  const { post, locale } = found;
  const ar = locale === "ar";
  return pageMetadata({
    title: (ar ? post.titleAr : post.titleEn) ?? post.titleEn,
    description: (ar ? post.excerptAr : post.excerptEn) ?? c.metaDescription[locale],
    path: `${pathFor("blog")}/${post.slug}`,
    locale,
  });
}

export default async function BlogPostPage({ params }: PageProps<"/[locale]/blog/[slug]">) {
  const found = await load(params);
  if (!found) notFound();
  const { post, locale } = found;
  setRequestLocale(locale);
  const ar = locale === "ar";
  const title = (ar ? post.titleAr : post.titleEn) ?? post.titleEn;
  const path = `${pathFor("blog")}/${post.slug}`;
  const date = post.publishedAt
    ? new Intl.DateTimeFormat(ar ? "ar-BH" : "en-GB", { dateStyle: "long", timeZone: "Asia/Bahrain" }).format(
        post.publishedAt,
      )
    : null;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: title,
          datePublished: post.publishedAt?.toISOString(),
          dateModified: post.updatedAt.toISOString(),
          inLanguage: ar ? "ar-BH" : "en-BH",
          mainEntityOfPage: new URL(localizedPath(path, locale), siteUrl).toString(),
          publisher: { "@id": `${siteUrl}/#organization` },
        }}
      />
      <PageHero
        locale={locale}
        crumbs={[
          { label: c.eyebrow[locale], path: pathFor("blog") },
          { label: title, path },
        ]}
        eyebrow={date ? `${c.published[locale]} ${date}` : c.eyebrow[locale]}
        title={title}
        intro={(ar ? post.excerptAr : post.excerptEn) ?? undefined}
      />
      <article className="container-site max-w-3xl py-16 md:py-24">
        {post.coverFileId && (
          // eslint-disable-next-line @next/next/no-img-element -- website images are served by /media
          <img
            src={`/media/${post.coverFileId}`}
            alt=""
            className="mb-12 aspect-[3/2] w-full bg-sand object-cover"
          />
        )}
        <BlogBody text={(ar ? post.bodyAr : post.bodyEn) ?? post.bodyEn} />
        <p className="mt-16 border-t border-line pt-6">
          <Link href={pathFor("blog")} className="underline underline-offset-4">
            {c.back[locale]}
          </Link>
        </p>
      </article>
    </>
  );
}
