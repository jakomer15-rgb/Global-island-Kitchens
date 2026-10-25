/**
 * Permissions are fine-grained; roles are sets of them (seeded; the owner can change role
 * permissions in the admin). Roles follow the team structure in the company profile (P2).
 * Every service checks a permission.
 */
export const permissions = {
  "lead.read": "View leads, enquiries and their history",
  "lead.update": "Change lead status, add notes, log communication and schedule follow-ups",
  "lead.assign": "Assign leads to staff",
  "customer.read": "View customer records",
  "customer.update": "Edit customer records",
  "consultation.read": "View consultation requests",
  "consultation.update": "Confirm, complete or cancel consultations",
  "file.read": "Download files customers uploaded",
  "content.manage": "Edit homepage text, banner, SEO, testimonials, blog posts and website images",
  "materials.manage": "Manage the materials library (EGGER décors and painted MDF colours)",
  "portfolio.manage": "Edit portfolio projects and their photos",
  "settings.manage": "Change contact details, opening hours and the WhatsApp number",
  "staff.manage": "Create staff accounts and change roles",
  "audit.read": "View the audit log",
} as const;

export type Permission = keyof typeof permissions;

export const allPermissions = Object.keys(permissions) as Permission[];

export const roleDefinitions: {
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
}[] = [
  {
    key: "owner",
    name: "Owner (Managing Director)",
    description: "Full access",
    permissions: allPermissions,
  },
  {
    key: "general_manager",
    name: "General Manager",
    description: "Everything except staff and role management",
    permissions: allPermissions.filter((p) => p !== "staff.manage"),
  },
  {
    key: "sales_manager",
    name: "Sales & Project Manager",
    description: "Leads, customers, consultations and their files",
    permissions: [
      "lead.read",
      "lead.update",
      "lead.assign",
      "customer.read",
      "customer.update",
      "consultation.read",
      "consultation.update",
      "file.read",
    ],
  },
  {
    key: "production_supervisor",
    name: "Technical & Production Supervisor",
    description: "Reads enquiries and drawings; maintains the materials library",
    permissions: ["lead.read", "customer.read", "consultation.read", "file.read", "materials.manage"],
  },
  {
    key: "content_editor",
    name: "Content Editor",
    description: "Website content, materials, portfolio and contact details",
    permissions: ["content.manage", "materials.manage", "portfolio.manage", "settings.manage"],
  },
];
