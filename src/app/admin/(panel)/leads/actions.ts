"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import { CUID, parseForm, runAction } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import {
  assignLead,
  changeLeadStatus,
  completeFollowUp,
  leadStatuses,
  loggableKinds,
  logActivity,
  scheduleFollowUp,
} from "@/server/crm/leads";
import { db } from "@/server/db";

const id = z.string().regex(CUID);

export async function changeStatusAction(
  leadId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("lead.update");
  const parsed = parseForm(
    z.object({
      status: z.enum(leadStatuses as [string, ...string[]]),
      lostReason: z.string().max(300).optional(),
    }),
    formData,
  );
  if (!parsed.ok || !id.safeParse(leadId).success)
    return parsed.ok ? { error: "Invalid lead." } : parsed.state;
  const result = await runAction(
    () =>
      changeLeadStatus(db, actor, {
        id: leadId,
        status: parsed.data.status as never,
        lostReason: parsed.data.lostReason,
      }),
    "Status updated.",
  );
  revalidatePath(`/admin/leads/${leadId}`);
  return result;
}

export async function assignAction(leadId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor("lead.assign");
  const parsed = parseForm(z.object({ userId: z.union([id, z.literal("")]) }), formData);
  if (!parsed.ok || !id.safeParse(leadId).success)
    return parsed.ok ? { error: "Invalid lead." } : parsed.state;
  const result = await runAction(
    () => assignLead(db, actor, { id: leadId, userId: parsed.data.userId || null }),
    "Assignment saved.",
  );
  revalidatePath(`/admin/leads/${leadId}`);
  return result;
}

export async function logActivityAction(
  leadId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("lead.update");
  const parsed = parseForm(
    z.object({
      kind: z.enum(loggableKinds as [string, ...string[]]),
      body: z.string().trim().min(1, "Write something.").max(4000),
    }),
    formData,
  );
  if (!parsed.ok || !id.safeParse(leadId).success)
    return parsed.ok ? { error: "Invalid lead." } : parsed.state;
  const result = await runAction(
    () => logActivity(db, actor, { leadId, kind: parsed.data.kind as never, body: parsed.data.body }),
    "Logged.",
  );
  revalidatePath(`/admin/leads/${leadId}`);
  return result;
}

export async function scheduleFollowUpAction(
  leadId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("lead.update");
  const parsed = parseForm(
    z.object({
      // datetime-local, entered in Bahrain time (UTC+3, no daylight saving)
      dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time."),
      note: z.string().max(500).optional(),
      assignedToId: z.union([id, z.literal("")]).optional(),
    }),
    formData,
  );
  if (!parsed.ok || !id.safeParse(leadId).success)
    return parsed.ok ? { error: "Invalid lead." } : parsed.state;
  const dueAt = new Date(`${parsed.data.dueAt}:00+03:00`);
  const result = await runAction(
    () =>
      scheduleFollowUp(db, actor, {
        leadId,
        dueAt,
        note: parsed.data.note,
        assignedToId: parsed.data.assignedToId || null,
      }),
    "Follow-up scheduled.",
  );
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/follow-ups");
  return result;
}

export async function completeFollowUpAction(
  followUpId: string,
  path: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
  _: ActionState,
): Promise<ActionState> {
  const actor = await requireActor("lead.update");
  if (!id.safeParse(followUpId).success) return { error: "Invalid follow-up." };
  const result = await runAction(() => completeFollowUp(db, actor, followUpId), "Marked done.");
  if (path.startsWith("/admin/")) revalidatePath(path);
  revalidatePath("/admin/follow-ups");
  return result;
}
