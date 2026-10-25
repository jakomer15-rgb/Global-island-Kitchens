import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import { reason } from "@/server/errors";
import {
  parseSetting,
  settingDefaults,
  settingSchemas,
  type SettingKey,
  type Settings,
} from "@/lib/site-settings";

/**
 * The website's editable settings, read once per render. Public pages are pre-rendered, so this
 * runs at build time and again when the admin saves a setting (revalidatePath). If the database
 * can't be reached, the verified defaults from src/config/company.ts are used instead.
 */
export const getSiteSettings = cache(async (): Promise<Settings> => {
  try {
    const rows = await db.siteSetting.findMany();
    const stored = new Map(rows.map((r) => [r.key, r.value]));
    return Object.fromEntries(
      (Object.keys(settingSchemas) as SettingKey[]).map((key) => [
        key,
        stored.has(key) ? parseSetting(key, stored.get(key)) : settingDefaults[key],
      ]),
    ) as Settings;
  } catch (error) {
    console.warn("Site settings unavailable, using defaults:", reason(error));
    return settingDefaults;
  }
});
