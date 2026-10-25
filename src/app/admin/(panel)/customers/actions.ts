"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import { CUID, parseForm, runAction } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { customerTypes, recordConsent, updateCustomer } from "@/server/crm/customers";
import { db } from "@/server/db";

const customerSchema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(100),
  phone: z.string().max(30).optional(),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.").max(254)]).optional(),
  type: z.enum(customerTypes as [string, ...string[]]),
  company: z.string().max(120).optional(),
  preferredLanguage: z.enum(["en", "ar"]),
  notes: z.string().max(2000).optional(),
});

export async function updateCustomerAction(
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("customer.update");
  if (!CUID.test(id)) return { error: "Invalid customer." };
  const parsed = parseForm(customerSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await runAction(
    () => updateCustomer(db, actor, id, parsed.data as never),
    "Customer saved.",
  );
  revalidatePath(`/admin/customers/${id}`);
  return result;
}

export async function consentAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor("customer.update");
  if (!CUID.test(id)) return { error: "Invalid customer." };
  const parsed = parseForm(
    z.object({ channel: z.enum(["email", "whatsapp"]), granted: z.enum(["yes", "no"]) }),
    formData,
  );
  if (!parsed.ok) return parsed.state;
  const result = await runAction(
    () =>
      recordConsent(db, actor, {
        customerId: id,
        channel: parsed.data.channel,
        granted: parsed.data.granted === "yes",
      }),
    "Consent recorded.",
  );
  revalidatePath(`/admin/customers/${id}`);
  return result;
}
