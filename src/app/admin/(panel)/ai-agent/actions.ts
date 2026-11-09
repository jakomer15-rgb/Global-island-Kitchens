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
import { requireActor } from "@/server/auth/session";
import { deleteKnowledge, saveKnowledge } from "@/server/chat/knowledge";
import { db } from "@/server/db";

const knowledgeSchema = z.object({
  kind: z.enum(["faq", "policy", "company", "product", "other"]),
  titleEn: z
    .string()
    .trim()
    .min(3, "Enter the question or topic (at least 3 characters).")
    .max(200, "At most 200 characters."),
  bodyEn: formRequired(3000, "Enter the answer or information.").refine(
    (v) => v.length >= 3,
    "At least 3 characters.",
  ),
  titleAr: formText(200),
  bodyAr: formText(3000),
  published: formCheckbox,
  sortOrder: formInt(0, 9999),
});

export async function saveKnowledgeAction(
  id: string | null,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("chat.manage");
  if (id !== null && !CUID.test(id)) return { error: "Invalid entry." };
  const parsed = parseForm(knowledgeSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await runAction(
    () => saveKnowledge(db, actor, id, parsed.data),
    "Saved. The assistant uses it from the next message.",
  );
  if (result.ok) revalidatePath("/admin/ai-agent");
  if (result.ok && id === null) redirect("/admin/ai-agent#knowledge");
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function deleteKnowledgeAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("chat.manage");
  if (!CUID.test(id)) return { error: "Invalid entry." };
  const result = await runAction(() => deleteKnowledge(db, actor, id), "Deleted.");
  if (result.ok) {
    revalidatePath("/admin/ai-agent");
    redirect("/admin/ai-agent#knowledge");
  }
  return result;
}
