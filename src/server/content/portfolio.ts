import "server-only";
import { cache } from "react";
import { projectPhotos } from "@/content/photos";
import { projects as builtIn, type Project } from "@/content/projects";
import type { ScopeTag } from "@/content/products";
import { publicProjects } from "@/server/admin/portfolio";
import { db } from "@/server/db";
import { reason } from "@/server/errors";

/**
 * The public portfolio, managed in the admin (seeded from src/content/projects.ts). If the
 * database can't be reached when a page is rendered, the built-in list from the company profile
 * is used instead, so the projects pages never break.
 */
export const getPortfolio = cache(async (): Promise<Project[]> => {
  try {
    const rows = await publicProjects(db);
    return rows.map((p) => ({
      slug: p.slug,
      segment: p.segment,
      name: { en: p.nameEn, ar: p.nameAr },
      location: { en: p.locationEn, ar: p.locationAr },
      ...(p.sizeEn && p.sizeAr ? { size: { en: p.sizeEn, ar: p.sizeAr } } : {}),
      scope: p.scopeTags as ScopeTag[],
      scopeText: { en: p.scopeEn, ar: p.scopeAr },
      featured: p.featured,
      ...(p.clientName && p.clientNamePermission ? { clientName: p.clientName } : {}),
      images: p.images.map((i) => ({ fileId: i.fileId, alt: { en: i.altEn, ar: i.altAr } })),
      ...(projectPhotos[p.slug] ? { photos: projectPhotos[p.slug] } : {}),
    }));
  } catch (error) {
    console.warn("Portfolio unavailable, using the built-in list:", reason(error));
    return builtIn.map((p) => ({
      ...p,
      ...(projectPhotos[p.slug] ? { photos: projectPhotos[p.slug] } : {}),
    }));
  }
});
