"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import {
  CUID,
  formCheckbox,
  formId,
  formInt,
  formRequired,
  formText,
  parseForm,
  runAction,
} from "@/server/admin/action";
import { deleteMaterial, materialAvailability, materialBoards, saveMaterial } from "@/server/admin/content";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";

const materialSchema = z.object({
  board: z.enum(materialBoards as [string, ...string[]]),
  code: formRequired(40, "Enter the décor code or colour reference."),
  nameEn: formRequired(100, "Enter the English name."),
  nameAr: formText(100),
  descriptionEn: formText(500),
  descriptionAr: formText(500),
  texture: formText(60),
  colourFamily: formText(40),
  swatchHex: formText(7).refine(
    (v) => v === null || /^#[0-9a-fA-F]{6}$/.test(v),
    "Use a colour like #8b6a4f.",
  ),
  imageFileId: formId,
  availability: z.enum(materialAvailability as [string, ...string[]]),
  sortOrder: formInt(0, 9999),
  verified: formCheckbox,
  published: formCheckbox,
});

function revalidateMaterials() {
  revalidatePath("/admin/materials");
  revalidatePath("/[locale]/materials", "page");
}

export async function saveMaterialAction(
  id: string | null,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("materials.manage");
  if (id !== null && !CUID.test(id)) return { error: "Invalid material." };
  const parsed = parseForm(materialSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await runAction(() => saveMaterial(db, actor, id, parsed.data as never), "Material saved.");
  if (result.ok) revalidateMaterials();
  if (result.ok && id === null) redirect("/admin/materials");
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function deleteMaterialAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("materials.manage");
  if (!CUID.test(id)) return { error: "Invalid material." };
  const result = await runAction(() => deleteMaterial(db, actor, id), "Deleted.");
  if (result.ok) {
    revalidateMaterials();
    redirect("/admin/materials");
  }
  return result;
}
