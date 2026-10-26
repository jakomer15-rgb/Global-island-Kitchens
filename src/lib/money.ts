/**
 * Bahraini dinar amounts as integer fils (1 BHD = 1000 fils), never floating-point money.
 * Shared by the quotation editor (live totals) and the server (which recalculates and stores).
 * The database checks the same arithmetic (migration 20261026120000_quotations_projects).
 */

export const FILS_PER_BHD = 1000;
/** Upper bounds keep every product well inside JavaScript's exact integer range. */
export const MAX_UNIT_PRICE_FILS = 100_000_000; // BHD 100,000 per unit
export const MAX_QUANTITY_MILLI = 1_000_000_000; // 1,000,000 units
export const MAX_LINES = 200;

const arabicDigits = /[٠-٩۰-۹]/g;

/** Western digits, no grouping separators or spaces; Arabic decimal comma → dot. */
function normalise(input: string): string {
  return input
    .trim()
    .replace(arabicDigits, (d) => String((d.charCodeAt(0) & 0xf) % 10))
    .replace(/٫/g, ".")
    .replace(/[\s,٬]/g, "");
}

/** Parses a decimal with up to `places` decimals into an integer scaled by 10^places. */
function parseScaled(input: string, places: number): number | null {
  const s = normalise(input);
  const match = new RegExp(`^(\\d{1,12})(?:\\.(\\d{0,${places}}))?$`).exec(s);
  if (!match) return null;
  const whole = Number(match[1]);
  const frac = Number((match[2] ?? "").padEnd(places, "0") || "0");
  const value = whole * 10 ** places + frac;
  return Number.isSafeInteger(value) ? value : null;
}

/** "1,234.5" → 1234500 fils. Up to three decimals; null when invalid. */
export function parseBhd(input: string): number | null {
  return parseScaled(input, 3);
}

/** "2.5" → 2500 (thousandths). Up to three decimals; null when invalid. */
export function parseQuantity(input: string): number | null {
  return parseScaled(input, 3);
}

/** 1234500 → "1234.500" (for form inputs). */
export function filsToInput(fils: number): string {
  return (fils / FILS_PER_BHD).toFixed(3);
}

/** 2500 → "2.5" (for form inputs and documents). */
export function quantityToText(milli: number): string {
  return String(milli / 1000);
}

/** Rounds n / d half up, for non-negative integers. */
function roundDiv(n: number, d: number): number {
  return Math.floor((n + d / 2) / d);
}

/** Quantity (thousandths) × unit price, rounded half up to the fils. */
export function lineTotal(quantityMilli: number, unitPriceFils: number): number {
  return roundDiv(quantityMilli * unitPriceFils, 1000);
}

export interface Totals {
  subtotalFils: number;
  discountFils: number;
  vatRateBasisPoints: number;
  vatFils: number;
  totalFils: number;
}

/**
 * Subtotal of the lines, minus the discount, plus VAT on the discounted amount (rounded half up).
 * `vatRateBasisPoints` is 0 when the company doesn't charge VAT (1000 = 10%).
 */
export function computeTotals(
  lines: { quantityMilli: number; unitPriceFils: number }[],
  discountFils: number,
  vatRateBasisPoints: number,
): Totals {
  const subtotalFils = lines.reduce((sum, l) => sum + lineTotal(l.quantityMilli, l.unitPriceFils), 0);
  if (discountFils < 0 || discountFils > subtotalFils) throw new RangeError("discount");
  if (!Number.isInteger(vatRateBasisPoints) || vatRateBasisPoints < 0 || vatRateBasisPoints > 10_000)
    throw new RangeError("vat");
  const vatFils = roundDiv((subtotalFils - discountFils) * vatRateBasisPoints, 10_000);
  return {
    subtotalFils,
    discountFils,
    vatRateBasisPoints,
    vatFils,
    totalFils: subtotalFils - discountFils + vatFils,
  };
}

/** "BHD 1,234.500" / "1,234.500 د.ب." (Western digits on both sites). */
export function formatBhd(fils: number, locale: "en" | "ar" = "en"): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-BH-u-nu-latn" : "en-BH", {
    style: "currency",
    currency: "BHD",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(fils / FILS_PER_BHD);
}

/** 1000 → "10%", 550 → "5.5%". */
export function formatRate(basisPoints: number): string {
  return `${basisPoints / 100}%`;
}
