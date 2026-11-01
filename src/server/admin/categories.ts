import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import type { Db, Tx } from "@/server/db/client";
import { NotFoundError, RuleError } from "@/server/errors";
import type { CategorySection, Prisma } from "@/generated/prisma/client";

/**
 * Website categories in three sections: products (each gets a page and a tile on the homepage),
 * projects (group the portfolio) and factory (group the machinery on the About page). Product and
 * factory categories hold items: products and machines. The built-in product lines (with a
 * `pageKey`) keep their address and can be hidden but not deleted.
 */

export const categorySections: CategorySection[] = ["products", "projects", "factory"];

export const sectionLabels: Record<CategorySection, { title: string; item: string; items: string }> = {
  products: { title: "Products", item: "product", items: "products" },
  projects: { title: "Projects", item: "project", items: "projects" },
  factory: { title: "Factory", item: "machine", items: "machines" },
};

export interface CategoryInput {
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  imageFileId: string | null;
  published: boolean;
}

export interface ItemInput {
  categoryId: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  imageFileId: string | null;
  published: boolean;
}

const changed = (before: Record<string, unknown> | null, after: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(after).filter(
      ([k, v]) => JSON.stringify(before?.[k] ?? null) !== JSON.stringify(v ?? null),
    ),
  ) as Prisma.InputJsonObject;

async function assertImage(tx: Tx, fileId: string | null) {
  if (!fileId) return;
  const ok = await tx.fileAsset.count({
    where: { id: fileId, kind: "catalog_image", visibility: "public", status: "verified" },
  });
  if (!ok)
    throw new RuleError("image", "Choose an image from Website images (Category, product or machine).");
}

// ─── Categories ─────────────────────────────────────────────────────────────

export async function listCategories(db: Db, actor: Actor, section: CategorySection) {
  assertCan(actor, "catalog.manage");
  return db.category.findMany({
    where: { section },
    include: { _count: { select: { items: true, projects: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getCategoryForEdit(db: Db, actor: Actor, id: string) {
  assertCan(actor, "catalog.manage");
  const category = await db.category.findUnique({
    where: { id },
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      projects: {
        select: { id: true, nameEn: true, locationEn: true, published: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!category) throw new NotFoundError("Category");
  return category;
}

export async function saveCategory(
  db: Db,
  actor: Actor,
  target: { id: string } | { section: CategorySection },
  input: CategoryInput,
) {
  assertCan(actor, "catalog.manage");
  return db.$transaction(async (tx) => {
    const before = "id" in target ? await tx.category.findUnique({ where: { id: target.id } }) : null;
    if ("id" in target && !before) throw new NotFoundError("Category");
    const section = before?.section ?? (target as { section: CategorySection }).section;
    await assertImage(tx, input.imageFileId);
    // A built-in product line's address is fixed by its page in the code.
    const data = { ...input, slug: before?.pageKey ? before.slug : input.slug };
    const clash = await tx.category.findFirst({
      where: { section, slug: data.slug, ...(before && { id: { not: before.id } }) },
      select: { id: true },
    });
    if (clash) throw new RuleError("slug", "Another category in this section already uses this web address.");
    let saved;
    if (before) {
      saved = await tx.category.update({ where: { id: before.id }, data });
    } else {
      const last = await tx.category.aggregate({ where: { section }, _max: { sortOrder: true } });
      saved = await tx.category.create({
        data: { ...data, section, sortOrder: (last._max.sortOrder ?? -1) + 1 },
      });
    }
    await audit(tx, {
      actorId: actor.id,
      action: before ? "category.updated" : "category.created",
      entityType: "category",
      entityId: saved.id,
      changes: changed(before, before ? data : { ...data, section }),
    });
    return saved;
  });
}

/** Deletes a category with nothing in it. Its projects stay in the portfolio, without a category. */
export async function deleteCategory(db: Db, actor: Actor, id: string) {
  assertCan(actor, "catalog.manage");
  return db.$transaction(async (tx) => {
    const c = await tx.category.findUnique({
      where: { id },
      include: { _count: { select: { items: true, projects: true } } },
    });
    if (!c) throw new NotFoundError("Category");
    if (c.pageKey)
      throw new RuleError(
        "built_in",
        "This product line has its own page, so it can't be deleted. Untick “Show on the website” to hide it.",
      );
    if (c._count.items > 0) {
      const what = sectionLabels[c.section];
      throw new RuleError(
        "not_empty",
        `Move or delete its ${c._count.items} ${c._count.items === 1 ? what.item : what.items} first.`,
      );
    }
    await tx.category.delete({ where: { id } });
    await audit(tx, {
      actorId: actor.id,
      action: "category.deleted",
      entityType: "category",
      entityId: id,
      changes: { section: c.section, slug: c.slug, nameEn: c.nameEn, projects: c._count.projects },
    });
    return c;
  });
}

/** Swaps a row with its neighbour, then renumbers the whole list 0, 1, 2… */
async function reorder(
  rows: { id: string }[],
  id: string,
  direction: "up" | "down",
  write: (id: string, sortOrder: number) => Promise<unknown>,
) {
  const from = rows.findIndex((r) => r.id === id);
  if (from < 0) throw new NotFoundError("Row");
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= rows.length) return false;
  const order = [...rows];
  [order[from], order[to]] = [order[to]!, order[from]!];
  for (const [i, row] of order.entries()) await write(row.id, i);
  return true;
}

export async function moveCategory(db: Db, actor: Actor, id: string, direction: "up" | "down") {
  assertCan(actor, "catalog.manage");
  return db.$transaction(async (tx) => {
    const c = await tx.category.findUnique({ where: { id }, select: { section: true } });
    if (!c) throw new NotFoundError("Category");
    const rows = await tx.category.findMany({
      where: { section: c.section },
      select: { id: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const moved = await reorder(rows, id, direction, (rowId, sortOrder) =>
      tx.category.update({ where: { id: rowId }, data: { sortOrder } }),
    );
    if (moved)
      await audit(tx, {
        actorId: actor.id,
        action: "category.reordered",
        entityType: "category",
        entityId: id,
        changes: { direction },
      });
    return c.section;
  });
}

// ─── Products and machines ──────────────────────────────────────────────────

async function assertHoldsItems(tx: Tx, categoryId: string) {
  const c = await tx.category.findUnique({ where: { id: categoryId }, select: { section: true } });
  if (!c) throw new RuleError("category", "Choose a category.");
  if (c.section === "projects")
    throw new RuleError(
      "category",
      "Project categories hold portfolio projects. Choose a product or factory category.",
    );
  return c.section;
}

export async function getItemForEdit(db: Db, actor: Actor, id: string) {
  assertCan(actor, "catalog.manage");
  const item = await db.catalogItem.findUnique({ where: { id }, include: { category: true } });
  if (!item) throw new NotFoundError("Item");
  return item;
}

/** Categories an item can move to: the ones in the same section. */
export async function itemCategoryOptions(db: Db, actor: Actor, section: CategorySection) {
  assertCan(actor, "catalog.manage");
  return db.category.findMany({
    where: { section },
    select: { id: true, nameEn: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function saveItem(db: Db, actor: Actor, id: string | null, input: ItemInput) {
  assertCan(actor, "catalog.manage");
  return db.$transaction(async (tx) => {
    const before = id
      ? await tx.catalogItem.findUnique({ where: { id }, include: { category: true } })
      : null;
    if (id && !before) throw new NotFoundError("Item");
    const section = await assertHoldsItems(tx, input.categoryId);
    if (before && before.category.section !== section)
      throw new RuleError("category", "Products and machines stay in their own section.");
    await assertImage(tx, input.imageFileId);
    let saved;
    if (before && before.categoryId === input.categoryId) {
      saved = await tx.catalogItem.update({ where: { id: before.id }, data: input });
    } else {
      // New, or moved to another category: goes to the end of that category's list.
      const last = await tx.catalogItem.aggregate({
        where: { categoryId: input.categoryId },
        _max: { sortOrder: true },
      });
      const data = { ...input, sortOrder: (last._max.sortOrder ?? -1) + 1 };
      saved = before
        ? await tx.catalogItem.update({ where: { id: before.id }, data })
        : await tx.catalogItem.create({ data });
    }
    await audit(tx, {
      actorId: actor.id,
      action: before ? "catalog_item.updated" : "catalog_item.created",
      entityType: "catalog_item",
      entityId: saved.id,
      changes: changed(before, { ...input }),
    });
    return saved;
  });
}

export async function deleteItem(db: Db, actor: Actor, id: string) {
  assertCan(actor, "catalog.manage");
  return db.$transaction(async (tx) => {
    const item = await tx.catalogItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundError("Item");
    await tx.catalogItem.delete({ where: { id } });
    await audit(tx, {
      actorId: actor.id,
      action: "catalog_item.deleted",
      entityType: "catalog_item",
      entityId: id,
      changes: { categoryId: item.categoryId, nameEn: item.nameEn },
    });
    return item.categoryId;
  });
}

export async function moveItem(db: Db, actor: Actor, id: string, direction: "up" | "down") {
  assertCan(actor, "catalog.manage");
  return db.$transaction(async (tx) => {
    const item = await tx.catalogItem.findUnique({ where: { id }, select: { categoryId: true } });
    if (!item) throw new NotFoundError("Item");
    const rows = await tx.catalogItem.findMany({
      where: { categoryId: item.categoryId },
      select: { id: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    await reorder(rows, id, direction, (rowId, sortOrder) =>
      tx.catalogItem.update({ where: { id: rowId }, data: { sortOrder } }),
    );
    return item.categoryId;
  });
}

// ─── Portfolio ──────────────────────────────────────────────────────────────

/** Project categories for the portfolio form (staff who edit projects may not manage categories). */
export async function projectCategoryOptions(db: Db, actor: Actor) {
  assertCan(actor, "portfolio.manage");
  return db.category.findMany({
    where: { section: "projects" },
    select: { id: true, nameEn: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function assertProjectCategory(tx: Tx, categoryId: string | null) {
  if (!categoryId) return;
  const ok = await tx.category.count({ where: { id: categoryId, section: "projects" } });
  if (!ok) throw new RuleError("category", "Choose one of the project categories.");
}

// ─── Public ─────────────────────────────────────────────────────────────────

const imageSelect = { select: { id: true, visibility: true, status: true } } as const;

/** Id of an image that may be shown publicly, else null. */
export const publicImageId = (image: { id: string; visibility: string; status: string } | null) =>
  image && image.visibility === "public" && image.status === "verified" ? image.id : null;

/**
 * Public: every category with its published items, in order. Hidden categories are included (with
 * `published: false`) so a hidden built-in product line's page can return 404; callers filter them.
 */
export async function publicCategories(db: Db) {
  return db.category.findMany({
    select: {
      id: true,
      section: true,
      slug: true,
      pageKey: true,
      published: true,
      nameEn: true,
      nameAr: true,
      descriptionEn: true,
      descriptionAr: true,
      image: imageSelect,
      items: {
        where: { published: true },
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
          descriptionEn: true,
          descriptionAr: true,
          image: imageSelect,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      projects: { where: { published: true }, select: { slug: true }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}
