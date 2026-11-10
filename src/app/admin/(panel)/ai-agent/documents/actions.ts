"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import { CUID, parseForm, runAction } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  deleteDocument,
  documentKinds,
  MAX_DOCUMENT_CHARS,
  setDocumentPublished,
  updateDocument,
} from "@/server/knowledge/documents";

const schema = z.object({
  title: z.string().trim().min(2, "Give the document a title.").max(200),
  kind: z.enum(Object.keys(documentKinds) as [string, ...string[]]),
  text: z.string().trim().min(1, "The text can't be empty.").max(MAX_DOCUMENT_CHARS, "The text is too long."),
});

export async function updateDocumentAction(
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("chat.manage");
  if (!CUID.test(id)) return { error: "Invalid document." };
  const parsed = parseForm(schema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await runAction(() => updateDocument(db, actor, id, parsed.data as never), "Saved.");
  revalidatePath(`/admin/ai-agent/documents/${id}`);
  revalidatePath("/admin/ai-agent");
  return result;
}

export async function publishDocumentAction(
  id: string,
  published: boolean,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
  _: ActionState,
): Promise<ActionState> {
  const actor = await requireActor("chat.manage");
  if (!CUID.test(id)) return { error: "Invalid document." };
  const result = await runAction(
    () => setDocumentPublished(db, actor, id, published),
    published
      ? "Published. The chat uses it from the next message."
      : "Unpublished. The chat no longer uses it.",
  );
  revalidatePath(`/admin/ai-agent/documents/${id}`);
  revalidatePath("/admin/ai-agent");
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function deleteDocumentAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("chat.manage");
  if (!CUID.test(id)) return { error: "Invalid document." };
  const result = await runAction(() => deleteDocument(db, actor, id), "Deleted.");
  if (result.ok) {
    revalidatePath("/admin/ai-agent");
    redirect("/admin/ai-agent#documents");
  }
  return result;
}
