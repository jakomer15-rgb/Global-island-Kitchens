import { pathFor } from "@/config/routes";
import { categoryPagePrefix } from "@/content/categories";
import type { ProductKey } from "@/content/products";
import type { CategorySection } from "@/generated/prisma/client";

/** The public page of a product category (other sections have none). */
export function categoryPath(c: { section: CategorySection; slug: string; pageKey: string | null }) {
  if (c.section !== "products") return null;
  return c.pageKey ? pathFor(c.pageKey as ProductKey) : `${categoryPagePrefix}/${c.slug}`;
}
