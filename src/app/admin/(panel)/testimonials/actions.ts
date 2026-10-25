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
import { deleteTestimonial, saveTestimonial } from "@/server/admin/content";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";

const testimonialSchema = z.object({
  displayName: formRequired(80, "Enter the name as the customer agreed to show it."),
  textEn: formText(800),
  textAr: formText(800),
  source: formRequired(200, "Say where the testimonial came from."),
  consentNote: formText(300),
  consent: formCheckbox,
  published: formCheckbox,
  sortOrder: formInt(0, 9999),
});

function revalidateTestimonials() {
  revalidatePath("/admin/testimonials");
  revalidatePath("/[locale]", "page");
}

export async function saveTestimonialAction(
  id: string | null,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("content.manage");
  if (id !== null && !CUID.test(id)) return { error: "Invalid testimonial." };
  const parsed = parseForm(testimonialSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await runAction(() => saveTestimonial(db, actor, id, parsed.data), "Testimonial saved.");
  if (result.ok) revalidateTestimonials();
  if (result.ok && id === null) redirect("/admin/testimonials");
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function deleteTestimonialAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("content.manage");
  if (!CUID.test(id)) return { error: "Invalid testimonial." };
  const result = await runAction(() => deleteTestimonial(db, actor, id), "Deleted.");
  if (result.ok) {
    revalidateTestimonials();
    redirect("/admin/testimonials");
  }
  return result;
}
