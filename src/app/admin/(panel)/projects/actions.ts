"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import { parseBhd } from "@/lib/money";
import { CUID, formCheckbox, formRequired, formText, parseForm, runAction } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  changeStage,
  createProjectFromLead,
  orderStatuses,
  projectStages,
  updateOrder,
  updateProject,
} from "@/server/quotations/projects";

const date = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      ctx.addIssue({ code: "custom", message: "Choose a date." });
      return z.NEVER;
    }
    return new Date(`${v}T00:00:00Z`);
  });

export async function createProjectAction(leadId: string): Promise<ActionState> {
  const actor = await requireActor("project.manage");
  if (!CUID.test(leadId)) return { error: "Invalid lead." };
  let id: string | undefined;
  const result = await runAction(async () => {
    id = await createProjectFromLead(db, actor, { leadId });
  });
  if (result.ok && id) redirect(`/admin/projects/${id}`);
  return result;
}

export async function stageAction(
  projectId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("project.manage");
  if (!CUID.test(projectId)) return { error: "Invalid project." };
  const parsed = parseForm(
    z.object({ stage: z.enum(projectStages as [string, ...string[]]), note: formText(500) }),
    formData,
  );
  if (!parsed.ok) return parsed.state;
  const result = await runAction(
    () => changeStage(db, actor, { projectId, stage: parsed.data.stage as never, note: parsed.data.note }),
    "Stage updated.",
  );
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/projects");
  return result;
}

export async function updateProjectAction(
  projectId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("project.manage");
  if (!CUID.test(projectId)) return { error: "Invalid project." };
  const parsed = parseForm(
    z.object({
      title: formRequired(200, "Enter a title."),
      siteAddress: formText(300),
      targetDate: date,
      assignedToId: z
        .string()
        .optional()
        .transform((v) => v || null)
        .refine((v) => v === null || CUID.test(v), "Invalid staff member."),
      notes: formText(2000),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;
  const result = await runAction(() => updateProject(db, actor, projectId, parsed.data), "Project saved.");
  revalidatePath(`/admin/projects/${projectId}`);
  return result;
}

export async function updateOrderAction(
  orderId: string,
  projectId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("project.manage");
  if (!CUID.test(orderId) || !CUID.test(projectId)) return { error: "Invalid order." };
  const parsed = parseForm(
    z.object({
      status: z.enum(orderStatuses as [string, ...string[]]),
      deposit: z.string().transform((v, ctx) => {
        if (!v.trim()) return null;
        const n = parseBhd(v);
        if (n === null) {
          ctx.addIssue({ code: "custom", message: "Enter the deposit in BHD." });
          return z.NEVER;
        }
        return n;
      }),
      depositReceived: formCheckbox,
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;
  const result = await runAction(
    () =>
      updateOrder(db, actor, orderId, {
        status: parsed.data.status as never,
        depositFils: parsed.data.deposit,
        depositReceived: parsed.data.depositReceived,
      }),
    "Order saved.",
  );
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/orders");
  return result;
}
