/**
 * Normalises a phone number to E.164. Local Bahrain numbers (8 digits) get +973; numbers written
 * with 00 or + keep their country code. Returns null when it can't be a valid number.
 */
export function normalisePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/[\s\-().]/g, "");
  // Arabic-Indic and Persian digits → ASCII
  digits = digits
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (/^\d{8}$/.test(digits)) digits = `+973${digits}`;
  if (!/^\+[1-9]\d{6,14}$/.test(digits)) return null;
  // Bahrain numbers are always 8 digits after +973.
  if (digits.startsWith("+973") && digits.length !== 12) return null;
  return digits;
}
