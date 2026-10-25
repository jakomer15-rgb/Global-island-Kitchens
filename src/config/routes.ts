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
  about: { path: "/about", ready: false },
  woodenKitchens: { path: "/kitchens/wooden", ready: false },
  aluminiumKitchens: { path: "/kitchens/aluminium", ready: false },
  wardrobes: { path: "/wardrobes", ready: false },
  walkInClosets: { path: "/walk-in-closets", ready: false },
  bedroomFurniture: { path: "/bedroom-furniture", ready: false },
  tvUnits: { path: "/tv-units", ready: false },
  wallCladding: { path: "/wall-cladding", ready: false },
  bathroomVanities: { path: "/bathroom-vanities", ready: false },
  materials: { path: "/materials", ready: false },
  projects: { path: "/projects", ready: false },
  designers: { path: "/designers", ready: false },
  requestQuote: { path: "/request-a-quote", ready: false },
  bookConsultation: { path: "/book-a-consultation", ready: false },
  showroom: { path: "/showroom", ready: false },
  blog: { path: "/blog", ready: false },
  faq: { path: "/faq", ready: false },
  contact: { path: "/contact", ready: false },
  privacy: { path: "/privacy-policy", ready: false },
  terms: { path: "/terms", ready: false },
};

/** The page's path if it is built, otherwise null (render plain text instead of a link). */
export function hrefFor(key: PageKey): string | null {
  const page = pages[key];
  return page.ready ? page.path : null;
}
