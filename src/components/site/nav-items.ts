import type { PageKey } from "@/config/routes";

/** Product pages in the "What we make" menu, in the brief's order. */
export const productNavKeys = [
  "woodenKitchens",
  "aluminiumKitchens",
  "wardrobes",
  "walkInClosets",
  "bedroomFurniture",
  "tvUnits",
  "wallCladding",
  "bathroomVanities",
] as const satisfies readonly PageKey[];

/** Top-level links after the products menu: [page, Nav message key]. */
export const mainNavItems = [
  ["projects", "projects"],
  ["designers", "designers"],
  ["about", "about"],
  ["showroom", "showroom"],
  ["contact", "contact"],
] as const satisfies readonly (readonly [PageKey, string])[];

export interface NavLink {
  href: string;
  label: string;
}
