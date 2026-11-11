import type { Metadata } from "next";
import Link from "next/link";
import {
  adminInput,
  FilterField,
  fmtDateTime,
  label,
  PageHeader,
  ScoreBadge,
  TemperatureBadge,
} from "@/components/admin/ui";
import { isPast } from "@/lib/admin/time";
import { requireActor } from "@/server/auth/session";
import { customerTypes } from "@/server/crm/customers";
import { leadPipeline, leadSources, leadStatusNames } from "@/server/crm/leads";
import { assignableStaff } from "@/server/crm/shared";
import { db } from "@/server/db";
import { leadQueryParams, parseLeadQuery, toLeadFilters } from "../filters";

export const metadata: Metadata = { title: "Sales pipeline" };

const PER_STAGE = 30;

export default async function PipelinePage({ searchParams }: PageProps<"/admin/leads/pipeline">) {
  const actor = await requireActor("lead.read");
  const query = parseLeadQuery(await searchParams);
  const filters = toLeadFilters(query);
  const [pipeline, staff] = await Promise.all([
    leadPipeline(
      db,
      actor,
      {
        assignedTo: filters.assignedTo,
        temperature: filters.temperature,
        customerType: filters.customerType,
        source: filters.source,
        q: filters.q,
      },
      PER_STAGE,
    ),
    assignableStaff(db),
  ]);
  const open = pipeline.stages.reduce((sum, s) => sum + s.count, 0);
  const listLink = (status: string) =>
    `/admin/leads?${leadQueryParams(query, { status, sort: "score", page: undefined })}`;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/leads" className="underline underline-offset-4">
          ← Leads list
        </Link>
      </p>
      <PageHeader
        title="Sales pipeline"
        description={`${open} open lead(s), highest score first in each stage. Won in the last 90 days: ${pipeline.won90} · lost: ${pipeline.lost90}. Change a lead's stage on its page.`}
      />
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3 border border-line bg-white p-4">
        <FilterField label="Search">
          <input
            name="q"
            defaultValue={query.q}
            placeholder="Name, phone, reference"
            className={adminInput}
          />
        </FilterField>
        <FilterField label="Assigned to">
          <select name="assignedTo" defaultValue={query.assignedTo ?? ""} className={adminInput}>
            <option value="">Anyone</option>
            <option value="none">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Rating">
          <select name="temperature" defaultValue={query.temperature ?? ""} className={adminInput}>
            <option value="">Any</option>
            <option value="hot">HOT</option>
            <option value="warm">WARM</option>
            <option value="cold">COLD</option>
            <option value="none">Not rated</option>
          </select>
        </FilterField>
        <FilterField label="Customer type">
          <select name="customerType" defaultValue={query.customerType ?? ""} className={adminInput}>
            <option value="">Any</option>
            {customerTypes.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Source">
          <select name="source" defaultValue={query.source ?? ""} className={adminInput}>
            <option value="">Any</option>
            {leadSources.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </FilterField>
        <button type="submit" className="min-h-10 bg-charcoal px-4 text-sm font-medium text-ivory">
          Filter
        </button>
        <Link
          href="/admin/leads/pipeline"
          className="min-h-10 px-2 py-2 text-sm underline underline-offset-4"
        >
          Clear
        </Link>
      </form>

      <div
        className="-mx-5 overflow-x-auto px-5 pb-4"
        role="region"
        aria-label="Pipeline stages (scroll sideways for more)"
        tabIndex={0}
      >
        <ol className="flex min-w-max gap-3">
          {pipeline.stages.map((stage, i) => (
            <li key={stage.status} className="flex w-64 shrink-0 flex-col border border-line bg-white">
              <h2 className="flex items-baseline justify-between gap-2 border-b border-line px-3 py-2 text-sm font-semibold">
                <span>
                  <span className="me-1 text-xs font-normal text-ink-muted">{i + 1}.</span>
                  {leadStatusNames[stage.status]}
                </span>
                <Link
                  href={listLink(stage.status)}
                  className="text-xs font-normal underline underline-offset-4"
                >
                  {stage.count}
                  <span className="sr-only"> leads, open the list</span>
                </Link>
              </h2>
              {stage.leads.length === 0 ? (
                <p className="p-3 text-xs text-ink-muted">None</p>
              ) : (
                <ul className="space-y-2 p-2">
                  {stage.leads.map((l) => {
                    const overdue = l.nextFollowUpAt && isPast(l.nextFollowUpAt);
                    return (
                      <li key={l.id}>
                        <Link
                          href={`/admin/leads/${l.id}`}
                          className="block border border-line p-2.5 text-sm transition-colors hover:border-walnut"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">{l.customer.name}</span>
                            <ScoreBadge value={l.score} />
                          </span>
                          <span className="mt-0.5 block font-mono text-[0.6875rem] text-ink-muted">
                            {l.reference}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-xs">{l.summary}</span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                            <TemperatureBadge value={l.temperature} />
                            {l.assignedTo && <span>{l.assignedTo.name}</span>}
                          </span>
                          {l.nextFollowUpAt && (
                            <span
                              className={`mt-1 block text-xs ${overdue ? "font-medium text-red-800" : "text-ink-muted"}`}
                            >
                              {overdue ? "Overdue: " : "Follow-up: "}
                              {fmtDateTime(l.nextFollowUpAt)}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                  {stage.count > stage.leads.length && (
                    <li>
                      <Link
                        href={listLink(stage.status)}
                        className="block px-1 py-1 text-xs underline underline-offset-4"
                      >
                        {stage.count - stage.leads.length} more
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
