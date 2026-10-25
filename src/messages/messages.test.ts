import { describe, expect, it } from "vitest";
import ar from "./ar.json";
import en from "./en.json";

/** Every key path in a nested messages object, e.g. "Hero.facts.years". */
function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function leaves(obj: object): string[] {
  return Object.values(obj).flatMap((v) => (typeof v === "object" && v !== null ? leaves(v) : [String(v)]));
}

describe("messages", () => {
  it("has the same keys in English and Arabic", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it("uses the same placeholders and rich-text tags in both languages", () => {
    const tokens = (s: string) => (s.match(/\{\w+\}|<\/?\w+>/g) ?? []).sort().join(" ");
    const enKeys = keys(en);
    const get = (obj: object, path: string) =>
      path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj) as string;
    const mismatched = enKeys.filter((k) => tokens(get(en, k)) !== tokens(get(ar, k)));
    expect(mismatched).toEqual([]);
  });

  it("has no empty strings", () => {
    expect([...leaves(en), ...leaves(ar)].filter((s) => s.trim() === "")).toEqual([]);
  });

  it("never claims solid wood, timber, veneer or lacquer (content rules)", () => {
    const text = leaves(en).join("\n").toLowerCase();
    for (const word of ["solid wood", "timber", "veneer", "lacquer", "natural wood"]) {
      expect(text, word).not.toContain(word);
    }
  });

  it("never implies an EGGER partnership", () => {
    const text = leaves(en).join("\n").toLowerCase();
    for (const phrase of ["official partner", "authorised dealer", "authorized dealer", "certified egger"]) {
      expect(text).not.toContain(phrase);
    }
  });

  it("uses the same numeric facts in both languages", () => {
    const digits = (s: string) => (s.match(/\d+/g) ?? []).join(",");
    expect(digits(ar.Hero.intro)).toBe(digits(en.Hero.intro));
    expect(digits(ar.Projects.intro)).toBe(digits(en.Projects.intro));
  });
});
