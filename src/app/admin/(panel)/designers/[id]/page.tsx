import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTextarea } from "@/components/admin/fields";
import { Badge, fmtDate, fmtDateTime, label, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { CUID } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { db } from "@/server/db";
import { getDesignerAccount } from "@/server/designers/admin";
import { NotFoundError } from "@/server/errors";
import { decideDesignerAction } from "../actions";
import { designerTone } from "../tones";

export const metadata: Metadata = { title: "Designer" };

export default async function DesignerPage({ params }: PageProps<"/admin/designers/[id]">) {
  const actor = await requireActor("designer.read");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  const d = await getDesignerAccount(db, actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const canManage = can(actor, "designer.manage");

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/designers" className="underline underline-offset-4">
          ← All designers
        </Link>
      </p>
      <PageHeader
        title={d.user.name}
        description={`${label(d.profession)}${d.company ? ` · ${d.company}` : ""}`}
        actions={<Badge tone={designerTone[d.status]}>{label(d.status)}</Badge>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel title="Projects submitted">
            {d.projects.length === 0 ? (
              <p className="text-sm text-ink-muted">None yet.</p>
            ) : (
              <Table label="Designer projects">
                <thead>
                  <tr>
                    <Th>Project</Th>
                    <Th>Reference</Th>
                    <Th>Sent</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.projects.map((p) => (
                    <tr key={p.id}>
                      <Td>{p.title}</Td>
                      <Td>
                        <Link
                          href={`/admin/leads/${p.request.leadId}`}
                          className="font-mono text-xs underline"
                        >
                          {p.request.reference}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap">{fmtDate(p.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Contact">
            <p dir="ltr" className="text-sm">
              {d.phone}
            </p>
            <p className="text-sm break-all">{d.user.email}</p>
            <p className="mt-2 text-xs text-ink-muted">
              Registered {fmtDateTime(d.createdAt)}
              {d.user.lastLoginAt
                ? ` · last sign-in ${fmtDateTime(d.user.lastLoginAt)}`
                : " · never signed in"}
            </p>
            {d.decidedBy && d.decidedAt && (
              <p className="mt-2 text-xs text-ink-muted">
                {label(d.status)} by {d.decidedBy.name} on {fmtDateTime(d.decidedAt)}
                {d.statusNote ? `: ${d.statusNote}` : ""}
              </p>
            )}
          </Panel>
          {canManage && (
            <Panel title="Decision">
              {d.status !== "approved" && (
                <ActionForm
                  action={decideDesignerAction.bind(null, d.id, "approved")}
                  submitLabel="Approve designer"
                  confirm="Approve this designer? They can then send projects and see their own status."
                />
              )}
              {d.status !== "rejected" && d.status !== "suspended" && (
                <ActionForm
                  action={decideDesignerAction.bind(
                    null,
                    d.id,
                    d.status === "approved" ? "suspended" : "rejected",
                  )}
                  submitLabel={d.status === "approved" ? "Suspend access" : "Reject registration"}
                  variant="outline"
                  className="mt-6"
                  confirm={
                    d.status === "approved"
                      ? "Suspend this designer? They are signed out at once."
                      : undefined
                  }
                >
                  <AdminTextarea
                    label="Reason (shown to the designer)"
                    name="note"
                    rows={2}
                    required
                    maxLength={500}
                  />
                </ActionForm>
              )}
              {(d.status === "rejected" || d.status === "suspended") && (
                <p className="text-sm text-ink-muted">
                  Approve to give access again. The reason you gave is shown to the designer meanwhile.
                </p>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
