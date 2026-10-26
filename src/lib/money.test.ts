import { describe, expect, it } from "vitest";
import { formatDimensions } from "./dimensions";
import {
  computeTotals,
  filsToInput,
  formatBhd,
  formatRate,
  lineTotal,
  parseBhd,
  parseQuantity,
  quantityToText,
} from "./money";

describe("money", () => {
  it("parses dinar amounts into integer fils", () => {
    expect(parseBhd("1,234.5")).toBe(1_234_500);
    expect(parseBhd("0.005")).toBe(5);
    expect(parseBhd("12")).toBe(12_000);
    expect(parseBhd(" ١٢٣٫٤٥٠ ")).toBe(123_450);
    expect(parseBhd("1.2345")).toBeNull();
    expect(parseBhd("-5")).toBeNull();
    expect(parseBhd("abc")).toBeNull();
    expect(parseBhd("")).toBeNull();
  });

  it("parses quantities to three decimals", () => {
    expect(parseQuantity("2.5")).toBe(2500);
    expect(parseQuantity("1")).toBe(1000);
    expect(quantityToText(2500)).toBe("2.5");
    expect(filsToInput(1_234_500)).toBe("1234.500");
  });

  it("rounds line totals half up to the fils", () => {
    expect(lineTotal(1000, 120_000)).toBe(120_000);
    expect(lineTotal(2500, 45_250)).toBe(113_125);
    expect(lineTotal(333, 1)).toBe(0); // 0.333 fils
    expect(lineTotal(500, 1)).toBe(1); // 0.5 fils rounds up
    expect(lineTotal(1_000_000_000, 100_000_000)).toBe(100_000_000_000_000);
  });

  it("applies the discount before VAT and keeps total = subtotal − discount + VAT", () => {
    const lines = [
      { quantityMilli: 1000, unitPriceFils: 1_200_000 },
      { quantityMilli: 3500, unitPriceFils: 85_000 },
    ];
    const noVat = computeTotals(lines, 50_000, 0);
    expect(noVat).toEqual({
      subtotalFils: 1_497_500,
      discountFils: 50_000,
      vatRateBasisPoints: 0,
      vatFils: 0,
      totalFils: 1_447_500,
    });
    const withVat = computeTotals(lines, 50_000, 1000);
    expect(withVat.vatFils).toBe(144_750);
    expect(withVat.totalFils).toBe(withVat.subtotalFils - withVat.discountFils + withVat.vatFils);
    expect(computeTotals([{ quantityMilli: 1000, unitPriceFils: 5 }], 0, 1000).vatFils).toBe(1); // 0.5 → 1
    expect(() => computeTotals(lines, 2_000_000, 0)).toThrow(RangeError);
    expect(() => computeTotals(lines, 0, 10_001)).toThrow(RangeError);
  });

  it("formats amounts with three decimals in both languages", () => {
    expect(formatBhd(1_234_500, "en")).toMatch(/BHD\s?1,234\.500/);
    const ar = formatBhd(1_234_500, "ar");
    expect(ar).toContain("1,234.500");
    expect(ar).toMatch(/د\.ب/);
    expect(formatRate(1000)).toBe("10%");
  });
});

describe("dimensions", () => {
  it("lists only the measurements given", () => {
    expect(formatDimensions({ widthMm: 4200, heightMm: null, depthMm: null })).toBe("W 4200 mm");
    expect(formatDimensions({ widthMm: 600, heightMm: 2400, depthMm: 580 }, "ar")).toBe(
      "عرض 600 × ارتفاع 2400 × عمق 580 مم",
    );
    expect(formatDimensions({ widthMm: null, heightMm: null, depthMm: null })).toBeNull();
  });
});
