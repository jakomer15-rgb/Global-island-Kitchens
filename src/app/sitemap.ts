import type { MetadataRoute } from "next";
import { pages, pathFor } from "@/config/routes";
import { siteUrl } from "@/config/site";
import { galleryOf } from "@/content/projects";
import { localizedPath } from "@/lib/seo";
import { getCatalog } from "@/server/content/catalog";
import { getPortfolio } from "@/server/content/portfolio";
import { getBlogPosts } from "@/server/content/public";

/**
 * A page in both languages: one entry for the English URL and one for the Arabic URL, each listing
 * both as alternates, so search engines discover the Arabic pages directly (not only via hreflang).
 */
function entry(path: string, lastModified?: Date): MetadataRoute.Sitemap {
  const languages = {
    "en-BH": new URL(localizedPath(path, "en"), siteUrl).toString(),
    "ar-BH": new URL(localizedPath(path, "ar"), siteUrl).toString(),
  };
  return [languages["en-BH"], languages["ar-BH"]].map((url) => ({
    url,
    ...(lastModified && { lastModified }),
    alternates: { languages },
  }));
}

/**
 * Built pages in both languages (less product lines staff have hidden), product categories added in
 * the admin, projects that have photos, and the blog once a post is published.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, portfolio, catalog] = await Promise.all([getBlogPosts(), getPortfolio(), getCatalog()]);
  const hidden = new Set(catalog.hiddenPageKeys.map((key) => pathFor(key)));
  return [
    ...Object.values(pages)
      .filter((page) => page.ready && !hidden.has(page.path))
      .flatMap((page) => entry(page.path)),
    ...catalog.products.filter((c) => !c.pageKey).flatMap((c) => entry(c.href!)),
    ...portfolio
      .filter((p) => galleryOf(p).length > 0)
      .flatMap((p) => entry(`${pathFor("projects")}/${p.slug}`)),
    ...(posts.length > 0 ? entry(pathFor("blog")) : []),
    ...posts.flatMap((p) => entry(`${pathFor("blog")}/${p.slug}`, p.updatedAt)),
  ];
}
