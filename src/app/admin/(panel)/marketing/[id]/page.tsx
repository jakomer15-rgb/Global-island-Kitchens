import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { AdminInput, AdminSelect } from "@/components/admin/fields";
import { Badge, fmtDateTime, PageHeader, Panel } from "@/components/admin/ui";
import { gccCountries, prospectScoreParts, prospectTypeNames } from "@/lib/prospect-score";
import { CUID } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { assignableStaff } from "@/server/crm/shared";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { getProspect, prospectStatusNames } from "@/server/marketing/prospects";
import { convertProspectAction, prospectStatusAction, updateProspectAction } from "../actions";
import { priorityTone, prospectStatusTone } from "../filters";
import { ProspectForm } from "../prospect-form";

export const metadata: Metadata = { title: "Prospect" };

const sourceNames: Record<string, string> = {
  manual: "own research",
  import: "spreadsheet import",
  google_places: "Google Places",
  referral: "referral",
  event: "event",
  other: "other",
};

export default async function ProspectPage({ params }: PageProps<"/admin/marketing/[id]">) {
  const actor = await requireActor("marketing.manage");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  let p;
  try {
    p = await getProspect(db, actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const staff = await assignableStaff(db);
  const parts = prospectScoreParts(p);
  const closed = p.status === "converted" || p.status === "do_not_contact";

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/marketing" className="underline underline-offset-4">
          ← Prospects
        </Link>
      </p>
      <PageHeader
        title={p.companyName}
        description={
          <>
            {prospectTypeNames[p.type]} ·{" "}
            {[p.area, gccCountries[p.country as keyof typeof gccCountries]].filter(Boolean).join(", ")} ·
            added {fmtDateTime(p.createdAt)} from {sourceNames[p.source]}
            {p.createdBy ? ` by ${p.createdBy.name}` : ""}{" "}
            <Badge tone={prospectStatusTone[p.status]}>{prospectStatusNames[p.status]}</Badge>
          </>
        }
      />
      {p.unsubscribedAt && (
        <p className="mb-6 border-s-2 border-red-700 bg-red-50 px-4 py-3 text-sm">
          Unsubscribed on {fmtDateTime(p.unsubscribedAt)}: never email this business again.
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Details" className="xl:col-span-2">
          <ProspectForm
            action={updateProspectAction.bind(null, p.id)}
            values={{ ...p, assignedToId: p.assignedTo?.id ?? null }}
            staff={staff}
            submitLabel="Save"
          />
          {p.placeId && (
            <p className="mt-4 text-xs text-ink-muted">
              Found on Google Places.{" "}
              <a
                href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(p.placeId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Open in Google Maps
              </a>{" "}
              to check the business before contacting it.
            </p>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title="Score">
            <p className="flex items-baseline gap-2">
              <span className="font-display text-4xl tabular-nums">{p.score}</span>
              <Badge tone={priorityTone[p.priority]}>{p.priority} priority</Badge>
            </p>
            {p.status === "not_interested" || p.status === "do_not_contact" ? (
              <p className="mt-2 text-sm text-ink-muted">
                0 because the business is {prospectStatusNames[p.status].toLowerCase()}.
              </p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {parts.map((x) => (
                  <li key={x.key} className="flex justify-between">
                    <span className={x.points ? undefined : "text-ink-muted"}>{x.label}</span>
                    <span className="tabular-nums">
                      {x.points} / {x.max}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-muted">
              Fit of the business type, location, contact details known, and how they responded. Not set by
              the AI.
            </p>
          </Panel>

          <Panel title="Status">
            <p className="mb-3 text-sm">
              Last contacted: {p.lastContactedAt ? fmtDateTime(p.lastContactedAt) : "never"}
            </p>
            {p.status === "converted" && p.convertedLead ? (
              <p className="text-sm">
                Converted to lead{" "}
                <Link href={`/admin/leads/${p.convertedLead.id}`} className="font-mono underline">
                  {p.convertedLead.reference}
                </Link>
                .
              </p>
            ) : (
              <ActionForm action={prospectStatusAction.bind(null, p.id)} submitLabel="Save status">
                <AdminSelect
                  label="Status"
                  name="status"
                  defaultValue={p.status}
                  options={(["new", "contacted", "interested", "not_interested", "do_not_contact"] as const)
                    .filter((s) => !p.unsubscribedAt || s === "do_not_contact")
                    .map((s) => ({ value: s, label: prospectStatusNames[s] }))}
                />
                <AdminInput
                  label="Note (optional)"
                  name="note"
                  maxLength={500}
                  hint="e.g. “Called, asked for the company profile”."
                />
              </ActionForm>
            )}
          </Panel>

          {!closed && can(actor, "lead.update") && (
            <Panel title="Convert to a lead">
              <p className="mb-3 text-sm">
                When the business is interested in a project, create a customer and a lead for the sales team
                (reference GIK-P-…). Needs a phone number or email.
              </p>
              <ActionForm
                action={convertProspectAction.bind(null, p.id)}
                submitLabel="Convert to a lead"
                confirm={`Create a customer and a lead for ${p.companyName}?`}
              />
            </Panel>
          )}

          <Panel title="Campaign emails">
            {p.messages.length === 0 ? (
              <p className="text-sm text-ink-muted">None yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {p.messages.map((m) => (
                  <li key={m.id}>
                    <Link href={`/admin/marketing/campaigns/${m.campaign.id}`} className="underline">
                      {m.campaign.name}
                    </Link>
                    <span className="block text-xs text-ink-muted">
                      {m.subject} · {m.status}
                      {m.sentAt ? ` ${fmtDateTime(m.sentAt)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
