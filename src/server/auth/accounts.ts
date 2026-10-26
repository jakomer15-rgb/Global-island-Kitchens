import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { Tx } from "@/server/db/client";
import { audit } from "@/server/audit";

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `The password must be at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `The password must be at most ${PASSWORD_MAX} characters.`;
  return null;
}

/**
 * Creates a designer sign-in (kind designer, no roles) with its pending profile. Hashed with Better
 * Auth's own scrypt. Call inside a transaction; throws a unique-violation if the email is taken.
 */
export async function createDesignerUser(
  tx: Tx,
  input: {
    email: string;
    name: string;
    password: string;
    company: string | null;
    profession: "interior_designer" | "architect" | "contractor" | "developer" | "other";
    phone: string;
  },
): Promise<{ userId: string; designerId: string }> {
  const problem = passwordProblem(input.password);
  if (problem) throw new Error(problem);
  const id = randomUUID();
  const user = await tx.user.create({
    data: {
      id,
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      kind: "designer",
      status: "active",
      emailVerified: false,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          password: await hashPassword(input.password),
        },
      },
      designerAccount: {
        create: { company: input.company, profession: input.profession, phone: input.phone },
      },
    },
    include: { designerAccount: { select: { id: true } } },
  });
  return { userId: user.id, designerId: user.designerAccount!.id };
}

/**
 * Creates a staff user with an email/password account and the given roles, hashed with Better
 * Auth's own scrypt so normal sign-in verifies it. Call inside a transaction.
 */
export async function createStaffUser(
  tx: Tx,
  input: {
    email: string;
    name: string;
    password: string;
    roleKeys: string[];
    actorId: string | null;
    via: string;
  },
): Promise<string> {
  const problem = passwordProblem(input.password);
  if (problem) throw new Error(problem);
  const roles = await tx.role.findMany({ where: { key: { in: input.roleKeys } } });
  if (roles.length !== input.roleKeys.length) throw new Error("Unknown role. Run `npm run db:seed` first.");
  const email = input.email.trim().toLowerCase();
  const id = randomUUID();
  await tx.user.create({
    data: {
      id,
      email,
      name: input.name.trim(),
      kind: "staff",
      status: "active",
      emailVerified: true,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          password: await hashPassword(input.password),
        },
      },
      roles: { create: roles.map((r) => ({ roleId: r.id })) },
    },
  });
  await audit(tx, {
    actorId: input.actorId,
    action: "staff.created",
    entityType: "user",
    entityId: id,
    changes: { email, roles: input.roleKeys, via: input.via },
  });
  return id;
}
