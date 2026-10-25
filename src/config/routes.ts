/**
 * Public pages from the site map (docs/ARCHITECTURE.md §4). A page is linked only once it is
 * built (`ready: true`), so the site never shows links to pages that don't exist yet.
 */

export type PageKey =
  | "home"
  | "about"
  | "woodenKitchens"
  | "aluminiumKitchens"
  | "wardrobes"
  | "walkInClosets"
  | "bedroomFurniture"
  | "tvUnits"
  | "wallCladding"
  | "bathroomVanities"
  | "bespoke"
  | "materials"
  | "projects"
  | "designers"
  | "requestQuote"
  | "bookConsultation"
  | "showroom"
  | "blog"
  | "faq"
  | "contact"
  | "privacy"
  | "terms";

export const pages: Record<PageKey, { path: string; ready: boolean }> = {
  home: { path: "/", ready: true },
  about: { path: "/about", ready: true },
  woodenKitchens: { path: "/kitchens/wooden", ready: true },
  aluminiumKitchens: { path: "/kitchens/aluminium", ready: true },
  wardrobes: { path: "/wardrobes", ready: true },
  walkInClosets: { path: "/walk-in-closets", ready: true },
  bedroomFurniture: { path: "/bedroom-furniture", ready: true },
  tvUnits: { path: "/tv-units", ready: true },
  wallCladding: { path: "/wall-cladding", ready: true },
  bathroomVanities: { path: "/bathroom-vanities", ready: true },
  // "More we make": profile products without their own page (approved 2026-10-25, ARCHITECTURE.md §9).
  bespoke: { path: "/bespoke", ready: true },
  materials: { path: "/materials", ready: true },
  projects: { path: "/projects", ready: true },
  designers: { path: "/designers", ready: true },
  requestQuote: { path: "/request-a-quote", ready: true },
  bookConsultation: { path: "/book-a-consultation", ready: true },
  showroom: { path: "/showroom", ready: true },
  // No articles exist yet; the blog arrives with content management (Phase 5) and stays hidden until the first post.
  blog: { path: "/blog", ready: false },
  faq: { path: "/faq", ready: true },
  contact: { path: "/contact", ready: true },
  privacy: { path: "/privacy-policy", ready: true },
  terms: { path: "/terms", ready: true },
};

export function pathFor(key: PageKey): string {
  return pages[key].path;
}

/** The page's path if it is built, otherwise null (render plain text instead of a link). */
export function hrefFor(key: PageKey): string | null {
  const page = pages[key];
  return page.ready ? page.path : null;
}
