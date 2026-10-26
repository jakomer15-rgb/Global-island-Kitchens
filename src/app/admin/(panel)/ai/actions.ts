"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import { CUID, formText, parseForm, runAction } from "@/server/admin/action";
import {
  blogDraftSchema,
  decideDraft,
  leadReplySchema,
  leadSummarySchema,
  requestBlogDraft,
  requestLeadDraft,
} from "@/server/ai/drafts";
import { AiError } from "@/server/ai/provider";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { RuleError } from "@/server/errors";

/** Provider problems become messages staff can read; the provider's own text is never shown. */
async function withAi(work: () => Promise<unknown>, success: string): Promise<ActionState> {
  return runAction(async () => {
    try {
      await work();
    } catch (error) {
      if (error instanceof AiError) {
        const text =
          error.code === "unusable"
            ? "The assistant did not return a usable draft. Try again with a clearer request."
            : "The AI provider could not be reached. Try again later.";
        throw new RuleError(error.code, text);
      }
      throw error;
    }
  }, success);
}

const lines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

export async function requestLeadDraftAction(
  leadId: string,
  kind: "lead_reply" | "lead_summary",
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("ai.use");
  if (!CUID.test(leadId) || !["lead_reply", "lead_summary"].includes(kind))
    return { error: "Invalid request." };
  const parsed = parseForm(z.object({ instruction: formText(300) }), formData);
  if (!parsed.ok) return parsed.state;
  const result = await withAi(
    () => requestLeadDraft(db, actor, { leadId, kind, instruction: parsed.data.instruction ?? undefined }),
    "Draft ready for review below.",
  );
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/ai");
  return result;
}

export async function requestBlogDraftAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor("ai.use");
  const parsed = parseForm(
    z.object({ topic: z.string().trim().min(5, "Describe the topic.").max(300), notes: formText(1500) }),
    formData,
  );
  if (!parsed.ok) return parsed.state;
  const result = await withAi(
    () => requestBlogDraft(db, actor, { topic: parsed.data.topic, notes: parsed.data.notes ?? undefined }),
    "Draft ready for review below.",
  );
  revalidatePath("/admin/ai");
  return result;
}

/** Builds the (possibly edited) output from the review form, per draft kind. */
function outputFromForm(kind: string, f: FormData): unknown {
  const s = (name: string) => String(f.get(name) ?? "").trim();
  if (kind === "lead_reply")
    return {
      language: s("language") === "ar" ? "ar" : "en",
      reply: s("reply"),
      questions: lines(s("questions")),
    };
  if (kind === "lead_summary")
    return { summary: s("summary"), missing: lines(s("missing")), nextSteps: lines(s("nextSteps")) };
  return Object.fromEntries(
    ["slug", "titleEn", "titleAr", "excerptEn", "excerptAr", "bodyEn", "bodyAr"].map((k) => [k, s(k)]),
  );
}

const schemas = { lead_reply: leadReplySchema, lead_summary: leadSummarySchema, blog_post: blogDraftSchema };

export async function approveDraftAction(
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("ai.review");
  if (!CUID.test(id)) return { error: "Invalid draft." };
  const draft = await db.aiDraft.findUnique({ where: { id }, select: { kind: true, leadId: true } });
  if (!draft) return { error: "That draft no longer exists." };
  const output = outputFromForm(draft.kind, formData);
  const check = schemas[draft.kind].safeParse(output);
  if (!check.success)
    return { error: "The draft is too long, too short or missing a part. Please check it." };
  const result = await runAction(
    () => decideDraft(db, actor, id, "approved", { output, note: String(formData.get("note") ?? "") }),
    draft.kind === "blog_post"
      ? "Approved. An unpublished blog draft was created."
      : "Approved. The text was filed as a note on the lead (nothing was sent).",
  );
  revalidatePath("/admin/ai");
  if (draft.leadId) revalidatePath(`/admin/leads/${draft.leadId}`);
  return result;
}

export async function rejectDraftAction(
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("ai.review");
  if (!CUID.test(id)) return { error: "Invalid draft." };
  const result = await runAction(
    () => decideDraft(db, actor, id, "rejected", { note: String(formData.get("note") ?? "") }),
    "Draft rejected.",
  );
  revalidatePath("/admin/ai");
  const draft = await db.aiDraft.findUnique({ where: { id }, select: { leadId: true } });
  if (draft?.leadId) revalidatePath(`/admin/leads/${draft.leadId}`);
  return result;
}
