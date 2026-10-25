import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox } from "@/components/admin/fields";
import { PageHeader, Panel } from "@/components/admin/ui";
import { listRoles } from "@/server/admin/staff";
import { allPermissions, permissions } from "@/server/auth/permissions";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { rolePermissionsAction } from "../actions";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  const actor = await requireActor("staff.manage");
  const roles = await listRoles(db, actor);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/staff" className="underline underline-offset-4">
          ← Staff
        </Link>
      </p>
      <PageHeader
        title="Roles and permissions"
        description="What each role can do. The owner role always has everything."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {roles.map((role) => {
          const granted = new Set(role.permissions.map((p) => p.permissionKey));
          const owner = role.key === "owner";
          return (
            <Panel key={role.id} title={`${role.name} (${role._count.users})`}>
              <p className="mb-3 text-sm text-ink-muted">{role.description}</p>
              {owner ? (
                <p className="text-sm">All permissions.</p>
              ) : (
                <ActionForm action={rolePermissionsAction.bind(null, role.id)} submitLabel="Save permissions">
                  <fieldset>
                    <legend className="sr-only">Permissions for {role.name}</legend>
                    {allPermissions.map((p) => (
                      <AdminCheckbox
                        key={p}
                        name="permissions"
                        value={p}
                        defaultChecked={granted.has(p)}
                        label={
                          <span>
                            {permissions[p]} <code className="text-xs text-ink-muted">{p}</code>
                          </span>
                        }
                      />
                    ))}
                  </fieldset>
                </ActionForm>
              )}
            </Panel>
          );
        })}
      </div>
    </>
  );
}
