// Relative imports only: the seed (prisma/seed.ts) runs this file outside Next.js.
import ar from "../messages/ar.json";
import en from "../messages/en.json";
import { productNavKeys } from "../components/site/nav-items";
import type { Photo } from "./photos";
import type { ProductKey } from "./products";
import type { L } from "./types";

/** A category, product or machine as the public pages show it (loaded by src/server/content/catalog.ts). */
export interface CatalogEntry {
  id: string;
  name: L;
  description: L | null;
  image: Photo | null;
}

export interface CatalogCategory extends CatalogEntry {
  section: "products" | "projects" | "factory";
  slug: string;
  /** Set for the product lines with a page in the code. */
  pageKey: ProductKey | null;
  /** The category's page (product categories only). */
  href: string | null;
  items: CatalogEntry[];
  /** Published portfolio projects in a project category. */
  projectSlugs: string[];
}

/**
 * The product lines that have a page built in code. They are the first product categories: the
 * seed adds them to the database (linked by page key), where staff can rename, reorder, illustrate
 * or hide them. If the database can't be reached, the site shows this list instead.
 */
export interface BuiltInCategory {
  pageKey: ProductKey;
  slug: string;
  name: L;
  description: L;
}

const slugOf = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export const builtInCategories: BuiltInCategory[] = productNavKeys.map((key) => ({
  pageKey: key,
  slug: slugOf(key),
  name: { en: en.Products.items[key].name, ar: ar.Products.items[key].name },
  description: { en: en.Products.items[key].body, ar: ar.Products.items[key].body },
}));

/** Path of a product category's page: the built-in page, or /products/<slug> for the others. */
export const categoryPagePrefix = "/products";
