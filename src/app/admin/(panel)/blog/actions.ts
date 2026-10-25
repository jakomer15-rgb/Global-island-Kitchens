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
import { deleteBlogPost, saveBlogPost } from "@/server/admin/content";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";

const postSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and hyphens, e.g. choosing-egger-decors.",
    )
    .max(80),
  titleEn: formRequired(120, "Enter the English title."),
  titleAr: formText(120),
  excerptEn: formText(300),
  excerptAr: formText(300),
  bodyEn: formRequired(20000, "Write the English text."),
  bodyAr: formText(20000),
  coverFileId: formId,
  published: formCheckbox,
});

function revalidateBlog() {
  revalidatePath("/admin/blog");
  revalidatePath("/[locale]/blog", "page");
  revalidatePath("/[locale]/blog/[slug]", "page");
  revalidatePath("/sitemap.xml");
}

export async function savePostAction(
  id: string | null,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("content.manage");
  if (id !== null && !CUID.test(id)) return { error: "Invalid post." };
  const parsed = parseForm(postSchema, formData);
  if (!parsed.ok) return parsed.state;
  let saved: Awaited<ReturnType<typeof saveBlogPost>> | undefined;
  const result = await runAction(async () => {
    saved = await saveBlogPost(db, actor, id, parsed.data);
  }, "Post saved.");
  if (result.ok && saved) revalidateBlog();
  if (result.ok && id === null && saved) redirect(`/admin/blog/${saved.id}`);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function deletePostAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("content.manage");
  if (!CUID.test(id)) return { error: "Invalid post." };
  const result = await runAction(() => deleteBlogPost(db, actor, id), "Deleted.");
  if (result.ok) {
    revalidateBlog();
    redirect("/admin/blog");
  }
  return result;
}
