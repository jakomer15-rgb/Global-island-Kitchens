import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput } from "@/components/admin/fields";
import { Badge, fmtDateTime, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { listRoles, listStaff } from "@/server/admin/staff";
import { PASSWORD_MIN } from "@/server/auth/accounts";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { createStaffAction, staffPasswordAction, staffRolesAction, staffStatusAction } from "./actions";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const actor = await requireActor("staff.manage");
  const [staff, roles] = await Promise.all([listStaff(db, actor), listRoles(db, actor)]);
  const actorIsOwner = actor.roles.includes("owner");
  const grantable = roles.filter((r) => r.key !== "owner" || actorIsOwner);

  return (
    <>
      <PageHeader
        title="Staff"
        description="Staff accounts and their roles. Nobody can sign up on the website; accounts are created here."
        actions={
          <Link href="/admin/staff/roles" className="text-sm underline underline-offset-4">
            Roles and permissions
          </Link>
        }
      />

      <Table label="Staff accounts">
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Roles</Th>
            <Th>Last sign-in</Th>
            <Th>Account</Th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => {
            const self = s.id === actor.id;
            const keys = s.roles.map((r) => r.role.key);
            const locked = self || (keys.includes("owner") && !actorIsOwner);
            return (
              <tr key={s.id} className="align-top">
                <Td>
                  <span className="font-medium">{s.name}</span> {self && <Badge>You</Badge>}
                  <span className="block text-xs break-all">{s.email}</span>
                  {s.status === "disabled" && <Badge tone="bad">Disabled</Badge>}
                </Td>
                <Td>
                  {locked ? (
                    <span>{s.roles.map((r) => r.role.name).join(", ")}</span>
                  ) : (
                    <details>
                      <summary className="cursor-pointer">
                        {s.roles.map((r) => r.role.name).join(", ")}
                      </summary>
                      <ActionForm
                        action={staffRolesAction.bind(null, s.id)}
                        submitLabel="Save roles"
                        className="mt-2"
                      >
                        <fieldset>
                          <legend className="sr-only">Roles for {s.name}</legend>
                          {grantable.map((r) => (
                            <AdminCheckbox
                              key={r.id}
                              name="roles"
                              value={r.key}
                              defaultChecked={keys.includes(r.key)}
                              label={r.name}
                            />
                          ))}
                        </fieldset>
                      </ActionForm>
                    </details>
                  )}
                </Td>
                <Td className="whitespace-nowrap">{s.lastLoginAt ? fmtDateTime(s.lastLoginAt) : "Never"}</Td>
                <Td>
                  {!locked && (
                    <div className="space-y-3">
                      {s.status === "active" ? (
                        <ActionForm
                          action={staffStatusAction.bind(null, s.id, "disabled")}
                          submitLabel="Disable"
                          variant="outline"
                          confirm={`Disable ${s.name}? They will be signed out immediately.`}
                        />
                      ) : (
                        <ActionForm
                          action={staffStatusAction.bind(null, s.id, "active")}
                          submitLabel="Enable"
                          variant="outline"
                        />
                      )}
                      <details>
                        <summary className="cursor-pointer text-sm">Set a new password</summary>
                        <ActionForm
                          action={staffPasswordAction.bind(null, s.id)}
                          submitLabel="Set password"
                          resetOnSuccess
                          className="mt-2"
                        >
                          <AdminInput
                            label="New password"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            minLength={PASSWORD_MIN}
                            required
                          />
                        </ActionForm>
                      </details>
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <Panel title="Add a staff member" className="mt-8 max-w-2xl">
        <ActionForm action={createStaffAction} submitLabel="Create account" resetOnSuccess>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminInput label="Full name" name="name" required maxLength={100} autoComplete="off" />
            <AdminInput label="Email" name="email" type="email" required autoComplete="off" dir="ltr" />
          </div>
          <AdminInput
            label="Temporary password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            required
            hint={`At least ${PASSWORD_MIN} characters. Give it to them in person, not by email.`}
          />
          <fieldset>
            <legend className="text-sm font-medium">Roles</legend>
            {grantable.map((r) => (
              <AdminCheckbox
                key={r.id}
                name="roles"
                value={r.key}
                label={
                  <span>
                    {r.name} <span className="text-ink-muted">— {r.description}</span>
                  </span>
                }
              />
            ))}
          </fieldset>
        </ActionForm>
      </Panel>
    </>
  );
}
