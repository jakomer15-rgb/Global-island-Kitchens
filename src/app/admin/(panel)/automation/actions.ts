"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { CENTRE_LANG_COOKIE, centreText } from "@/content/automation-centre";
import type { ActionState } from "@/lib/admin/action-state";
import { CUID, runAction } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { isIntegrationKey, testIntegration } from "@/server/automation/integrations";
import { retryDelivery } from "@/server/automation/logs";
import { db } from "@/server/db";
import { getCentreLang } from "./lang";

export async function setCentreLanguageAction(formData: FormData): Promise<void> {
  await requireActor("automation.read");
  const lang = formData.get("lang") === "ar" ? "ar" : "en";
  (await cookies()).set(CENTRE_LANG_COOKIE, lang, {
    path: "/admin",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/admin", "layout");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function testIntegrationAction(key: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("integrations.manage");
  if (!isIntegrationKey(key)) return { error: "Unknown integration." };
  let outcome: { ok: boolean; message: string } | undefined;
  const result = await runAction(async () => {
    outcome = await testIntegration(db, actor, key);
  });
  revalidatePath("/admin/automation", "layout");
  if (!result.ok || !outcome) return result;
  return outcome.ok ? { ok: true, message: outcome.message } : { error: outcome.message };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function retryDeliveryAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("integrations.manage");
  if (!CUID.test(id)) return { error: "Invalid delivery." };
  const lang = await getCentreLang();
  const result = await runAction(() => retryDelivery(db, actor, id), centreText.logs.retried[lang]);
  if (result.ok) revalidatePath("/admin/automation/logs");
  return result;
}
