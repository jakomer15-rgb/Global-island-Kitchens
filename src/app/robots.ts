import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/documents",
          "/designers/portal",
          "/designers/sign-in",
          "/designers/register",
          "/ar/designers/portal",
          "/ar/designers/sign-in",
          "/ar/designers/register",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
