import type { MetadataRoute } from "next";
import { pages, pathFor } from "@/config/routes";
import { siteUrl } from "@/config/site";
import { localizedPath } from "@/lib/seo";
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

/** Built pages in both languages, plus the blog and its posts once one is published. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getBlogPosts();
  return [
    ...Object.values(pages)
      .filter((page) => page.ready)
      .map((page) => entry(page.path)),
    ...(posts.length > 0 ? [entry(pathFor("blog"))] : []),
    ...posts.map((p) => entry(`${pathFor("blog")}/${p.slug}`, p.updatedAt)),
  ];
}
