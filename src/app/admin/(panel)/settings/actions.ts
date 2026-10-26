"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import { normalisePhone } from "@/lib/phone";
import { runAction } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { settingSchemas, type SettingKey } from "@/lib/site-settings";
import { settingPermission, updateSetting } from "@/server/settings/update";

const str = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
const lines = (formData: FormData, name: string) =>
  str(formData, name)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/** Form fields → the stored shape of each setting (validated by its schema in updateSetting). */
const fromForm: Record<SettingKey, (f: FormData) => unknown> = {
  contact: (f) => ({
    phones: [1, 2, 3]
      .map((n) => str(f, `phone${n}`))
      .filter(Boolean)
      .map((display) => ({ display, e164: normalisePhone(display) ?? "invalid" })),
    email: str(f, "email"),
    instagramHandle: str(f, "instagramHandle").replace(/^@/, ""),
    whatsappNumber: str(f, "whatsappNumber").replace(/\D/g, "") || null,
  }),
  locations: (f) => ({
    showroomEn: lines(f, "showroomEn"),
    showroomAr: lines(f, "showroomAr"),
    headOfficeEn: lines(f, "headOfficeEn"),
    headOfficeAr: lines(f, "headOfficeAr"),
    hoursEn: str(f, "hoursEn"),
    hoursAr: str(f, "hoursAr"),
  }),
  banner: (f) => ({ enabled: f.get("enabled") === "on", textEn: str(f, "textEn"), textAr: str(f, "textAr") }),
  homeHero: (f) => Object.fromEntries(Object.keys(settingSchemas.homeHero.shape).map((k) => [k, str(f, k)])),
  seo: (f) => Object.fromEntries(Object.keys(settingSchemas.seo.shape).map((k) => [k, str(f, k)])),
  quotation: (f) => {
    const rate = Number(str(f, "vatRate").replace("%", ""));
    const days = str(f, "validityDays");
    return {
      vatEnabled: f.get("vatEnabled") === "on",
      // "10" or "10.5" (%) → basis points
      vatRateBasisPoints: Number.isFinite(rate) ? Math.round(rate * 100) : -1,
      vatNumber: str(f, "vatNumber"),
      termsEn: str(f, "termsEn"),
      termsAr: str(f, "termsAr"),
      validityDays: days ? Number(days) : null,
    };
  },
};

function fieldErrors(error: ZodError): ActionState {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    out[field.startsWith("phones") ? "phones" : field] ??= field.startsWith("phones")
      ? "Enter valid phone numbers (at least one)."
      : issue.message;
  }
  return { error: "Please check the highlighted fields.", fieldErrors: out };
}

export async function saveSettingAction(
  key: SettingKey,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Bound arguments come back from the browser: accept only known keys (not inherited names).
  if (!Object.hasOwn(fromForm, key)) return { error: "Unknown setting." };
  const actor = await requireActor(settingPermission[key]);
  const value = fromForm[key](formData);
  const check = settingSchemas[key].safeParse(value);
  if (!check.success) return fieldErrors(check.error);
  const result = await runAction(
    () => updateSetting(db, actor, key, value),
    "Saved. The website is updated.",
  );
  // Contact details, banner and SEO appear on every public page.
  if (result.ok) revalidatePath("/[locale]", "layout");
  revalidatePath(settingPermission[key] === "settings.manage" ? "/admin/settings" : "/admin/content");
  return result;
}
