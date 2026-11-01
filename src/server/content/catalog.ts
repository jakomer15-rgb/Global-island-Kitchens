import "server-only";
import { cache } from "react";
import { pathFor } from "@/config/routes";
import { builtInCategories, categoryPagePrefix, type CatalogCategory } from "@/content/categories";
import { productPhotos, type Photo } from "@/content/photos";
import type { ProductKey } from "@/content/products";
import type { L } from "@/content/types";
import { publicCategories, publicImageId } from "@/server/admin/categories";
import { mediaUrl } from "@/server/admin/media";
import { db } from "@/server/db";
import { reason } from "@/server/errors";

/**
 * Categories for the public pages, managed in the admin. The built-in product lines are always
 * there: if the database can't be reached, or a line hasn't been seeded yet, the copy from the code
 * is used, so the menu and product pages never lose a category.
 */

export interface Catalog {
  products: CatalogCategory[];
  projects: CatalogCategory[];
  factory: CatalogCategory[];
  /** Built-in product lines staff have hidden: their pages return 404. */
  hiddenPageKeys: ProductKey[];
}

/** Uploaded images have no stored size; the layouts crop them to a fixed ratio. */
const uploaded = (id: string | null, alt: L): Photo | null =>
  id ? { src: mediaUrl(id), width: 1200, height: 900, alt } : null;

/** Arabic falls back to the English text when only English was entered. */
const text = (en: string | null, ar: string | null): L | null => (en ? { en, ar: ar || en } : null);

function builtIn(b: (typeof builtInCategories)[number]): CatalogCategory {
  return {
    id: b.pageKey,
    section: "products",
    slug: b.slug,
    pageKey: b.pageKey,
    href: pathFor(b.pageKey),
    name: b.name,
    description: b.description,
    image: productPhotos[b.pageKey] ?? null,
    items: [],
    projectSlugs: [],
  };
}

export const getCatalog = cache(async (): Promise<Catalog> => {
  let rows: Awaited<ReturnType<typeof publicCategories>>;
  try {
    rows = await publicCategories(db);
  } catch (error) {
    console.warn("Categories unavailable, using the built-in product lines:", reason(error));
    return { products: builtInCategories.map(builtIn), projects: [], factory: [], hiddenPageKeys: [] };
  }

  const known = new Set(rows.map((r) => r.pageKey));
  const missing = builtInCategories.filter((b) => !known.has(b.pageKey)).map(builtIn);
  const categories = rows
    .filter((r) => r.published)
    .map((r): CatalogCategory => {
      const pageKey = r.pageKey as ProductKey | null;
      const name = { en: r.nameEn, ar: r.nameAr };
      return {
        id: r.id,
        section: r.section,
        slug: r.slug,
        pageKey,
        href:
          r.section !== "products" ? null : pageKey ? pathFor(pageKey) : `${categoryPagePrefix}/${r.slug}`,
        name,
        description: text(r.descriptionEn, r.descriptionAr),
        image: uploaded(publicImageId(r.image), name) ?? (pageKey ? (productPhotos[pageKey] ?? null) : null),
        items: r.items.map((i) => {
          const itemName = { en: i.nameEn, ar: i.nameAr };
          return {
            id: i.id,
            name: itemName,
            description: text(i.descriptionEn, i.descriptionAr),
            image: uploaded(publicImageId(i.image), itemName),
          };
        }),
        projectSlugs: r.projects.map((p) => p.slug),
      };
    });

  return {
    products: [...missing, ...categories.filter((c) => c.section === "products")],
    projects: categories.filter((c) => c.section === "projects"),
    factory: categories.filter((c) => c.section === "factory"),
    hiddenPageKeys: rows.filter((r) => r.pageKey && !r.published).map((r) => r.pageKey as ProductKey),
  };
});

/** A product category by its built-in page key; null when staff have hidden it. */
export async function getBuiltInCategory(pageKey: ProductKey) {
  const catalog = await getCatalog();
  if (catalog.hiddenPageKeys.includes(pageKey)) return null;
  return (
    catalog.products.find((c) => c.pageKey === pageKey) ??
    builtIn(builtInCategories.find((b) => b.pageKey === pageKey)!)
  );
}

/** A product category with its own page at /products/<slug>. */
export async function getProductCategory(slug: string) {
  return (await getCatalog()).products.find((c) => !c.pageKey && c.slug === slug) ?? null;
}
