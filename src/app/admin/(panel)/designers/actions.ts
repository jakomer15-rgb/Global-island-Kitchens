"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import { CUID, formCheckbox, formText, parseForm, runAction } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { decideDesigner, staffReply } from "@/server/designers/admin";

export async function decideDesignerAction(
  designerId: string,
  decision: "approved" | "rejected" | "suspended",
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("designer.manage");
  if (!CUID.test(designerId)) return { error: "Invalid designer." };
  if (!["approved", "rejected", "suspended"].includes(decision)) return { error: "Invalid decision." };
  const parsed = parseForm(z.object({ note: formText(500) }), formData);
  if (!parsed.ok) return parsed.state;
  const labels = {
    approved: "Designer approved.",
    rejected: "Registration rejected.",
    suspended: "Access suspended.",
  };
  const result = await runAction(
    () => decideDesigner(db, actor, designerId, decision, parsed.data.note),
    labels[decision],
  );
  revalidatePath("/admin/designers");
  revalidatePath(`/admin/designers/${designerId}`);
  return result;
}

export async function designerReplyAction(
  projectId: string,
  leadId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("designer.manage");
  if (!CUID.test(projectId) || !CUID.test(leadId)) return { error: "Invalid project." };
  const parsed = parseForm(
    z.object({
      body: z.string().trim().min(1, "Write a message.").max(2000, "Keep it under 2,000 characters."),
      internal: formCheckbox,
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;
  const result = await runAction(
    () => staffReply(db, actor, projectId, parsed.data.body, parsed.data.internal),
    parsed.data.internal ? "Note saved." : "Message sent.",
  );
  revalidatePath(`/admin/leads/${leadId}`);
  return result;
}
