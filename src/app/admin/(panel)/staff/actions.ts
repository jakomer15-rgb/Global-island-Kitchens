"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import { CUID, parseForm, runAction } from "@/server/admin/action";
import {
  createStaff,
  resetStaffPassword,
  setRolePermissions,
  setStaffRoles,
  setStaffStatus,
} from "@/server/admin/staff";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/server/auth/accounts";
import { allPermissions, type Permission } from "@/server/auth/permissions";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";

const roleKeys = z.preprocess(
  (v) => (v === undefined ? [] : ([] as unknown[]).concat(v)),
  z.array(z.string().regex(/^[a-z_]{2,40}$/)).min(1, "Choose at least one role."),
);
const password = z
  .string()
  .min(PASSWORD_MIN, `At least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `At most ${PASSWORD_MAX} characters.`);

export async function createStaffAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor("staff.manage");
  const parsed = parseForm(
    z.object({
      name: z.string().trim().min(2, "Enter a name.").max(100),
      email: z.string().trim().email("Enter a valid email.").max(254),
      password,
      roles: roleKeys,
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;
  const { roles, ...rest } = parsed.data;
  const result = await runAction(
    () => createStaff(db, actor, { ...rest, roleKeys: roles }),
    "Account created. Give them the password in person; they can sign in now.",
  );
  revalidatePath("/admin/staff");
  return result;
}

export async function staffRolesAction(
  userId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("staff.manage");
  if (!CUID.test(userId)) return { error: "Invalid staff member." };
  const parsed = parseForm(z.object({ roles: roleKeys }), formData);
  if (!parsed.ok) return parsed.state;
  const result = await runAction(
    () => setStaffRoles(db, actor, { userId, roleKeys: parsed.data.roles }),
    "Roles saved.",
  );
  revalidatePath("/admin/staff");
  return result;
}

export async function staffStatusAction(
  userId: string,
  status: "active" | "disabled",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
  _: ActionState,
): Promise<ActionState> {
  const actor = await requireActor("staff.manage");
  if (!CUID.test(userId) || (status !== "active" && status !== "disabled"))
    return { error: "Invalid request." };
  const result = await runAction(
    () => setStaffStatus(db, actor, { userId, status }),
    status === "disabled" ? "Account disabled and signed out." : "Account enabled.",
  );
  revalidatePath("/admin/staff");
  return result;
}

export async function staffPasswordAction(
  userId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("staff.manage");
  if (!CUID.test(userId)) return { error: "Invalid staff member." };
  const parsed = parseForm(z.object({ password }), formData);
  if (!parsed.ok) return parsed.state;
  return runAction(
    () => resetStaffPassword(db, actor, { userId, password: parsed.data.password }),
    "Password changed. They have been signed out everywhere.",
  );
}

export async function rolePermissionsAction(
  roleId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("staff.manage");
  if (!CUID.test(roleId)) return { error: "Invalid role." };
  const chosen = formData.getAll("permissions").map(String);
  const valid = chosen.filter((p): p is Permission => (allPermissions as string[]).includes(p));
  const result = await runAction(
    () => setRolePermissions(db, actor, { roleId, permissions: valid }),
    "Permissions saved. They apply on the next page load.",
  );
  revalidatePath("/admin/staff/roles");
  return result;
}
