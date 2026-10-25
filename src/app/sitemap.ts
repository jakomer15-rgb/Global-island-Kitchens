import type { MetadataRoute } from "next";
import { pages } from "@/config/routes";
import { siteUrl } from "@/config/site";
import { localizedPath } from "@/lib/seo";

/** Built pages only, in both languages. */
export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(pages)
    .filter((page) => page.ready)
    .map((page) => ({
      url: new URL(localizedPath(page.path, "en"), siteUrl).toString(),
      alternates: {
        languages: {
          "en-BH": new URL(localizedPath(page.path, "en"), siteUrl).toString(),
          "ar-BH": new URL(localizedPath(page.path, "ar"), siteUrl).toString(),
        },
      },
    }));
}
