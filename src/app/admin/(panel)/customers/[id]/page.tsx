import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import {
  Badge,
  fmtDateTime,
  label,
  leadStatusTone,
  PageHeader,
  Panel,
  ScoreBadge,
} from "@/components/admin/ui";
import { CUID } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { customerTypes, duplicatesOf, getCustomer } from "@/server/crm/customers";
import { leadStatusNames } from "@/server/crm/leads";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { consentAction, mergeCustomerAction, updateCustomerAction } from "../actions";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const actor = await requireActor("customer.read");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  let c;
  try {
    c = await getCustomer(db, actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const canEdit = can(actor, "customer.update");
  const duplicates = await duplicatesOf(db, actor, c.id);
  const consentText = (r: (typeof c.currentConsent)["email"]) =>
    r
      ? `${r.granted ? "Yes" : "No"} · ${fmtDateTime(r.recordedAt)} (${r.source.startsWith("staff:") ? "recorded by staff" : r.source})`
      : "Not given";

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/customers" className="underline underline-offset-4">
          ← All customers
        </Link>
      </p>
      <PageHeader
        title={c.name}
        description={`${label(c.type)} · customer since ${fmtDateTime(c.createdAt)}`}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Details" className="xl:col-span-2">
          {canEdit ? (
            <ActionForm action={updateCustomerAction.bind(null, c.id)} submitLabel="Save customer">
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminInput label="Name" name="name" defaultValue={c.name} required maxLength={100} />
                <AdminInput label="Company" name="company" defaultValue={c.company ?? ""} maxLength={120} />
                <AdminInput
                  label="Phone"
                  name="phone"
                  defaultValue={c.phone ?? ""}
                  dir="ltr"
                  hint="Bahrain numbers can omit +973."
                />
                <AdminInput label="Email" name="email" type="email" defaultValue={c.email ?? ""} dir="ltr" />
                <AdminSelect
                  label="Type"
                  name="type"
                  defaultValue={c.type}
                  options={customerTypes.map((t) => ({ value: t, label: label(t) }))}
                />
                <AdminInput
                  label="Location (area or town)"
                  name="location"
                  defaultValue={c.location ?? ""}
                  maxLength={120}
                />
                <AdminSelect
                  label="Preferred language"
                  name="preferredLanguage"
                  defaultValue={c.preferredLanguage}
                  options={[
                    { value: "en", label: "English" },
                    { value: "ar", label: "Arabic" },
                  ]}
                />
              </div>
              <AdminTextarea
                label="Internal notes"
                name="notes"
                defaultValue={c.notes ?? ""}
                maxLength={2000}
              />
            </ActionForm>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-muted">Phone</dt>
                <dd dir="ltr">{c.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Email</dt>
                <dd>{c.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Company</dt>
                <dd>{c.company ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Location</dt>
                <dd>{c.location ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-ink-muted">Notes</dt>
                <dd className="whitespace-pre-wrap">{c.notes ?? "—"}</dd>
              </div>
            </dl>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Marketing consent">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-ink-muted">Email</dt>
                <dd>{consentText(c.currentConsent.email)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">WhatsApp</dt>
                <dd>{consentText(c.currentConsent.whatsapp)}</dd>
              </div>
            </dl>
            {canEdit && (
              <ActionForm action={consentAction.bind(null, c.id)} submitLabel="Record" className="mt-4">
                <p className="text-xs text-ink-muted">
                  Record a change the customer asked for. The history is kept.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <AdminSelect
                    label="Channel"
                    name="channel"
                    options={[
                      { value: "email", label: "Email" },
                      { value: "whatsapp", label: "WhatsApp" },
                    ]}
                  />
                  <AdminSelect
                    label="Consent"
                    name="granted"
                    options={[
                      { value: "no", label: "Withdrawn" },
                      { value: "yes", label: "Given" },
                    ]}
                  />
                </div>
              </ActionForm>
            )}
          </Panel>

          <Panel title="Leads">
            <ul className="divide-y divide-line text-sm">
              {c.leads.map((l) => (
                <li key={l.id} className="py-2">
                  {can(actor, "lead.read") ? (
                    <Link href={`/admin/leads/${l.id}`} className="font-mono text-xs underline">
                      {l.reference}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs">{l.reference}</span>
                  )}{" "}
                  <Badge tone={leadStatusTone[l.status]}>{leadStatusNames[l.status]}</Badge>{" "}
                  <ScoreBadge value={l.score} />
                  <span className="block">{l.summary}</span>
                  <span className="text-xs text-ink-muted">
                    Received {fmtDateTime(l.createdAt)}
                    {l.lastContactAt && ` · last contact ${fmtDateTime(l.lastContactAt)}`}
                    {l.nextFollowUpAt && ` · follow-up ${fmtDateTime(l.nextFollowUpAt)}`}
                  </span>
                </li>
              ))}
              {c.leads.length === 0 && <li className="py-2 text-ink-muted">No leads.</li>}
            </ul>
          </Panel>
        </div>
      </div>

      {(duplicates.length > 0 || c.mergedFrom.length > 0) && (
        <section id="duplicates" className="mt-6 scroll-mt-24">
          <Panel title="Duplicates">
            {duplicates.length > 0 && (
              <>
                <p className="text-sm">
                  These customers have the same name. If one is the same person, merge it into this record:
                  its leads, quotations, orders, projects and chats move here, its consent history is copied,
                  and it is archived. New enquiries from its phone or email will arrive here. This can&apos;t
                  be undone from the admin.
                </p>
                <ul className="mt-4 divide-y divide-line text-sm">
                  {duplicates.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <span>
                        <Link href={`/admin/customers/${d.id}`} className="font-medium underline">
                          {d.name}
                        </Link>{" "}
                        <span dir="ltr">{d.phone}</span> {d.email}
                        <span className="block text-xs text-ink-muted">
                          {label(d.type)}
                          {d.location ? ` · ${d.location}` : ""} · {d._count.leads} lead(s) · since{" "}
                          {fmtDateTime(d.createdAt)}
                        </span>
                      </span>
                      {canEdit && (
                        <ActionForm
                          action={mergeCustomerAction.bind(null, c.id, d.id)}
                          submitLabel="Merge into this record"
                          pendingLabel="Merging…"
                          variant="outline"
                          confirm={`Merge ${d.name} (${d.phone ?? d.email}) into ${c.name}? Their leads and history move to this record and the other record is archived. This can't be undone from the admin.`}
                          inline
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {c.mergedFrom.length > 0 && (
              <div className={duplicates.length > 0 ? "mt-6 border-t border-line pt-4" : undefined}>
                <h3 className="text-sm font-medium">Merged into this record</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {c.mergedFrom.map((m) => (
                    <li key={m.id}>
                      {m.name} · <span dir="ltr">{m.phone}</span> {m.email}
                      {m.archivedAt && (
                        <span className="text-xs text-ink-muted"> · merged {fmtDateTime(m.archivedAt)}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink-muted">
                  Enquiries from these phone numbers and emails arrive on this record.
                </p>
              </div>
            )}
          </Panel>
        </section>
      )}
    </>
  );
}
