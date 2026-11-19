import type { Prisma } from "@/generated/prisma/client";
import { parseSetting, settingSchemas, type Settings } from "@/lib/site-settings";
import { audit } from "@/server/audit";
import type { Db, Tx } from "@/server/db/client";

/**
 * The Autopilot setting (Automation Centre → Autopilot). Read by every part that sends or publishes on its
 * own, and checked again just before sending, so switching it off stops what is already queued.
 */

export type AutopilotSettings = Settings["autopilot"];
export type AutopilotPart = "replies" | "prospectEmails" | "social";

export async function readAutopilot(db: Db | Tx): Promise<AutopilotSettings> {
  const row = await db.siteSetting.findUnique({ where: { key: "autopilot" } });
  return parseSetting("autopilot", row?.value);
}

/** Is this part allowed to act on its own right now? */
export function partActive(s: AutopilotSettings, part: AutopilotPart): boolean {
  if (!s.enabled || !s[part]) return false;
  if (part === "prospectEmails") return Boolean(s.prospectTemplate?.approvedAt) && !s.prospectPausedReason;
  return true;
}

export async function autopilotActive(db: Db | Tx, part: AutopilotPart): Promise<boolean> {
  return partActive(await readAutopilot(db), part);
}

/** In-app notification to every active staff member with a permission (e.g. the approvers). */
export async function notifyHolders(tx: Tx, permission: string, title: string, link: string, body?: string) {
  const users = await tx.user.findMany({
    where: {
      kind: "staff",
      status: "active",
      roles: { some: { role: { permissions: { some: { permissionKey: permission } } } } },
    },
    select: { id: true },
  });
  for (const u of users)
    await tx.notification.create({ data: { userId: u.id, title, link, body: body ?? null } });
}

/**
 * Saves the setting from the system itself (a safety pause), with no person: audited with no actor. People
 * change it through `saveAutopilot`, which checks permissions.
 */
export async function writeAutopilotBySystem(
  tx: Tx,
  value: AutopilotSettings,
  action: string,
  changes: Record<string, unknown>,
) {
  const parsed = settingSchemas.autopilot.parse(value);
  await tx.siteSetting.upsert({
    where: { key: "autopilot" },
    create: { key: "autopilot", value: parsed as Prisma.InputJsonValue },
    update: { value: parsed as Prisma.InputJsonValue },
  });
  await audit(tx, {
    actorId: null,
    action,
    entityType: "setting",
    entityId: "autopilot",
    changes: changes as Prisma.InputJsonValue,
  });
}
