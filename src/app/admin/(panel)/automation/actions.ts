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
import { RuleError } from "@/server/errors";
import { isWorkflowKey, runWorkflowNow, setWorkflow } from "@/server/workflows/registry";
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

export async function saveWorkflowAction(
  key: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("workflows.manage");
  if (!isWorkflowKey(key)) return { error: "Unknown workflow." };
  const lang = await getCentreLang();
  const config: Record<string, unknown> = {};
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("cfg_")) continue;
    const field = name.slice(4);
    config[field] = value === "on" ? true : Number(value);
  }
  // Unchecked boxes aren't sent: options that are true/false default to false when absent.
  for (const name of String(formData.get("booleans") ?? "")
    .split(",")
    .filter(Boolean))
    if (!(name in config)) config[name] = false;
  const result = await runAction(
    () => setWorkflow(db, actor, key, { enabled: formData.get("enabled") === "on", config }),
    centreText.workflows.saved[lang],
  );
  revalidatePath("/admin/automation/workflows");
  return result;
}

export async function runWorkflowAction(
  key: string,
  retryOf: string | null,
  _: ActionState,
): Promise<ActionState> {
  void _;
  const actor = await requireActor("workflows.manage");
  if (!isWorkflowKey(key) || (retryOf && !CUID.test(retryOf))) return { error: "Unknown workflow." };
  let message = "";
  const result = await runAction(async () => {
    const run = await runWorkflowNow(db, actor, key, retryOf ?? undefined);
    message =
      run?.status === "failed"
        ? ""
        : run?.status === "skipped"
          ? String((run.result as { reason?: string } | null)?.reason ?? "Skipped.")
          : `Done: ${Object.entries((run?.result ?? {}) as Record<string, unknown>)
              .filter(([, v]) => typeof v === "number" || typeof v === "string")
              .map(([k, v]) => `${k} ${v}`)
              .join(", ")}`;
    if (run?.status === "failed") throw new RuleError("failed", `Failed: ${run.error ?? "unknown error"}`);
  });
  revalidatePath("/admin/automation/workflows");
  return result.ok ? { ok: true, message } : result;
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
