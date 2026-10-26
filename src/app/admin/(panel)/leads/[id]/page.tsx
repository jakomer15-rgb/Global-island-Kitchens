import type { Metadata } from "next";
import Link from "next/link";
import { bahrainDate } from "@/lib/admin/time";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import {
  Badge,
  consultationTone,
  fmtDate,
  fmtDateTime,
  label,
  leadStatusTone,
  PageHeader,
  Panel,
} from "@/components/admin/ui";
import { CUID } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { categoryLabel } from "@/server/enquiries/submit";
import { getLead, leadStatuses, loggableKinds } from "@/server/crm/leads";
import { assignableStaff } from "@/server/crm/shared";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { designerProjectForLead } from "@/server/designers/admin";
import { designerReplyAction } from "../../designers/actions";
import { createProjectAction } from "../../projects/actions";
import { createQuotationAction } from "../../quotations/actions";
import {
  assignAction,
  changeStatusAction,
  completeFollowUpAction,
  logActivityAction,
  scheduleFollowUpAction,
} from "../actions";

export const metadata: Metadata = { title: "Lead" };

type Wall = { label?: string; width?: number; height?: number; depth?: number };

export default async function LeadPage({ params }: PageProps<"/admin/leads/[id]">) {
  const actor = await requireActor("lead.read");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  let lead;
  try {
    lead = await getLead(db, actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const staff = await assignableStaff(db);
  const canUpdate = can(actor, "lead.update");
  const canAssign = can(actor, "lead.assign");
  const canFiles = can(actor, "file.read");
  const canQuote = can(actor, "quotation.manage");
  const canProject = can(actor, "project.manage");
  const [quotations, projects] = await Promise.all([
    can(actor, "quotation.read")
      ? db.quotation.findMany({
          where: { leadId: lead.id },
          select: { id: true, number: true, status: true },
          orderBy: { createdAt: "desc" },
        })
      : [],
    can(actor, "project.read")
      ? db.project.findMany({
          where: { leadId: lead.id },
          select: { id: true, reference: true, stage: true, orderId: true },
          orderBy: { createdAt: "desc" },
        })
      : [],
  ]);
  const designerProject = can(actor, "designer.read")
    ? await designerProjectForLead(db, actor, lead.id)
    : null;
  const qr = lead.quotationRequest;
  const messages = lead.activities.filter((a) => a.kind === "message");
  const history = lead.activities.filter((a) => a.kind !== "message");
  // Bahrain time for the datetime-local default (tomorrow 10:00).
  const tomorrow = bahrainDate(1);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/leads" className="underline underline-offset-4">
          ← All leads
        </Link>
      </p>
      <PageHeader
        title={`${lead.customer.name} · ${lead.reference}`}
        description={
          <>
            {label(lead.source)} · received {fmtDateTime(lead.createdAt)} ·{" "}
            {lead.locale === "ar" ? "Arabic" : "English"}{" "}
            <Badge tone={leadStatusTone[lead.status]}>{label(lead.status)}</Badge>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Enquiry">
            <p className="mb-3">{lead.summary}</p>
            {qr && (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-muted">Product</dt>
                  <dd>{categoryLabel(qr.category)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Materials</dt>
                  <dd>
                    {qr.preferredBoards.map(label).join(", ")}
                    {qr.finishNotes && ` · ${qr.finishNotes}`}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-ink-muted">Measurements ({qr.unit})</dt>
                  <dd>
                    {(qr.measurements as Wall[]).length === 0
                      ? "None yet"
                      : (qr.measurements as Wall[]).map((w, i) => (
                          <span key={i} className="block">
                            {w.label ?? `Wall ${i + 1}`}:{" "}
                            {[w.width, w.height, w.depth].filter(Boolean).join(" × ")}
                          </span>
                        ))}
                  </dd>
                </div>
                {qr.area && (
                  <div>
                    <dt className="text-ink-muted">Area</dt>
                    <dd>{qr.area}</dd>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <dt className="text-ink-muted">Files</dt>
                  <dd>
                    {qr.files.length === 0 ? (
                      "None"
                    ) : (
                      <ul>
                        {qr.files.map((f) => (
                          <li key={f.id}>
                            {canFiles ? (
                              <a href={`/admin/files/${f.id}`} className="underline">
                                {f.originalName}
                              </a>
                            ) : (
                              f.originalName
                            )}{" "}
                            <span className="text-ink-muted">({Math.ceil(f.sizeBytes / 1024)} KB)</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
              </dl>
            )}
            {lead.consultation && (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-muted">Consultation</dt>
                  <dd>
                    {label(lead.consultation.type)} · {fmtDate(lead.consultation.preferredDate)} (
                    {lead.consultation.preferredSlot})
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Status</dt>
                  <dd>
                    <Badge tone={consultationTone[lead.consultation.status]}>
                      {label(lead.consultation.status)}
                    </Badge>{" "}
                    <Link href="/admin/consultations" className="text-xs underline">
                      Manage
                    </Link>
                  </dd>
                </div>
                {lead.consultation.area && (
                  <div>
                    <dt className="text-ink-muted">Site</dt>
                    <dd>{lead.consultation.area}</dd>
                  </div>
                )}
              </dl>
            )}
            {messages.length > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-sm text-ink-muted">What the customer sent</p>
                {messages.map((m) => (
                  <pre key={m.id} className="mt-1 font-sans text-sm whitespace-pre-wrap" dir="auto">
                    {m.body}
                  </pre>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Communication history and notes">
            {canUpdate && (
              <ActionForm
                action={logActivityAction.bind(null, lead.id)}
                submitLabel="Add to history"
                className="mb-6"
              >
                <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                  <AdminSelect
                    label="Type"
                    name="kind"
                    defaultValue="note"
                    options={loggableKinds.map((k) => ({
                      value: k,
                      label: k === "note" ? "Internal note" : label(k),
                    }))}
                  />
                  <AdminTextarea label="Details" name="body" rows={3} required maxLength={4000} />
                </div>
              </ActionForm>
            )}
            {history.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing logged yet.</p>
            ) : (
              <ol className="space-y-4 text-sm">
                {history.map((a) => (
                  <li key={a.id} className="border-s-2 border-sand-deep ps-4">
                    <p className="text-xs text-ink-muted">
                      {fmtDateTime(a.createdAt)} · {a.author?.name ?? "System"} · {label(a.kind)}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap" dir="auto">
                      {a.body}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          {(canQuote || canProject || quotations.length > 0 || projects.length > 0) && (
            <Panel title="Quotations and projects">
              {quotations.length + projects.length > 0 && (
                <ul className="mb-4 space-y-1 text-sm">
                  {quotations.map((q) => (
                    <li key={q.id}>
                      <Link href={`/admin/quotations/${q.id}`} className="font-mono text-xs underline">
                        {q.number}
                      </Link>{" "}
                      {label(q.status)}
                    </li>
                  ))}
                  {projects.map((p) => (
                    <li key={p.id}>
                      <Link href={`/admin/projects/${p.id}`} className="font-mono text-xs underline">
                        {p.reference}
                      </Link>{" "}
                      {label(p.stage)}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-3">
                {canQuote && (
                  <ActionForm
                    action={createQuotationAction.bind(null, lead.id)}
                    submitLabel="Create quotation"
                  />
                )}
                {canProject && !projects.some((p) => !p.orderId) && (
                  <ActionForm
                    action={createProjectAction.bind(null, lead.id)}
                    submitLabel="Start project"
                    variant="outline"
                  />
                )}
              </div>
            </Panel>
          )}
          {designerProject && (
            <Panel title="Designer project">
              <p className="text-sm">
                <Link
                  href={`/admin/designers/${designerProject.designer.id}`}
                  className="font-medium underline"
                >
                  {designerProject.designer.user.name}
                </Link>
                {designerProject.designer.company ? `, ${designerProject.designer.company}` : ""}
              </p>
              <p className="mt-1 text-sm">{designerProject.title}</p>
              {designerProject.clientLabel && (
                <p className="text-xs text-ink-muted">Client label: {designerProject.clientLabel}</p>
              )}
              {designerProject.materials.length > 0 && (
                <p className="mt-1 text-xs text-ink-muted">
                  Chosen:{" "}
                  {designerProject.materials.map((m) => `${m.material.code} ${m.material.nameEn}`).join("; ")}
                </p>
              )}
              <h3 className="mt-4 text-sm font-medium">Messages</h3>
              {designerProject.messages.length === 0 ? (
                <p className="text-sm text-ink-muted">No messages yet.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {designerProject.messages.map((m) => (
                    <li
                      key={m.id}
                      className={
                        m.internal ? "border-s-2 border-amber-600 bg-amber-50 p-2" : "border border-line p-2"
                      }
                    >
                      <p className="text-xs text-ink-muted">
                        {fmtDateTime(m.createdAt)} ·{" "}
                        {m.fromStaff ? m.author.name : designerProject.designer.user.name}
                        {m.internal ? " · internal note" : m.fromStaff ? " · sent to designer" : ""}
                      </p>
                      <p className="whitespace-pre-wrap" dir="auto">
                        {m.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {can(actor, "designer.manage") && (
                <ActionForm
                  action={designerReplyAction.bind(null, designerProject.id, lead.id)}
                  submitLabel="Send"
                  className="mt-4"
                  resetOnSuccess
                >
                  <AdminTextarea
                    label="Reply to the designer"
                    name="body"
                    rows={3}
                    required
                    maxLength={2000}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="internal" className="size-4" /> Internal note (the designer
                    never sees it)
                  </label>
                </ActionForm>
              )}
            </Panel>
          )}
          <Panel title="Customer">
            <p className="font-medium">
              {can(actor, "customer.read") ? (
                <Link
                  href={`/admin/customers/${lead.customer.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {lead.customer.name}
                </Link>
              ) : (
                lead.customer.name
              )}
            </p>
            <p className="mt-1 text-sm">
              {lead.customer.phone && (
                <a href={`tel:${lead.customer.phone}`} className="block underline" dir="ltr">
                  {lead.customer.phone}
                </a>
              )}
              {lead.customer.email && (
                <a href={`mailto:${lead.customer.email}`} className="block break-all underline">
                  {lead.customer.email}
                </a>
              )}
            </p>
            <p className="mt-1 text-xs text-ink-muted">{label(lead.customer.type)}</p>
          </Panel>

          {canUpdate && (
            <Panel title="Status">
              <ActionForm action={changeStatusAction.bind(null, lead.id)} submitLabel="Update status">
                <AdminSelect
                  label="Status"
                  name="status"
                  defaultValue={lead.status}
                  options={leadStatuses.map((s) => ({ value: s, label: label(s) }))}
                />
                <AdminInput
                  label="Reason (required when lost)"
                  name="lostReason"
                  defaultValue={lead.lostReason ?? ""}
                  maxLength={300}
                />
              </ActionForm>
            </Panel>
          )}

          {canAssign && (
            <Panel title="Assigned to">
              <ActionForm action={assignAction.bind(null, lead.id)} submitLabel="Save">
                <AdminSelect
                  label="Staff member"
                  name="userId"
                  defaultValue={lead.assignedTo?.id ?? ""}
                  options={[
                    { value: "", label: "Unassigned" },
                    ...staff.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
              </ActionForm>
            </Panel>
          )}

          <Panel title="Follow-ups">
            {lead.followUps.length === 0 && <p className="mb-4 text-sm text-ink-muted">None scheduled.</p>}
            <ul className="mb-5 space-y-3 text-sm">
              {lead.followUps.map((f) => (
                <li key={f.id} className={f.doneAt ? "text-ink-muted line-through" : ""}>
                  <span className="font-medium">{fmtDateTime(f.dueAt)}</span> · {f.assignedTo?.name ?? "—"}
                  {f.note && <span className="block">{f.note}</span>}
                  {!f.doneAt && canUpdate && (
                    <ActionForm
                      action={completeFollowUpAction.bind(null, f.id, `/admin/leads/${lead.id}`)}
                      submitLabel="Mark done"
                      variant="outline"
                      className="mt-1"
                    />
                  )}
                </li>
              ))}
            </ul>
            {canUpdate && (
              <ActionForm
                action={scheduleFollowUpAction.bind(null, lead.id)}
                submitLabel="Schedule follow-up"
              >
                <AdminInput
                  label="Due (Bahrain time)"
                  name="dueAt"
                  type="datetime-local"
                  defaultValue={`${tomorrow}T10:00`}
                  required
                />
                <AdminInput label="Note" name="note" maxLength={500} />
                {canAssign && (
                  <AdminSelect
                    label="For"
                    name="assignedToId"
                    defaultValue={lead.assignedTo?.id ?? actor.id}
                    options={staff.map((s) => ({ value: s.id, label: s.name }))}
                  />
                )}
              </ActionForm>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
