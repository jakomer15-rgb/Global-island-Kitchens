import type { MetadataRoute } from "next";
import { pages, pathFor } from "@/config/routes";
import { siteUrl } from "@/config/site";
import { galleryOf } from "@/content/projects";
import { localizedPath } from "@/lib/seo";
import { getPortfolio } from "@/server/content/portfolio";
import { getBlogPosts } from "@/server/content/public";

function entry(path: string, lastModified?: Date): MetadataRoute.Sitemap[number] {
  return {
    url: new URL(localizedPath(path, "en"), siteUrl).toString(),
    ...(lastModified && { lastModified }),
    alternates: {
      languages: {
        "en-BH": new URL(localizedPath(path, "en"), siteUrl).toString(),
        "ar-BH": new URL(localizedPath(path, "ar"), siteUrl).toString(),
      },
    },
  };
}

/** Built pages in both languages, projects that have photos, and the blog once a post is published. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, portfolio] = await Promise.all([getBlogPosts(), getPortfolio()]);
  return [
    ...Object.values(pages)
      .filter((page) => page.ready)
      .map((page) => entry(page.path)),
    ...portfolio.filter((p) => galleryOf(p).length > 0).map((p) => entry(`${pathFor("projects")}/${p.slug}`)),
    ...(posts.length > 0 ? [entry(pathFor("blog"))] : []),
    ...posts.map((p) => entry(`${pathFor("blog")}/${p.slug}`, p.updatedAt)),
  ];
}
