import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { auth } from "./auth";
import type { Permission } from "./permissions";
import { can, resolveActor, userWithRolesInclude, type Actor } from "./staff";

/**
 * The signed-in staff member for this request, or null. Cached per request. Status and roles are
 * re-read from the database every time, so disabling a user or removing a role applies at once.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.user.id }, include: userWithRolesInclude });
  return resolveActor(user);
});

/**
 * Guard for admin pages and server actions: signed-out visitors go to sign-in, staff without the
 * permission to the no-access page. The proxy's cookie check is only a convenience; this is the boundary.
 */
export async function requireActor(permission?: Permission): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/admin/sign-in");
  if (permission && !can(actor, permission)) redirect("/admin/no-access");
  return actor;
}
