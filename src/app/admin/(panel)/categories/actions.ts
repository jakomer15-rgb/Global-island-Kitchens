"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import {
  CUID,
  formCheckbox,
  formId,
  formRequired,
  formText,
  parseForm,
  runAction,
} from "@/server/admin/action";
import {
  categorySections,
  deleteCategory,
  deleteItem,
  moveCategory,
  moveItem,
  saveCategory,
  saveItem,
} from "@/server/admin/categories";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import type { CategorySection } from "@/generated/prisma/client";

const categorySchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.")
    .max(80),
  nameEn: formRequired(80, "Enter the English name."),
  nameAr: formRequired(80, "Enter the Arabic name."),
  descriptionEn: formText(400),
  descriptionAr: formText(400),
  imageFileId: formId,
  published: formCheckbox,
});

const itemSchema = z.object({
  categoryId: z.string().regex(CUID, "Choose a category."),
  nameEn: formRequired(120, "Enter the English name."),
  nameAr: formRequired(120, "Enter the Arabic name."),
  descriptionEn: formText(600),
  descriptionAr: formText(600),
  imageFileId: formId,
  published: formCheckbox,
});

const direction = z.enum(["up", "down"]);

/** Categories show in the menu and footer of every page, so the whole site is refreshed. */
function revalidateCatalog(categoryId?: string) {
  revalidatePath("/admin/categories");
  if (categoryId) revalidatePath(`/admin/categories/${categoryId}`);
  revalidatePath("/admin/portfolio");
  revalidatePath("/[locale]", "layout");
  revalidatePath("/sitemap.xml");
}

export async function saveCategoryAction(
  target: { id: string } | { section: CategorySection },
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("catalog.manage");
  if ("id" in target ? !CUID.test(target.id) : !categorySections.includes(target.section))
    return { error: "Invalid category." };
  const parsed = parseForm(categorySchema, formData);
  if (!parsed.ok) return parsed.state;
  let savedId: string | undefined;
  const result = await runAction(async () => {
    savedId = (await saveCategory(db, actor, target, parsed.data)).id;
  }, "Category saved.");
  if (result.ok) revalidateCatalog(savedId);
  if (result.ok && !("id" in target) && savedId) redirect(`/admin/categories/${savedId}`);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function deleteCategoryAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("catalog.manage");
  if (!CUID.test(id)) return { error: "Invalid category." };
  let section: CategorySection | undefined;
  const result = await runAction(async () => {
    section = (await deleteCategory(db, actor, id)).section;
  }, "Deleted.");
  if (result.ok) {
    revalidateCatalog();
    redirect(`/admin/categories?section=${section}`);
  }
  return result;
}

export async function moveCategoryAction(
  id: string,
  dir: "up" | "down",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
  _: ActionState,
): Promise<ActionState> {
  const actor = await requireActor("catalog.manage");
  if (!CUID.test(id) || !direction.safeParse(dir).success) return { error: "Invalid category." };
  const result = await runAction(() => moveCategory(db, actor, id, dir), "Moved.");
  if (result.ok) revalidateCatalog();
  return result;
}

export async function saveItemAction(
  id: string | null,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("catalog.manage");
  if (id !== null && !CUID.test(id)) return { error: "Invalid item." };
  const parsed = parseForm(itemSchema, formData);
  if (!parsed.ok) return parsed.state;
  let categoryId: string | undefined;
  const result = await runAction(async () => {
    categoryId = (await saveItem(db, actor, id, parsed.data)).categoryId;
  }, "Saved.");
  if (result.ok) {
    revalidateCatalog(categoryId);
    if (id) revalidatePath(`/admin/categories/items/${id}`);
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function deleteItemAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("catalog.manage");
  if (!CUID.test(id)) return { error: "Invalid item." };
  let categoryId: string | undefined;
  const result = await runAction(async () => {
    categoryId = await deleteItem(db, actor, id);
  }, "Deleted.");
  if (result.ok && categoryId) {
    revalidateCatalog(categoryId);
    redirect(`/admin/categories/${categoryId}`);
  }
  return result;
}

export async function moveItemAction(
  id: string,
  dir: "up" | "down",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
  _: ActionState,
): Promise<ActionState> {
  const actor = await requireActor("catalog.manage");
  if (!CUID.test(id) || !direction.safeParse(dir).success) return { error: "Invalid item." };
  let categoryId: string | undefined;
  const result = await runAction(async () => {
    categoryId = await moveItem(db, actor, id, dir);
  }, "Moved.");
  if (result.ok) revalidateCatalog(categoryId);
  return result;
}
