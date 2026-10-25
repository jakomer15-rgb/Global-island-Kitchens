/**
 * Main navigation. While only the homepage exists, items jump to homepage sections; in Phase 3
 * they point to the full pages (src/config/routes.ts).
 */
export const navItems = [
  { key: "products", hash: "products" },
  { key: "materials", hash: "materials" },
  { key: "process", hash: "process" },
  { key: "projects", hash: "projects" },
  { key: "showroom", hash: "showroom" },
] as const;

export type NavKey = (typeof navItems)[number]["key"];
