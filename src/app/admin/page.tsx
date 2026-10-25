import type { Metadata } from "next";
import { Wordmark } from "@/components/site/wordmark";
import { Button } from "@/components/ui/button";
import { categoryLabel } from "@/server/enquiries/submit";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { db } from "@/server/db";
import { listRecentEnquiries } from "@/server/leads/queries";
import { signOutAction } from "./actions";

export const metadata: Metadata = { title: "Enquiries" };

const kindLabel: Record<string, string> = {
  website_quote: "Quotation request",
  website_consultation: "Consultation",
  website_contact: "Message",
};

const fmt = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bahrain",
});
const dateOnly = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

/**
 * Phase 4 admin: recent enquiries from the website forms, read-only. The full CRM (assignment,
 * statuses, notes, follow-ups, filters) arrives in Phase 5.
 */
export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const actor = await requireActor("lead.read");
  const ref = (await searchParams).ref;
  const reference = typeof ref === "string" && /^GIK-[A-Z]-\d{4}-\d{5,}$/.test(ref) ? ref : undefined;
  const leads = await listRecentEnquiries(db, actor, { reference });
  const canDownload = can(actor, "file.read");

  return (
    <div className="min-h-svh">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Wordmark />
          <div className="flex items-center gap-4 text-sm">
            <span className="text-ink-muted">{actor.name}</span>
            <form action={signOutAction}>
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="font-display text-display-md">Enquiries</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {reference ? `Showing ${reference}. ` : "The 50 most recent. "}
          The full CRM (assigning, statuses, notes, follow-ups) arrives in the next phase.
        </p>
        {leads.length === 0 ? (
          <p className="mt-10 border border-line bg-white p-8 text-center text-ink-muted">
            No enquiries yet.
          </p>
        ) : (
          <ul className="mt-8 space-y-3">
            {leads.map((lead) => (
              <li key={lead.id} className="border border-line bg-white">
                <details open={Boolean(reference)}>
                  <summary className="grid cursor-pointer gap-1 p-5 sm:grid-cols-[11rem_1fr_auto] sm:items-baseline sm:gap-6">
                    <span className="font-mono text-sm">{lead.reference}</span>
                    <span>
                      <span className="font-medium">{lead.customer.name}</span>
                      <span className="text-ink-muted"> · {kindLabel[lead.source] ?? lead.source}</span>
                      <span className="block text-sm text-ink-muted">{lead.summary}</span>
                    </span>
                    <span className="text-sm text-ink-muted">{fmt.format(lead.createdAt)}</span>
                  </summary>
                  <div className="grid gap-6 border-t border-line p-5 text-sm md:grid-cols-2">
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-ink-muted">Customer</dt>
                        <dd>
                          {lead.customer.name}
                          {lead.customer.phone && (
                            <>
                              {" · "}
                              <a href={`tel:${lead.customer.phone}`} className="underline">
                                {lead.customer.phone}
                              </a>
                            </>
                          )}
                          {lead.customer.email && (
                            <>
                              {" · "}
                              <a href={`mailto:${lead.customer.email}`} className="underline">
                                {lead.customer.email}
                              </a>
                            </>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-muted">Status · language</dt>
                        <dd>
                          {lead.status} · {lead.locale === "ar" ? "Arabic" : "English"}
                        </dd>
                      </div>
                      {lead.consultation && (
                        <div>
                          <dt className="text-ink-muted">Consultation</dt>
                          <dd>
                            {lead.consultation.type.replace("_", " ")} ·{" "}
                            {dateOnly.format(lead.consultation.preferredDate)} (
                            {lead.consultation.preferredSlot})
                            {lead.consultation.area && ` · ${lead.consultation.area}`}
                          </dd>
                        </div>
                      )}
                      {lead.quotationRequest && (
                        <>
                          <div>
                            <dt className="text-ink-muted">Product</dt>
                            <dd>{categoryLabel(lead.quotationRequest.category)}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-muted">Measurements ({lead.quotationRequest.unit})</dt>
                            <dd>
                              {(
                                lead.quotationRequest.measurements as {
                                  label?: string;
                                  width?: number;
                                  height?: number;
                                  depth?: number;
                                }[]
                              )
                                .map(
                                  (w, i) =>
                                    `${w.label ?? `Wall ${i + 1}`}: ${[w.width, w.height, w.depth].filter(Boolean).join(" × ")}`,
                                )
                                .join(" · ") || "None yet"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-ink-muted">Materials</dt>
                            <dd>
                              {lead.quotationRequest.preferredBoards.join(", ")}
                              {lead.quotationRequest.finishNotes && ` · ${lead.quotationRequest.finishNotes}`}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-ink-muted">Files</dt>
                            <dd>
                              {lead.quotationRequest.files.length === 0 && "None"}
                              <ul>
                                {lead.quotationRequest.files.map((f) => (
                                  <li key={f.id}>
                                    {canDownload ? (
                                      <a href={`/admin/files/${f.id}`} className="underline">
                                        {f.originalName}
                                      </a>
                                    ) : (
                                      f.originalName
                                    )}{" "}
                                    <span className="text-ink-muted">
                                      ({Math.ceil(f.sizeBytes / 1024)} KB)
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </dd>
                          </div>
                        </>
                      )}
                    </dl>
                    <div>
                      <p className="text-ink-muted">Submitted details</p>
                      {lead.activities.map((a) => (
                        <pre key={a.id} className="mt-1 font-sans whitespace-pre-wrap" dir="auto">
                          {a.body}
                        </pre>
                      ))}
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
