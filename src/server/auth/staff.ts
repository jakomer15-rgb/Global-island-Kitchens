import type { Permission } from "./permissions";

/** The acting staff member, with permissions resolved from their roles. Passed to every service. */
export interface Actor {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: ReadonlySet<Permission>;
}

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

export function can(actor: Actor, permission: Permission): boolean {
  return actor.permissions.has(permission);
}

/** First line of every service function. */
export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) throw new ForbiddenError(permission);
}

export const userWithRolesInclude = {
  roles: { include: { role: { include: { permissions: true } } } },
} as const;

interface UserWithRoles {
  id: string;
  name: string;
  email: string;
  kind: string;
  status: string;
  roles: { role: { key: string; permissions: { permissionKey: string }[] } }[];
}

/** Active staff with at least one role, or null (disabled, designer, or no roles). */
export function resolveActor(user: UserWithRoles | null): Actor | null {
  if (!user || user.status !== "active" || user.kind !== "staff" || user.roles.length === 0) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles.map((r) => r.role.key),
    permissions: new Set(
      user.roles.flatMap((r) => r.role.permissions.map((p) => p.permissionKey as Permission)),
    ),
  };
}
