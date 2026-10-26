import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import { Badge, fmtDate, fmtDateTime, label, PageHeader, Panel } from "@/components/admin/ui";
import { filsToInput, formatBhd } from "@/lib/money";
import { CUID } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { assignableStaff } from "@/server/crm/shared";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { getProject, orderStatuses, projectStages } from "@/server/quotations/projects";
import { stageTone } from "../../quotations/tones";
import { stageAction, updateOrderAction, updateProjectAction } from "../actions";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/admin/projects/[id]">) {
  const actor = await requireActor("project.read");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  const project = await getProject(db, actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const canManage = can(actor, "project.manage");
  const staff = canManage ? await assignableStaff(db) : [];
  const current = projectStages.indexOf(project.stage);
  const order = project.order;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/projects" className="underline underline-offset-4">
          ← All projects
        </Link>
      </p>
      <PageHeader
        title={`${project.reference} · ${project.title}`}
        description={project.customer.name}
        actions={<Badge tone={stageTone[project.stage]}>{label(project.stage)}</Badge>}
      />

      <ol className="mb-8 grid grid-cols-4 gap-1 text-xs sm:grid-cols-8" aria-label="Stages">
        {projectStages.map((s, i) => (
          <li
            key={s}
            aria-current={i === current ? "step" : undefined}
            className={`border-t-4 pt-2 ${i <= current ? "border-walnut text-charcoal" : "border-line text-ink-muted"} aria-[current=step]:font-semibold`}
          >
            {label(s)}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Details">
            {canManage ? (
              <ActionForm action={updateProjectAction.bind(null, project.id)} submitLabel="Save project">
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminInput
                    label="Title"
                    name="title"
                    defaultValue={project.title}
                    required
                    maxLength={200}
                  />
                  <AdminSelect
                    label="Assigned to"
                    name="assignedToId"
                    defaultValue={project.assignedTo?.id ?? ""}
                    options={[
                      { value: "", label: "Unassigned" },
                      ...staff.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                  <AdminInput
                    label="Site address"
                    name="siteAddress"
                    defaultValue={project.siteAddress ?? ""}
                    maxLength={300}
                  />
                  <AdminInput
                    label="Target date"
                    name="targetDate"
                    type="date"
                    defaultValue={project.targetDate?.toISOString().slice(0, 10) ?? ""}
                  />
                </div>
                <AdminTextarea
                  label="Internal notes"
                  name="notes"
                  defaultValue={project.notes ?? ""}
                  maxLength={2000}
                />
              </ActionForm>
            ) : (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-muted">Assigned to</dt>
                  <dd>{project.assignedTo?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Target date</dt>
                  <dd>{project.targetDate ? fmtDate(project.targetDate) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Site address</dt>
                  <dd>{project.siteAddress ?? "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-ink-muted">Notes</dt>
                  <dd className="whitespace-pre-wrap">{project.notes ?? "—"}</dd>
                </div>
              </dl>
            )}
          </Panel>

          <Panel title="Stage history">
            <ol className="space-y-3 text-sm">
              {project.stageChanges.map((c) => (
                <li key={c.id} className="border-s-2 border-line ps-3">
                  <span className="font-medium">
                    {c.fromStage ? `${label(c.fromStage)} → ` : ""}
                    {label(c.toStage)}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {fmtDateTime(c.changedAt)} · {c.changedBy?.name ?? "System"}
                  </span>
                  {c.note && <span className="block">{c.note}</span>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          {canManage && (
            <Panel title="Move to stage">
              <ActionForm
                action={stageAction.bind(null, project.id)}
                submitLabel="Update stage"
                resetOnSuccess
              >
                <AdminSelect
                  label="Stage"
                  name="stage"
                  defaultValue={projectStages[Math.min(current + 1, projectStages.length - 1)]}
                  options={projectStages
                    .filter((s) => s !== project.stage)
                    .map((s) => ({ value: s, label: label(s) }))}
                />
                <AdminTextarea
                  label="Note"
                  name="note"
                  rows={2}
                  maxLength={500}
                  hint="Required when moving back a stage."
                />
              </ActionForm>
            </Panel>
          )}

          <Panel title="Customer">
            <p className="font-medium">
              <Link
                href={`/admin/customers/${project.customer.id}`}
                className="underline-offset-4 hover:underline"
              >
                {project.customer.name}
              </Link>
            </p>
            {project.customer.phone && (
              <p dir="ltr" className="text-sm">
                {project.customer.phone}
              </p>
            )}
            {project.lead && (
              <p className="mt-2 text-sm">
                Lead{" "}
                <Link href={`/admin/leads/${project.lead.id}`} className="font-mono text-xs underline">
                  {project.lead.reference}
                </Link>
              </p>
            )}
          </Panel>

          <Panel title="Order">
            {order ? (
              <>
                <p className="text-sm">
                  <span className="font-mono text-xs">{order.number}</span> ·{" "}
                  {formatBhd(Number(order.totalFils))}
                  <span className="block text-xs text-ink-muted">
                    From{" "}
                    <Link href={`/admin/quotations/${order.revision.quotation.id}`} className="underline">
                      {order.revision.quotation.number}
                    </Link>{" "}
                    rev. {order.revision.revision}
                  </span>
                </p>
                {canManage ? (
                  <ActionForm
                    action={updateOrderAction.bind(null, order.id, project.id)}
                    submitLabel="Save order"
                    className="mt-4"
                  >
                    <AdminSelect
                      label="Order status"
                      name="status"
                      defaultValue={order.status}
                      options={orderStatuses.map((s) => ({ value: s, label: label(s) }))}
                    />
                    <AdminInput
                      label="Agreed deposit (BHD)"
                      name="deposit"
                      defaultValue={order.depositFils !== null ? filsToInput(Number(order.depositFils)) : ""}
                      inputMode="decimal"
                      dir="ltr"
                    />
                    <AdminCheckbox
                      name="depositReceived"
                      defaultChecked={Boolean(order.depositReceivedAt)}
                      label={
                        order.depositReceivedAt
                          ? `Deposit received (${fmtDate(order.depositReceivedAt)})`
                          : "Deposit received"
                      }
                    />
                  </ActionForm>
                ) : (
                  <p className="mt-2 text-sm">Status: {label(order.status)}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                No order yet. One is created when an approved quotation for this customer is converted.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
