"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import { CUID, parseForm, runAction } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { processOutbox } from "@/server/outbox/worker";
import {
  cancelMessage,
  decideMessage,
  draftMessageWithAi,
  messageInput,
  writeMessage,
} from "@/server/outreach/messages";

const refresh = (leadId: string) => {
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/automation/approvals");
};

export async function writeMessageAction(
  leadId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("lead.update");
  if (!CUID.test(leadId)) return { error: "Invalid lead." };
  const parsed = parseForm(messageInput, formData);
  if (!parsed.ok) return parsed.state;
  const result = await runAction(
    () => writeMessage(db, actor, leadId, parsed.data),
    "Saved. It waits for approval before it is sent.",
  );
  if (result.ok) refresh(leadId);
  return result;
}

export async function draftMessageAction(
  leadId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("lead.update");
  if (!CUID.test(leadId)) return { error: "Invalid lead." };
  const instruction = String(formData.get("instruction") ?? "").slice(0, 300);
  const result = await runAction(
    () => draftMessageWithAi(db, actor, leadId, instruction),
    "Draft ready below. It waits for approval; nothing is sent yet.",
  );
  if (result.ok) refresh(leadId);
  return result;
}

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(300).optional(),
  subject: z.string().trim().min(3).max(200).optional(),
  body: z.string().trim().min(10).max(5000).optional(),
});

export async function decideMessageAction(
  messageId: string,
  leadId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("outreach.approve");
  if (!CUID.test(messageId) || !CUID.test(leadId)) return { error: "Invalid message." };
  const parsed = parseForm(decisionSchema, formData);
  if (!parsed.ok) return parsed.state;
  const approve = parsed.data.decision === "approve";
  const result = await runAction(
    () => decideMessage(db, actor, messageId, { approve, ...parsed.data }),
    approve ? "Approved. It is being sent now." : "Rejected. Nothing was sent.",
  );
  if (result.ok) {
    // Send straight away rather than waiting for the scheduled job.
    if (approve) after(() => processOutbox(db).catch((e) => console.error("Outbox delivery failed", e)));
    refresh(leadId);
  }
  return result;
}

export async function cancelMessageAction(
  messageId: string,
  leadId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
  _: ActionState,
): Promise<ActionState> {
  const actor = await requireActor("lead.update");
  if (!CUID.test(messageId) || !CUID.test(leadId)) return { error: "Invalid message." };
  const result = await runAction(() => cancelMessage(db, actor, messageId), "Cancelled.");
  if (result.ok) refresh(leadId);
  return result;
}
