import { hashPassword } from "better-auth/crypto";
import { audit } from "@/server/audit";
import { createStaffUser, passwordProblem } from "@/server/auth/accounts";
import { allPermissions, type Permission } from "@/server/auth/permissions";
import { assertCan, type Actor } from "@/server/auth/staff";
import type { Db, Tx } from "@/server/db/client";
import { NotFoundError, RuleError } from "@/server/errors";

/**
 * Staff accounts and roles (owner only by default: `staff.manage`). Guards:
 * - nobody changes their own roles or disables themselves (no accidental lock-out);
 * - only an owner grants or removes the owner role, and there is always one active owner;
 * - the owner role always has every permission.
 */

const OWNER = "owner";

function isOwner(actor: Actor) {
  return actor.roles.includes(OWNER);
}

export async function listStaff(db: Db, actor: Actor) {
  assertCan(actor, "staff.manage");
  return db.user.findMany({
    where: { kind: "staff" },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      roles: { select: { role: { select: { key: true, name: true } } } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function listRoles(db: Db, actor: Actor) {
  assertCan(actor, "staff.manage");
  return db.role.findMany({
    include: { permissions: { select: { permissionKey: true } }, _count: { select: { users: true } } },
    orderBy: { createdAt: "asc" },
  });
}

async function activeOwnerCount(tx: Tx, exceptUserId: string) {
  return tx.user.count({
    where: {
      id: { not: exceptUserId },
      kind: "staff",
      status: "active",
      roles: { some: { role: { key: OWNER } } },
    },
  });
}

async function rolesByKey(tx: Tx, roleKeys: string[]) {
  const unique = [...new Set(roleKeys)];
  if (unique.length === 0) throw new RuleError("roles_required", "Choose at least one role.");
  const roles = await tx.role.findMany({ where: { key: { in: unique } } });
  if (roles.length !== unique.length) throw new RuleError("unknown_role", "Unknown role.");
  return roles;
}

export async function createStaff(
  db: Db,
  actor: Actor,
  input: { email: string; name: string; password: string; roleKeys: string[] },
) {
  assertCan(actor, "staff.manage");
  if (input.roleKeys.includes(OWNER) && !isOwner(actor))
    throw new RuleError("owner_only", "Only an owner can create another owner.");
  const problem = passwordProblem(input.password);
  if (problem) throw new RuleError("weak_password", problem);
  return db.$transaction(async (tx) => {
    await rolesByKey(tx, input.roleKeys);
    const email = input.email.trim().toLowerCase();
    if (await tx.user.findUnique({ where: { email }, select: { id: true } }))
      throw new RuleError("email_taken", "An account with this email already exists.");
    return createStaffUser(tx, { ...input, email, actorId: actor.id, via: "admin" });
  });
}

export async function setStaffRoles(db: Db, actor: Actor, input: { userId: string; roleKeys: string[] }) {
  assertCan(actor, "staff.manage");
  if (input.userId === actor.id) throw new RuleError("self", "You can't change your own roles.");
  await db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: input.userId, kind: "staff" },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundError("Staff member");
    const roles = await rolesByKey(tx, input.roleKeys);
    const before = user.roles.map((r) => r.role.key).sort();
    const after = roles.map((r) => r.key).sort();
    const ownerChanges = before.includes(OWNER) !== after.includes(OWNER);
    if (ownerChanges && !isOwner(actor))
      throw new RuleError("owner_only", "Only an owner can grant or remove the owner role.");
    if (before.includes(OWNER) && !after.includes(OWNER) && (await activeOwnerCount(tx, user.id)) === 0)
      throw new RuleError("last_owner", "There must always be at least one active owner.");
    await tx.userRole.deleteMany({ where: { userId: user.id } });
    await tx.userRole.createMany({ data: roles.map((r) => ({ userId: user.id, roleId: r.id })) });
    await audit(tx, {
      actorId: actor.id,
      action: "staff.roles_changed",
      entityType: "user",
      entityId: user.id,
      changes: { before, after },
    });
  });
}

export async function setStaffStatus(
  db: Db,
  actor: Actor,
  input: { userId: string; status: "active" | "disabled" },
) {
  assertCan(actor, "staff.manage");
  if (input.userId === actor.id) throw new RuleError("self", "You can't disable your own account.");
  await db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: input.userId, kind: "staff" },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundError("Staff member");
    if (user.status === input.status) return;
    const owner = user.roles.some((r) => r.role.key === OWNER);
    if (owner && !isOwner(actor)) throw new RuleError("owner_only", "Only an owner can disable an owner.");
    if (input.status === "disabled" && owner && (await activeOwnerCount(tx, user.id)) === 0)
      throw new RuleError("last_owner", "There must always be at least one active owner.");
    await tx.user.update({ where: { id: user.id }, data: { status: input.status } });
    // Signed out everywhere at once (every request re-checks status too).
    if (input.status === "disabled") await tx.session.deleteMany({ where: { userId: user.id } });
    await audit(tx, {
      actorId: actor.id,
      action: input.status === "disabled" ? "staff.disabled" : "staff.enabled",
      entityType: "user",
      entityId: user.id,
    });
  });
}

/** Sets a new password (the staff member is told it in person) and signs them out everywhere. */
export async function resetStaffPassword(db: Db, actor: Actor, input: { userId: string; password: string }) {
  assertCan(actor, "staff.manage");
  const problem = passwordProblem(input.password);
  if (problem) throw new RuleError("weak_password", problem);
  const hash = await hashPassword(input.password);
  await db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: input.userId, kind: "staff" },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundError("Staff member");
    if (user.id !== actor.id && user.roles.some((r) => r.role.key === OWNER) && !isOwner(actor))
      throw new RuleError("owner_only", "Only an owner can reset an owner's password.");
    const updated = await tx.account.updateMany({
      where: { userId: user.id, providerId: "credential" },
      data: { password: hash },
    });
    if (updated.count === 0)
      throw new RuleError("no_password_account", "This account has no password sign-in.");
    await tx.session.deleteMany({ where: { userId: user.id } });
    await audit(tx, {
      actorId: actor.id,
      action: "staff.password_reset",
      entityType: "user",
      entityId: user.id,
    });
  });
}

export async function setRolePermissions(
  db: Db,
  actor: Actor,
  input: { roleId: string; permissions: Permission[] },
) {
  assertCan(actor, "staff.manage");
  const keys = [...new Set(input.permissions)].filter((p) => allPermissions.includes(p)).sort();
  await db.$transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { id: input.roleId }, include: { permissions: true } });
    if (!role) throw new NotFoundError("Role");
    if (role.key === OWNER) throw new RuleError("owner_role", "The owner role always has every permission.");
    const before = role.permissions.map((p) => p.permissionKey).sort();
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.rolePermission.createMany({
      data: keys.map((permissionKey) => ({ roleId: role.id, permissionKey })),
    });
    await audit(tx, {
      actorId: actor.id,
      action: "role.permissions_changed",
      entityType: "role",
      entityId: role.id,
      changes: { role: role.key, before, after: keys },
    });
  });
}

/** Audit log, newest first. */
export async function listAuditLog(
  db: Db,
  actor: Actor,
  filters: { entityType?: string; actorId?: string; action?: string; page?: number },
) {
  assertCan(actor, "audit.read");
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const take = 50;
  const where = {
    ...(filters.entityType && { entityType: filters.entityType }),
    ...(filters.actorId && { actorId: filters.actorId }),
    ...(filters.action && { action: { startsWith: filters.action } }),
  };
  const [items, total, entityTypes] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
  ]);
  return {
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / take)),
    entityTypes: entityTypes.map((e) => e.entityType),
  };
}
