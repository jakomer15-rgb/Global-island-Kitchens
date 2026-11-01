import type { NavGroup } from "@/components/admin/shell";
import type { Permission } from "@/server/auth/permissions";

/** Admin navigation; each item shows only for staff with its permission (or any of several). */
const groups: {
  label: string;
  items: { href: string; label: string; permission: Permission | Permission[] }[];
}[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", permission: "lead.read" },
      { href: "/admin/follow-ups", label: "Follow-ups", permission: "lead.read" },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/admin/leads", label: "Leads", permission: "lead.read" },
      { href: "/admin/customers", label: "Customers", permission: "customer.read" },
      { href: "/admin/consultations", label: "Consultations", permission: "consultation.read" },
      { href: "/admin/designers", label: "Designers", permission: "designer.read" },
    ],
  },
  {
    label: "Sales and projects",
    items: [
      { href: "/admin/quotations", label: "Quotations", permission: "quotation.read" },
      { href: "/admin/orders", label: "Orders", permission: "quotation.read" },
      { href: "/admin/projects", label: "Projects", permission: "project.read" },
    ],
  },
  {
    label: "Website",
    items: [
      { href: "/admin/content", label: "Homepage and banner", permission: "content.manage" },
      { href: "/admin/categories", label: "Manage categories", permission: "catalog.manage" },
      { href: "/admin/materials", label: "Materials", permission: "materials.manage" },
      { href: "/admin/portfolio", label: "Portfolio", permission: "portfolio.manage" },
      { href: "/admin/testimonials", label: "Testimonials", permission: "content.manage" },
      { href: "/admin/blog", label: "Blog", permission: "content.manage" },
      {
        href: "/admin/media",
        label: "Website images",
        permission: ["content.manage", "materials.manage", "portfolio.manage", "catalog.manage"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/ai", label: "AI drafts", permission: ["ai.use", "ai.review"] },
      { href: "/admin/settings", label: "Settings", permission: "settings.manage" },
      { href: "/admin/staff", label: "Staff", permission: "staff.manage" },
      { href: "/admin/audit", label: "Audit log", permission: "audit.read" },
    ],
  },
];

export function adminNav(permissions: ReadonlySet<Permission>): NavGroup[] {
  return groups
    .map((g) => ({
      label: g.label,
      items: g.items
        .filter((i) => [i.permission].flat().some((p) => permissions.has(p)))
        .map(({ href, label }) => ({ href, label })),
    }))
    .filter((g) => g.items.length > 0);
}

/** Where to send someone after sign-in: the first page they may open. */
export function firstAdminPage(permissions: ReadonlySet<Permission>): string {
  return adminNav(permissions)[0]?.items[0]?.href ?? "/admin/no-access";
}
