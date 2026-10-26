const labels = {
  en: { w: "W", h: "H", d: "D", unit: "mm" },
  ar: { w: "عرض", h: "ارتفاع", d: "عمق", unit: "مم" },
} as const;

/** "W 4200 × H 2400 mm": only the measurements that were given; null when none. */
export function formatDimensions(
  dims: { widthMm: number | null; heightMm: number | null; depthMm: number | null },
  locale: "en" | "ar" = "en",
): string | null {
  const l = labels[locale];
  const parts = [
    dims.widthMm && `${l.w} ${dims.widthMm}`,
    dims.heightMm && `${l.h} ${dims.heightMm}`,
    dims.depthMm && `${l.d} ${dims.depthMm}`,
  ].filter(Boolean);
  return parts.length ? `${parts.join(" × ")} ${l.unit}` : null;
}
