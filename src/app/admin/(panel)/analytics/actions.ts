"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/admin/action-state";
import { runAction } from "@/server/admin/action";
import { AiError } from "@/server/ai/provider";
import { askAnalytics, questionInput } from "@/server/analytics/ask";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";

export async function askAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor("analytics.read");
  const parsed = questionInput.safeParse({ question: formData.get("question") });
  if (!parsed.success)
    return {
      error: "Please check the question.",
      fieldErrors: { question: parsed.error.issues[0]!.message },
    };
  let id = "";
  let aiProblem: string | null = null;
  const result = await runAction(async () => {
    try {
      id = (await askAnalytics(db, actor, parsed.data)).id;
    } catch (error) {
      if (error instanceof AiError) {
        aiProblem =
          error.code === "unusable"
            ? "The assistant did not return a usable answer. Try asking more simply."
            : "The AI provider could not be reached. Try again later.";
        return;
      }
      throw error;
    }
  });
  if (aiProblem) return { error: aiProblem };
  if (result.ok) {
    revalidatePath("/admin/analytics/ask");
    redirect(`/admin/analytics/ask/${id}`);
  }
  return result;
}
