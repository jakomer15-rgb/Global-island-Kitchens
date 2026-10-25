"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import { CUID, parseForm, runAction } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import {
  assignConsultation,
  changeConsultationStatus,
  consultationStatuses,
} from "@/server/crm/consultations";
import { db } from "@/server/db";

export async function consultationStatusAction(
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("consultation.update");
  if (!CUID.test(id)) return { error: "Invalid consultation." };
  const parsed = parseForm(
    z.object({ status: z.enum(consultationStatuses as [string, ...string[]]) }),
    formData,
  );
  if (!parsed.ok) return parsed.state;
  const result = await runAction(
    () => changeConsultationStatus(db, actor, { id, status: parsed.data.status as never }),
    "Updated.",
  );
  revalidatePath("/admin/consultations");
  return result;
}

export async function consultationAssignAction(
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("consultation.update");
  if (!CUID.test(id)) return { error: "Invalid consultation." };
  const parsed = parseForm(z.object({ userId: z.union([z.string().regex(CUID), z.literal("")]) }), formData);
  if (!parsed.ok) return parsed.state;
  const result = await runAction(
    () => assignConsultation(db, actor, { id, userId: parsed.data.userId || null }),
    "Assigned.",
  );
  revalidatePath("/admin/consultations");
  return result;
}
