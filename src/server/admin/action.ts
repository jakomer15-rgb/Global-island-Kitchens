import "server-only";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import { ForbiddenError } from "@/server/auth/staff";
import { NotFoundError, RuleError } from "@/server/errors";

/** Runs an admin mutation and turns known errors into messages (anything else is logged and generic). */
export async function runAction(work: () => Promise<unknown>, success = "Saved."): Promise<ActionState> {
  try {
    await work();
    return { ok: true, message: success };
  } catch (error) {
    if (error instanceof RuleError)
      return { error: error.message === error.code ? "Please check the details." : error.message };
    if (error instanceof NotFoundError) return { error: "That record no longer exists." };
    if (error instanceof ForbiddenError) return { error: "You don't have permission to do that." };
    console.error("Admin action failed", error);
    return { error: "Something went wrong. Please try again." };
  }
}

/** FormData → object (repeated keys become arrays; checkboxes are "on"). */
export function formObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (key in out) out[key] = ([] as unknown[]).concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): { ok: true; data: z.output<T> } | { ok: false; state: ActionState } {
  const parsed = schema.safeParse(formObject(formData));
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return { ok: false, state: { error: "Please check the highlighted fields.", fieldErrors } };
}

/** Record ids: cuids for business records, UUIDs (with hyphens) for users. */
export const CUID = /^[a-z0-9-]{20,40}$/i;

/** Form helpers: optional text ("" → null), required text, checkboxes ("on" → true), integers. */
export const formText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters.`)
    .optional()
    .transform((v) => v || null);
export const formRequired = (max: number, message = "Required.") =>
  z.string().trim().min(1, message).max(max, `At most ${max} characters.`);
export const formCheckbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());
export const formInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === undefined ? 0 : v), z.coerce.number().int().min(min).max(max));
export const formId = z
  .string()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || CUID.test(v), "Invalid choice.");
