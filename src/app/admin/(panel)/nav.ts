import type { NavGroup } from "@/components/admin/shell";
import { centreText, type CentreLang } from "@/content/automation-centre";
import type { Permission } from "@/server/auth/permissions";

type Label = string | { en: string; ar: string };

/** Admin navigation; each item shows only for staff with its permission (or any of several). */
const groups: {
  label: Label;
  items: { href: string; label: Label; permission: Permission | Permission[]; exact?: boolean }[];
}[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", permission: "lead.read" },
      { href: "/admin/follow-ups", label: "Follow-ups", permission: "lead.read" },
    ],
  },
  {
    // Labels follow the language chosen inside the Centre; the other groups stay English for now.
    label: centreText.navGroup,
    items: [
      {
        href: "/admin/automation",
        label: centreText.nav.overview,
        permission: "automation.read",
        exact: true,
      },
      { href: "/admin/automation/approvals", label: centreText.nav.approvals, permission: "automation.read" },
      { href: "/admin/ai-sales", label: centreText.agents.sales.name, permission: "lead.read" },
      { href: "/admin/ai-agent", label: centreText.modules.knowledge, permission: "chat.manage" },
      { href: "/admin/analytics", label: centreText.nav.analytics, permission: "analytics.read" },
      {
        href: "/admin/automation/integrations",
        label: centreText.nav.integrations,
        permission: "automation.read",
      },
      { href: "/admin/automation/logs", label: centreText.nav.logs, permission: "automation.read" },
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
    label: "Marketing",
    items: [
      { href: "/admin/marketing", label: "Prospects", permission: "marketing.manage", exact: true },
      { href: "/admin/marketing/places", label: "Find businesses", permission: "marketing.manage" },
      { href: "/admin/marketing/campaigns", label: "Campaigns", permission: "marketing.manage" },
      { href: "/admin/marketing/reports", label: "Lead generation report", permission: "marketing.manage" },
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
    // After Website, so content editors still start on the homepage editor.
    label: "Social media",
    items: [
      { href: "/admin/social", label: "Content calendar", permission: "social.manage", exact: true },
      { href: "/admin/social/posts", label: "All posts", permission: "social.manage" },
      { href: "/admin/social/plan", label: "Plan with AI", permission: "social.manage" },
      { href: "/admin/social/campaigns", label: "Social campaigns", permission: "social.manage" },
      { href: "/admin/social/performance", label: "Performance", permission: "social.manage" },
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

const text = (l: Label, lang: CentreLang) => (typeof l === "string" ? l : l[lang]);

export function adminNav(permissions: ReadonlySet<Permission>, lang: CentreLang = "en"): NavGroup[] {
  return groups
    .map((g) => ({
      label: text(g.label, lang),
      // Arabic labels need the right direction even inside the English sidebar.
      lang: typeof g.label === "string" ? undefined : lang,
      items: g.items
        .filter((i) => [i.permission].flat().some((p) => permissions.has(p)))
        .map(({ href, label, exact }) => ({ href, label: text(label, lang), exact })),
    }))
    .filter((g) => g.items.length > 0);
}

/** Where to send someone after sign-in: the first page they may open. */
export function firstAdminPage(permissions: ReadonlySet<Permission>): string {
  return adminNav(permissions)[0]?.items[0]?.href ?? "/admin/no-access";
}
