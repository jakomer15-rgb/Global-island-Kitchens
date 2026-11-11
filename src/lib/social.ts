/**
 * Social media rules shared by the server and the admin pages (Stage 6). Pure, so they are unit-tested.
 */

export const socialPlatforms = ["instagram", "facebook", "linkedin", "tiktok"] as const;
export type SocialPlatformKey = (typeof socialPlatforms)[number];

export const socialPostTypes = ["image", "text", "reel", "story"] as const;
export type SocialPostTypeKey = (typeof socialPostTypes)[number];

export const socialStatuses = [
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
  "published",
  "failed",
] as const;
export type SocialStatusKey = (typeof socialStatuses)[number];

export const platformNames: Record<SocialPlatformKey, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

export const postTypeNames: Record<SocialPostTypeKey, string> = {
  image: "Photo post",
  text: "Text post",
  reel: "Reel / video",
  story: "Story",
};

export const socialStatusNames: Record<SocialStatusKey, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
};

export const languageNames = { en: "English", ar: "Arabic", both: "Arabic and English" } as const;
export type SocialLanguageKey = keyof typeof languageNames;

/**
 * Whether a platform can publish this type of post through its API from here. Everything else is posted
 * by hand (and marked as posted): reels need a video file, LinkedIn needs LinkedIn's approval for company
 * pages, TikTok is a future integration.
 */
export function autoPublishable(platform: SocialPlatformKey, type: SocialPostTypeKey): boolean {
  if (platform === "facebook") return type === "image" || type === "text";
  if (platform === "instagram") return type === "image" || type === "story";
  return false;
}

/** "#Kitchen, interiors  #مطابخ" → ["Kitchen", "interiors", "مطابخ"]; at most 30, no duplicates. */
export function normaliseHashtags(input: string | readonly string[]): string[] {
  const parts = (typeof input === "string" ? input.split(/[\s,،]+/) : input).map((t) =>
    t.trim().replace(/^#+/, ""),
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (!/^[\p{L}\p{N}_]{1,60}$/u.test(p)) continue;
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length === 30) break;
  }
  return out;
}

export interface PostText {
  language: SocialLanguageKey;
  captionEn: string | null;
  captionAr: string | null;
  hashtags: readonly string[];
}

/** What is missing before the post can go for approval (empty when ready). */
export function missingForApproval(
  p: PostText & {
    type: SocialPostTypeKey;
    platforms: readonly SocialPlatformKey[];
    imageFileId: string | null;
  },
): string[] {
  const missing: string[] = [];
  if (p.platforms.length === 0) missing.push("Choose at least one platform.");
  if ((p.language === "en" || p.language === "both") && !p.captionEn?.trim())
    missing.push("Write the English caption.");
  if ((p.language === "ar" || p.language === "both") && !p.captionAr?.trim())
    missing.push("Write the Arabic caption.");
  if ((p.type === "image" || p.type === "story") && !p.imageFileId) missing.push("Choose the photo.");
  if (composeCaption(p).length > 2200)
    missing.push("The caption with hashtags is longer than 2,200 characters.");
  return missing;
}

/** The text that is published: Arabic first when both, then the hashtags. */
export function composeCaption(p: PostText): string {
  const parts: string[] = [];
  if ((p.language === "ar" || p.language === "both") && p.captionAr?.trim()) parts.push(p.captionAr.trim());
  if ((p.language === "en" || p.language === "both") && p.captionEn?.trim()) parts.push(p.captionEn.trim());
  if (p.hashtags.length) parts.push(p.hashtags.map((h) => `#${h}`).join(" "));
  return parts.join("\n\n");
}

const DAY = 24 * 60 * 60 * 1000;
/** Bahrain is UTC+3 all year. */
const OFFSET = 3 * 60 * 60 * 1000;

/** "2026-11-14" (a Bahrain calendar day) for an instant. */
export function bahrainDay(d: Date): string {
  return new Date(d.getTime() + OFFSET).toISOString().slice(0, 10);
}

/** The instant a Bahrain calendar day starts. */
export function dayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - OFFSET);
}

/** "2026-11-14" and "10:30" (Bahrain time) → the instant; null when either is invalid. */
export function bahrainDateTime(day: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const t = Date.parse(`${day}T${time}:00Z`);
  return Number.isNaN(t) ? null : new Date(t - OFFSET);
}

/** Bahrain time of day, "10:30". */
export function bahrainTime(d: Date): string {
  return new Date(d.getTime() + OFFSET).toISOString().slice(11, 16);
}

const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/**
 * The days shown in the calendar. Weeks start on Saturday (as in the reports). A month view shows the
 * whole weeks that contain the month.
 */
export function calendarDays(
  view: "week" | "month",
  anchorDay: string,
): { days: string[]; start: Date; end: Date } {
  const weekStart = (day: string) => {
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 Sunday … 6 Saturday
    return addDays(day, -((dow + 1) % 7));
  };
  let first: string;
  let count: number;
  if (view === "week") {
    first = weekStart(anchorDay);
    count = 7;
  } else {
    const monthFirst = `${anchorDay.slice(0, 7)}-01`;
    const next = new Date(Date.parse(`${monthFirst}T00:00:00Z`));
    next.setUTCMonth(next.getUTCMonth() + 1);
    const monthLast = addDays(next.toISOString().slice(0, 10), -1);
    first = weekStart(monthFirst);
    const lastWeekEnd = addDays(weekStart(monthLast), 6);
    count = Math.round((Date.parse(lastWeekEnd) - Date.parse(first)) / DAY) + 1;
  }
  const days = Array.from({ length: count }, (_, i) => addDays(first, i));
  return { days, start: dayStart(days[0]!), end: dayStart(addDays(days.at(-1)!, 1)) };
}

/** The anchor day of the previous or next week/month. */
export function shiftAnchor(view: "week" | "month", anchorDay: string, by: -1 | 1): string {
  if (view === "week") return addDays(anchorDay, 7 * by);
  const d = new Date(Date.parse(`${anchorDay.slice(0, 7)}-01T00:00:00Z`));
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 10);
}

/** Likes + comments + shares (unknown figures count as 0). */
export function engagementTotal(t: { likes: number | null; comments: number | null; shares: number | null }) {
  return (t.likes ?? 0) + (t.comments ?? 0) + (t.shares ?? 0);
}
