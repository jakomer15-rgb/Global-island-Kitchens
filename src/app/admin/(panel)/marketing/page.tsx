import type { Metadata } from "next";
import Link from "next/link";
import {
  adminInput,
  Badge,
  Empty,
  FilterField,
  fmtDateTime,
  PageHeader,
  Pagination,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { gccCountries, prospectTypeNames, prospectTypes } from "@/lib/prospect-score";
import { requireActor } from "@/server/auth/session";
import { assignableStaff } from "@/server/crm/shared";
import { db } from "@/server/db";
import { listProspects, prospectStatuses, prospectStatusNames } from "@/server/marketing/prospects";
import {
  filterParams,
  parseProspectFilters,
  priorityTone,
  prospectStatusTone as statusTone,
} from "./filters";

export const metadata: Metadata = { title: "Prospects" };

const sourceNames: Record<string, string> = {
  manual: "Own research",
  import: "Spreadsheet import",
  google_places: "Google Places",
  referral: "Referral",
  event: "Event",
  other: "Other",
};

export default async function ProspectsPage({ searchParams }: PageProps<"/admin/marketing">) {
  const actor = await requireActor("marketing.manage");
  const filters = parseProspectFilters(await searchParams);
  const [result, staff] = await Promise.all([listProspects(db, actor, filters), assignableStaff(db)]);
  const s = result.statusCounts;
  const total = Object.values(s).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Prospects"
        description="Businesses in Bahrain and the GCC that may buy from GIK: designers, architects, developers, contractors and people building new homes. Scored by fit, location and how reachable they are."
        actions={
          <>
            <Link
              href="/admin/marketing/new"
              className="inline-flex min-h-10 items-center bg-charcoal px-4 text-sm font-medium text-ivory"
            >
              Add a prospect
            </Link>
            <Link
              href="/admin/marketing/places"
              className="inline-flex min-h-10 items-center border border-charcoal/25 bg-white px-4 text-sm hover:bg-sand"
            >
              Find businesses
            </Link>
            <Link
              href="/admin/marketing/import"
              className="inline-flex min-h-10 items-center border border-charcoal/25 bg-white px-4 text-sm hover:bg-sand"
            >
              Import a spreadsheet
            </Link>
            <a
              href={`/admin/marketing/export?${filterParams(filters, { page: undefined })}`}
              className="inline-flex min-h-10 items-center border border-charcoal/25 bg-white px-4 text-sm hover:bg-sand"
            >
              Export (CSV)
            </a>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="All prospects" value={total} href="/admin/marketing" />
        <StatCard
          label="New"
          value={s.new ?? 0}
          hint="Not contacted yet"
          href="/admin/marketing?status=new"
        />
        <StatCard label="Contacted" value={s.contacted ?? 0} href="/admin/marketing?status=contacted" />
        <StatCard label="Interested" value={s.interested ?? 0} href="/admin/marketing?status=interested" />
        <StatCard
          label="Converted to leads"
          value={s.converted ?? 0}
          hint={`${s.not_interested ?? 0} not interested · ${s.do_not_contact ?? 0} do not contact`}
          href="/admin/marketing?status=converted"
        />
      </div>

      <form
        method="get"
        className="my-6 grid gap-3 border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <FilterField label="Search">
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Company, contact, email, area"
            className={adminInput}
          />
        </FilterField>
        <FilterField label="Location">
          <select name="country" defaultValue={filters.country ?? ""} className={adminInput}>
            <option value="">Any</option>
            {Object.entries(gccCountries).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Type">
          <select name="type" defaultValue={filters.type ?? ""} className={adminInput}>
            <option value="">Any</option>
            {prospectTypes.map((t) => (
              <option key={t} value={t}>
                {prospectTypeNames[t]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Status">
          <select name="status" defaultValue={filters.status ?? ""} className={adminInput}>
            <option value="">Any</option>
            {prospectStatuses.map((v) => (
              <option key={v} value={v}>
                {prospectStatusNames[v]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Priority">
          <select name="priority" defaultValue={filters.priority ?? ""} className={adminInput}>
            <option value="">Any</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </FilterField>
        <FilterField label="Source">
          <select name="source" defaultValue={filters.source ?? ""} className={adminInput}>
            <option value="">Any</option>
            {Object.entries(sourceNames).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Assigned to">
          <select name="assignedTo" defaultValue={filters.assignedTo ?? ""} className={adminInput}>
            <option value="">Anyone</option>
            <option value="none">Nobody</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Sort by">
          <select name="sort" defaultValue={filters.sort ?? "score"} className={adminInput}>
            <option value="score">Highest score</option>
            <option value="newest">Newest first</option>
            <option value="name">Name (A–Z)</option>
            <option value="last_contacted">Recently contacted</option>
          </select>
        </FilterField>
        <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-4">
          <button type="submit" className="min-h-10 bg-charcoal px-4 text-sm font-medium text-ivory">
            Filter
          </button>
          <Link href="/admin/marketing" className="min-h-10 px-2 py-2 text-sm underline underline-offset-4">
            Clear
          </Link>
        </div>
      </form>

      {result.items.length === 0 ? (
        <Empty>
          {total === 0
            ? "No prospects yet. Add one, import a spreadsheet or search Google Places."
            : "No prospects match these filters."}
        </Empty>
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-muted">{result.total} prospect(s)</p>
          <Table label="Prospects">
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Type</Th>
                <Th>Location</Th>
                <Th>Contact</Th>
                <Th>Score</Th>
                <Th>Status</Th>
                <Th>Last contacted</Th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((p) => (
                <tr key={p.id} className="hover:bg-sand/40">
                  <Td>
                    <Link
                      href={`/admin/marketing/${p.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {p.companyName}
                    </Link>
                    {p.contactName && (
                      <span className="block text-xs text-ink-muted">
                        {p.contactName}
                        {p.contactRole ? `, ${p.contactRole}` : ""}
                      </span>
                    )}
                  </Td>
                  <Td>{prospectTypeNames[p.type]}</Td>
                  <Td>
                    {[p.area, gccCountries[p.country as keyof typeof gccCountries]]
                      .filter(Boolean)
                      .join(", ")}
                  </Td>
                  <Td className="text-xs">
                    {p.email && <span className="block break-all">{p.email}</span>}
                    {p.phone && (
                      <span className="block" dir="ltr">
                        {p.phone}
                      </span>
                    )}
                    {!p.email && !p.phone && <span className="text-ink-muted">None yet</span>}
                  </Td>
                  <Td>
                    <Badge tone={priorityTone[p.priority]}>
                      <span className="tabular-nums">{p.score}</span>&nbsp;· {p.priority}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={statusTone[p.status]}>{prospectStatusNames[p.status]}</Badge>
                    {p.assignedTo && (
                      <span className="block text-xs text-ink-muted">{p.assignedTo.name}</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {p.lastContactedAt ? (
                      fmtDateTime(p.lastContactedAt)
                    ) : (
                      <span className="text-ink-muted">Never</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={result.page}
            pages={result.pages}
            params={Object.fromEntries(filterParams(filters, { page: undefined }))}
          />
        </>
      )}
    </>
  );
}
