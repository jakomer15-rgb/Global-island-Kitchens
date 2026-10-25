import { describe, expect, it } from "vitest";
import { pages } from "@/config/routes";
import { faqs } from "./faq";
import { privacy, terms } from "./legal";
import * as pageCopy from "./pages";
import { moreProducts, products, type ProductKey } from "./products";
import { projects, projectsWithScope } from "./projects";

/** Every { en, ar } pair anywhere inside a value. */
function pairs(value: unknown, path = "root"): { path: string; en: unknown; ar: unknown }[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => pairs(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("en" in obj && "ar" in obj) return [{ path, en: obj.en, ar: obj.ar }];
    return Object.entries(obj).flatMap(([k, v]) => pairs(v, `${path}.${k}`));
  }
  return [];
}

const all = { products, moreProducts, projects, faqs, privacy, terms, ...pageCopy };
const allPairs = pairs(all);
const english = allPairs
  .flatMap((p) => (Array.isArray(p.en) ? p.en : [p.en]))
  .join("\n")
  .toLowerCase();

describe("content", () => {
  it("has English and Arabic for every entry, non-empty, with matching list lengths", () => {
    const problems = allPairs.filter((p) => {
      if (Array.isArray(p.en))
        return !Array.isArray(p.ar) || p.en.length !== p.ar.length || p.ar.some((s) => !s);
      return typeof p.en !== "string" || typeof p.ar !== "string" || !p.en.trim() || !p.ar.trim();
    });
    expect(problems.map((p) => p.path)).toEqual([]);
  });

  it("follows the materials rule (no solid wood, timber, veneer or lacquer claims)", () => {
    // "No solid wood or veneer" statements are allowed; claims are not.
    const text = english.replace(/no solid wood or veneer/g, "").replace(/made of solid wood\?/g, "");
    for (const word of ["solid wood", "timber", "veneer", "lacquer", "natural wood", "all wood"]) {
      expect(text, word).not.toContain(word);
    }
  });

  it("never implies an EGGER partnership", () => {
    for (const phrase of ["official partner", "authorised dealer", "authorized dealer", "certified"]) {
      expect(english).not.toContain(phrase);
    }
  });

  it("names no clients, developers or contractors from the profile (permission pending)", () => {
    for (const name of [
      "11 pearls",
      "kooheji",
      "dadabai",
      "black sand",
      "nexum",
      "al rashdan",
      "kadi construction",
      "almoayyed",
      "pineapple",
      "derby",
      "selvis",
      "trolly",
    ]) {
      expect(english, name).not.toContain(name);
    }
  });

  it("keeps meta titles and descriptions within search limits", () => {
    const metas = [
      ...products.flatMap((p) => [p.metaTitle, p.metaDescription]),
      ...Object.values(pageCopy).flatMap((c) => [c.metaTitle, c.metaDescription]),
      privacy.metaTitle,
      terms.metaTitle,
    ];
    for (const m of metas) {
      for (const text of [m.en, m.ar]) expect(text.length, text).toBeLessThanOrEqual(170);
    }
    // Titles get " | Global Island Kitchens" (25 characters) appended.
    for (const p of products) expect(p.metaTitle.en.length + 25, p.metaTitle.en).toBeLessThanOrEqual(60);
  });

  it("has a page for every product and unique project slugs", () => {
    for (const p of products) expect(pages[p.key as ProductKey].ready).toBe(true);
    expect(pages.bespoke.ready).toBe(true);
    const slugs = projects.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("links projects to products only by their stated scope", () => {
    expect(projectsWithScope([]).length).toBe(0);
    expect(projectsWithScope(["kitchens"]).every((p) => p.scope.includes("kitchens"))).toBe(true);
    expect(
      projectsWithScope(["kitchens"]).some(
        (p) => p.scope.includes("fullJoinery") && !p.scope.includes("kitchens"),
      ),
    ).toBe(false);
  });
});
