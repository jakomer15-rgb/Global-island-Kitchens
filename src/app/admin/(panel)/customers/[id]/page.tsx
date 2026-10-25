import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import { Badge, fmtDateTime, label, leadStatusTone, PageHeader, Panel } from "@/components/admin/ui";
import { CUID } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { customerTypes, getCustomer } from "@/server/crm/customers";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { consentAction, updateCustomerAction } from "../actions";

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
                  <Badge tone={leadStatusTone[l.status]}>{label(l.status)}</Badge>
                  <span className="block">{l.summary}</span>
                  <span className="text-xs text-ink-muted">{fmtDateTime(l.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
