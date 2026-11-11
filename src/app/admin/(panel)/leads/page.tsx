import type { Metadata } from "next";
import Link from "next/link";
import {
  adminInput,
  Badge,
  Empty,
  FilterField,
  fmtDateTime,
  label,
  leadStatusTone,
  PageHeader,
  Pagination,
  ScoreBadge,
  Table,
  Td,
  TemperatureBadge,
  Th,
} from "@/components/admin/ui";
import { isPast } from "@/lib/admin/time";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { customerTypes } from "@/server/crm/customers";
import { leadSources, leadStatuses, leadStatusNames, listLeads } from "@/server/crm/leads";
import { assignableStaff } from "@/server/crm/shared";
import { db } from "@/server/db";
import { categoryLabel } from "@/server/enquiries/submit";
import { leadQueryParams, parseLeadQuery, productKeys, toLeadFilters } from "./filters";

export const metadata: Metadata = { title: "Leads" };

const sortNames = {
  newest: "Newest first",
  oldest: "Oldest first",
  score: "Highest score",
  next_follow_up: "Next follow-up",
  last_contact: "Recently contacted",
  stale: "Longest without contact",
} as const;

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  const actor = await requireActor("lead.read");
  const query = parseLeadQuery(await searchParams);
  const [result, staff] = await Promise.all([
    listLeads(db, actor, toLeadFilters(query)),
    assignableStaff(db),
  ]);
  const canExport = can(actor, "customer.read");

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every enquiry from the website, the chat, WhatsApp and the designer portal. Open a lead to update it."
        actions={
          <>
            <Link
              href={`/admin/leads/pipeline?${leadQueryParams(query, { status: undefined, stage: undefined, sort: undefined, page: undefined })}`}
              className="inline-flex min-h-10 items-center border border-charcoal/25 bg-white px-4 text-sm hover:bg-sand"
            >
              Pipeline board
            </Link>
            {canExport && (
              <a
                href={`/admin/leads/export?${leadQueryParams(query, { page: undefined })}`}
                className="inline-flex min-h-10 items-center bg-charcoal px-4 text-sm font-medium text-ivory"
              >
                Export to Excel (CSV)
              </a>
            )}
          </>
        }
      />
      <form
        method="get"
        className="mb-5 grid gap-3 border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <FilterField label="Search">
          <input
            name="q"
            defaultValue={query.q}
            placeholder="Name, phone, email, reference, area"
            className={adminInput}
          />
        </FilterField>
        <FilterField label="Stage">
          <select name="status" defaultValue={query.status ?? ""} className={adminInput}>
            <option value="">Any</option>
            {leadStatuses.map((s) => (
              <option key={s} value={s}>
                {leadStatusNames[s]}
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
        <FilterField label="Minimum score">
          <select name="minScore" defaultValue={query.minScore ?? ""} className={adminInput}>
            <option value="">Any</option>
            <option value="30">30 or more</option>
            <option value="60">60 or more</option>
            <option value="80">80 or more</option>
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
        <FilterField label="Product">
          <select name="category" defaultValue={query.category ?? ""} className={adminInput}>
            <option value="">Any</option>
            {productKeys.map((k) => (
              <option key={k} value={k}>
                {categoryLabel(k)}
              </option>
            ))}
            <option value="none">Not specified</option>
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
        <FilterField label="Next follow-up">
          <select name="followUp" defaultValue={query.followUp ?? ""} className={adminInput}>
            <option value="">Any</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today (or overdue)</option>
            <option value="week">Within 7 days</option>
            <option value="none">None scheduled</option>
          </select>
        </FilterField>
        <FilterField label="Received from">
          <input type="date" name="from" defaultValue={query.from} className={adminInput} />
        </FilterField>
        <FilterField label="Received to">
          <input type="date" name="to" defaultValue={query.to} className={adminInput} />
        </FilterField>
        <FilterField label="Sort by">
          <select name="sort" defaultValue={query.sort ?? "newest"} className={adminInput}>
            {Object.entries(sortNames).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </FilterField>
        <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-4">
          <button type="submit" className="min-h-10 bg-charcoal px-4 text-sm font-medium text-ivory">
            Filter
          </button>
          <Link href="/admin/leads" className="min-h-10 px-2 py-2 text-sm underline underline-offset-4">
            Clear
          </Link>
        </div>
      </form>

      {result.items.length === 0 ? (
        <Empty>No leads match these filters.</Empty>
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-muted">{result.total} lead(s)</p>
          <Table label="Leads">
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Customer</Th>
                <Th>Enquiry</Th>
                <Th>Stage</Th>
                <Th>Score</Th>
                <Th>Assigned</Th>
                <Th>Last contact</Th>
                <Th>Next follow-up</Th>
                <Th>Received</Th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((l) => {
                const overdue = l.nextFollowUpAt && isPast(l.nextFollowUpAt);
                const location = l.customer.location ?? l.requirements?.location;
                return (
                  <tr key={l.id} className="hover:bg-sand/40">
                    <Td>
                      <Link
                        href={`/admin/leads/${l.id}`}
                        className="font-mono text-xs font-medium whitespace-nowrap underline-offset-4 hover:underline"
                      >
                        {l.reference}
                      </Link>
                    </Td>
                    <Td>
                      {l.customer.name}
                      <span className="block text-xs text-ink-muted" dir="ltr">
                        {l.customer.phone ?? l.customer.email}
                      </span>
                      <span className="block text-xs text-ink-muted">
                        {label(l.customer.type)}
                        {location ? ` · ${location}` : ""}
                      </span>
                    </Td>
                    <Td className="max-w-xs">
                      <span className="text-xs text-ink-muted">
                        {label(l.source)}
                        {l.category ? ` · ${categoryLabel(l.category)}` : ""}
                      </span>
                      <span className="line-clamp-2 block">{l.summary}</span>
                    </Td>
                    <Td>
                      <Badge tone={leadStatusTone[l.status]}>{leadStatusNames[l.status]}</Badge>
                      <span className="mt-1 block">
                        <TemperatureBadge value={l.temperature} />
                      </span>
                    </Td>
                    <Td>
                      <ScoreBadge value={l.score} />
                    </Td>
                    <Td>{l.assignedTo?.name ?? <span className="text-ink-muted">—</span>}</Td>
                    <Td className="whitespace-nowrap">
                      {l.lastContactAt ? (
                        fmtDateTime(l.lastContactAt)
                      ) : (
                        <span className="text-ink-muted">Never</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {l.nextFollowUpAt ? (
                        <span className={overdue ? "font-medium text-red-800" : undefined}>
                          {fmtDateTime(l.nextFollowUpAt)}
                          {overdue && <span className="block text-xs">Overdue</span>}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{fmtDateTime(l.createdAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination
            page={result.page}
            pages={result.pages}
            params={Object.fromEntries(leadQueryParams(query, { page: undefined }))}
          />
        </>
      )}
    </>
  );
}
