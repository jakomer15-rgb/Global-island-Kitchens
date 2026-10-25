/**
 * Permissions are fine-grained; roles are sets of them (seeded, editable by the owner in Phase 5).
 * Roles follow the team structure in the company profile (P2). Every service checks a permission.
 */
export const permissions = {
  "lead.read": "View leads, enquiries and their history",
  "lead.update": "Update leads, add notes and follow-ups",
  "lead.assign": "Assign leads to staff",
  "customer.read": "View customer records",
  "customer.update": "Edit customer records",
  "consultation.read": "View consultation requests",
  "consultation.update": "Confirm, reschedule or close consultations",
  "file.read": "Download files customers uploaded",
  "settings.manage": "Change website settings",
  "staff.manage": "Create staff accounts and change roles",
  "audit.read": "View the audit log",
} as const;

export type Permission = keyof typeof permissions;

const all = Object.keys(permissions) as Permission[];

export const roleDefinitions: {
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
}[] = [
  { key: "owner", name: "Owner (Managing Director)", description: "Full access", permissions: all },
  {
    key: "general_manager",
    name: "General Manager",
    description: "Everything except staff and role management",
    permissions: all.filter((p) => p !== "staff.manage"),
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
    description: "Reads enquiries and drawings to plan production",
    permissions: ["lead.read", "customer.read", "consultation.read", "file.read"],
  },
  {
    key: "content_editor",
    name: "Content Editor",
    description: "Website settings and content",
    permissions: ["settings.manage"],
  },
];
