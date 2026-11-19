import { bahrainDay, dayStart } from "./social";

/**
 * Autopilot (2026-11-19, owner's request): the AI sends replies, prospect emails and social media posts
 * without a person approving each one, within limits. Everything it approves carries this note, so it can
 * be told apart from a person's approval, counted against the limits, and stopped by the OFF switch.
 */
export const AUTOPILOT_NOTE = "Approved automatically by Autopilot";
export const AUTOPILOT_HELD = "Held by Autopilot for a person";

export const isAutopilotDecision = (note: string | null | undefined) => note === AUTOPILOT_NOTE;

/** The instant the current Bahrain day started (daily limits reset at midnight in Bahrain). */
export function bahrainDayStarted(now = new Date()): Date {
  return dayStart(bahrainDay(now));
}

export type HoldReason =
  "money" | "promise" | "link" | "email" | "placeholder" | "material" | "claim" | "empty";

export const holdReasonNames: Record<HoldReason, { en: string; ar: string }> = {
  money: { en: "mentions a price, cost or discount", ar: "يذكر سعرًا أو تكلفة أو خصمًا" },
  promise: { en: "promises a time, delivery or warranty", ar: "يعد بمدة أو تسليم أو ضمان" },
  link: { en: "links to another website", ar: "يحتوي رابطًا لموقع آخر" },
  email: { en: "contains an email address", ar: "يحتوي عنوان بريد إلكتروني" },
  placeholder: { en: "has an unfinished placeholder", ar: "فيه نص مؤقت غير مكتمل" },
  material: { en: "mentions a material or brand we don't use", ar: "يذكر مادة أو علامة لا نستخدمها" },
  claim: { en: "states numbers of projects or clients", ar: "يذكر أعداد مشاريع أو عملاء" },
  empty: { en: "is empty or too short", ar: "فارغ أو قصير جدًا" },
};

/** Arabic-Indic and Persian digits as 0–9, so numbers written in Arabic are checked too. */
const western = (s: string) => s.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));

const checks: [HoldReason, RegExp[]][] = [
  [
    "money",
    [
      /\b(BHD|BD|USD|SAR|AED|KWD|QAR|OMR|dinars?|fils|riyals?|dirhams?)\b/i,
      /[$€£]/,
      /\b(prices?|priced|pricing|costs?|costing|discounts?|discounted|cheap(er|est)?|affordable|bargain|sale|promotion|promo|deal)\b/i,
      /\bfree\s+(of\s+charge|consultation|delivery|installation|design|quote|quotation|measurement|visit)/i,
      /\d\s*%/,
      /دينار|د\.ب|ريال|درهم|فلس|سعر|أسعار|الاسعار|تكلف|خصم|تخفيض|عروض|عرض خاص|مجان|رخيص/,
    ],
  ],
  [
    "promise",
    [
      /\b\d+\s*(?:[-–]|to)?\s*\d*\s*(?:working\s+|business\s+)?(?:days?|weeks?|months?|hours?|years?\s+(?:warranty|guarantee))\b/i,
      /\b(warrant(y|ies|ed)|guarantee[sd]?|lifetime|deadline|delivered by|ready by|on time)\b/i,
      /ضمان|كفالة|مضمون|\d+\s*(?:يوم|أيام|ايام|أسبوع|أسابيع|اسابيع|شهر|أشهر|اشهر|ساعة|ساعات)/,
    ],
  ],
  ["link", [/(?:https?:\/\/|www\.)(?!(?:www\.)?globalislandkitchens\.com\b)\S+/i]],
  ["email", [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/]],
  ["placeholder", [/\{[a-z_]+\}|\[[^\]\n]{1,40}\]|lorem ipsum|\bTODO\b|\bXXX\b|<[^>]+>/i]],
  [
    "material",
    [
      /\b(solid\s+wood|hardwood|oak|walnut|teak|beech|maple|granite|marble|quartz|corian|veneer|stainless\s+steel|plywood|bamboo|Blum|Hettich|Kronospan|Formica|Hafele|Häfele)\b/i,
      /خشب طبيعي|خشب صلب|خشب زان|رخام|جرانيت|غرانيت|كوارتز|قشرة خشب|ستانلس/,
    ],
  ],
  [
    "claim",
    [
      /\b\d[\d,]*\+?\s*(?:happy\s+|satisfied\s+)?(projects|clients|customers|homes|kitchens|families|villas)\b/i,
      /\d+\s*\+?\s*(?:مشروع|مشاريع|عميل|عملاء|منزل|مطبخ)/,
    ],
  ],
];

/**
 * Why the text must wait for a person (empty: it may go out automatically). Deliberately strict: a false
 * alarm only means a person looks at it; a miss means a wrong promise in the company's name.
 */
export function heldReasons(text: string): HoldReason[] {
  const t = western(text ?? "");
  if (t.replace(/\s+/g, "").length < 10) return ["empty"];
  return checks.filter(([, patterns]) => patterns.some((p) => p.test(t))).map(([reason]) => reason);
}

export function holdText(reasons: readonly HoldReason[], lang: "en" | "ar" = "en"): string {
  return reasons.map((r) => holdReasonNames[r][lang]).join(lang === "ar" ? "، " : ", ");
}
