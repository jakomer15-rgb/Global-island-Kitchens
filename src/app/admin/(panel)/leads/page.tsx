import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import {
  adminInput,
  Badge,
  Empty,
  FilterBar,
  FilterField,
  fmtDateTime,
  label,
  leadStatusTone,
  PageHeader,
  Pagination,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { leadSources, leadStatuses, listLeads } from "@/server/crm/leads";
import { assignableStaff } from "@/server/crm/shared";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Leads" };

const filtersSchema = z.object({
  status: z
    .enum(leadStatuses as [string, ...string[]])
    .optional()
    .catch(undefined),
  source: z
    .enum(leadSources as [string, ...string[]])
    .optional()
    .catch(undefined),
  assignedTo: z.string().max(40).optional().catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  const actor = await requireActor("lead.read");
  const raw = await searchParams;
  const filters = filtersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const [result, staff] = await Promise.all([listLeads(db, actor, filters as never), assignableStaff(db)]);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every enquiry from the website forms and those staff add. Open a lead to update it."
      />
      <FilterBar>
        <FilterField label="Search">
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Name, phone, email, reference"
            className={adminInput}
          />
        </FilterField>
        <FilterField label="Status">
          <select name="status" defaultValue={filters.status ?? ""} className={adminInput}>
            <option value="">Any</option>
            {leadStatuses.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Source">
          <select name="source" defaultValue={filters.source ?? ""} className={adminInput}>
            <option value="">Any</option>
            {leadSources.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Assigned to">
          <select name="assignedTo" defaultValue={filters.assignedTo ?? ""} className={adminInput}>
            <option value="">Anyone</option>
            <option value="none">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

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
                <Th>Summary</Th>
                <Th>Status</Th>
                <Th>Assigned</Th>
                <Th>Next follow-up</Th>
                <Th>Received</Th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((l) => (
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
                    <span className="block text-xs text-ink-muted">
                      {l.customer.phone ?? l.customer.email}
                    </span>
                  </Td>
                  <Td className="max-w-xs">
                    <span className="text-xs text-ink-muted">{label(l.source)}</span>
                    <span className="block">{l.summary}</span>
                  </Td>
                  <Td>
                    <Badge tone={leadStatusTone[l.status]}>{label(l.status)}</Badge>
                  </Td>
                  <Td>{l.assignedTo?.name ?? <span className="text-ink-muted">—</span>}</Td>
                  <Td>
                    {l.followUps[0] ? (
                      fmtDateTime(l.followUps[0].dueAt)
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(l.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={result.page}
            pages={result.pages}
            params={{ ...filters, page: undefined } as Record<string, string | undefined>}
          />
        </>
      )}
    </>
  );
}
