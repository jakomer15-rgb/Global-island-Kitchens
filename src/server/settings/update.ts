import { audit } from "@/server/audit";
import type { Permission } from "@/server/auth/permissions";
import { assertCan, type Actor } from "@/server/auth/staff";
import type { Db } from "@/server/db/client";
import { parseSetting, settingSchemas, type SettingKey, type Settings } from "@/lib/site-settings";

/** Contact details and locations are business settings; the rest is website content. */
export const settingPermission: Record<SettingKey, Permission> = {
  contact: "settings.manage",
  locations: "settings.manage",
  banner: "content.manage",
  homeHero: "content.manage",
  seo: "content.manage",
  quotation: "settings.manage",
};

export async function readSetting<K extends SettingKey>(db: Db, actor: Actor, key: K): Promise<Settings[K]> {
  assertCan(actor, settingPermission[key]);
  const row = await db.siteSetting.findUnique({ where: { key } });
  return parseSetting(key, row?.value);
}

/** Validates and saves one setting; the caller revalidates the public pages. */
export async function updateSetting<K extends SettingKey>(db: Db, actor: Actor, key: K, value: unknown) {
  assertCan(actor, settingPermission[key]);
  const parsed = settingSchemas[key].parse(value) as Settings[K];
  await db.$transaction(async (tx) => {
    const before = await tx.siteSetting.findUnique({ where: { key } });
    await tx.siteSetting.upsert({
      where: { key },
      create: { key, value: parsed, updatedById: actor.id },
      update: { value: parsed, updatedById: actor.id },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "setting.updated",
      entityType: "setting",
      entityId: key,
      changes: { before: before?.value ?? null, after: parsed },
    });
  });
  return parsed;
}
