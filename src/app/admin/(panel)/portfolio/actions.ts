"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import {
  CUID,
  formCheckbox,
  formInt,
  formRequired,
  formText,
  parseForm,
  runAction,
} from "@/server/admin/action";
import {
  addProjectImage,
  deleteProject,
  removeProjectImage,
  saveProject,
  segments,
} from "@/server/admin/portfolio";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";

const projectSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.")
    .max(80),
  segment: z.enum(segments as [string, ...string[]]),
  nameEn: formRequired(120, "Enter the English name."),
  nameAr: formRequired(120, "Enter the Arabic name."),
  locationEn: formRequired(120, "Enter the location in English."),
  locationAr: formRequired(120, "Enter the location in Arabic."),
  sizeEn: formText(200),
  sizeAr: formText(200),
  scopeEn: formRequired(300, "Describe the scope in English."),
  scopeAr: formRequired(300, "Describe the scope in Arabic."),
  scopeTags: z.preprocess(
    (v) => (v === undefined ? [] : ([] as unknown[]).concat(v)),
    z.array(z.string().max(30)).max(10),
  ),
  clientName: formText(120),
  clientNamePermission: formCheckbox,
  featured: formCheckbox,
  published: formCheckbox,
  sortOrder: formInt(0, 9999),
});

function revalidatePortfolio() {
  revalidatePath("/admin/portfolio");
  // Projects appear on the homepage, product pages, the designers page and the projects pages.
  revalidatePath("/[locale]", "layout");
}

export async function saveProjectAction(
  id: string | null,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("portfolio.manage");
  if (id !== null && !CUID.test(id)) return { error: "Invalid project." };
  const parsed = parseForm(projectSchema, formData);
  if (!parsed.ok) return parsed.state;
  let newId: string | undefined;
  const result = await runAction(async () => {
    newId = await saveProject(db, actor, id, parsed.data as never);
  }, "Project saved.");
  if (result.ok) revalidatePortfolio();
  if (result.ok && id === null && newId) redirect(`/admin/portfolio/${newId}`);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function deleteProjectAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("portfolio.manage");
  if (!CUID.test(id)) return { error: "Invalid project." };
  const result = await runAction(() => deleteProject(db, actor, id), "Deleted.");
  if (result.ok) {
    revalidatePortfolio();
    redirect("/admin/portfolio");
  }
  return result;
}

const imageSchema = z.object({
  fileId: z.string().regex(CUID, "Choose a photo."),
  altEn: formRequired(160, "Describe the photo in English (for screen readers)."),
  altAr: formRequired(160, "Describe the photo in Arabic."),
  usagePermission: formCheckbox,
});

export async function addImageAction(
  projectId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("portfolio.manage");
  if (!CUID.test(projectId)) return { error: "Invalid project." };
  const parsed = parseForm(imageSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await runAction(
    () => addProjectImage(db, actor, { projectId, ...parsed.data }),
    "Photo added.",
  );
  if (result.ok) {
    revalidatePortfolio();
    revalidatePath(`/admin/portfolio/${projectId}`);
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function removeImageAction(imageId: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("portfolio.manage");
  if (!CUID.test(imageId)) return { error: "Invalid photo." };
  let projectId: string | undefined;
  const result = await runAction(async () => {
    projectId = await removeProjectImage(db, actor, imageId);
  }, "Photo removed.");
  if (result.ok) {
    revalidatePortfolio();
    if (projectId) revalidatePath(`/admin/portfolio/${projectId}`);
  }
  return result;
}
