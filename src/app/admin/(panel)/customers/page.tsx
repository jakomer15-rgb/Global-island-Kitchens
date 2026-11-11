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
import { customerSorts, customerTypes, listCustomers } from "@/server/crm/customers";
import { leadStatusNames } from "@/server/crm/leads";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Customers" };

const filtersSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  type: z
    .enum(customerTypes as [string, ...string[]])
    .optional()
    .catch(undefined),
  sort: z.enum(customerSorts).optional().catch(undefined),
  page: z.coerce.number().int().positive().max(10_000).optional().catch(undefined),
});

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const actor = await requireActor("customer.read");
  const raw = await searchParams;
  const filters = filtersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const result = await listCustomers(db, actor, filters as never);
  const params = new URLSearchParams(
    Object.entries({ q: filters.q, type: filters.type, sort: filters.sort }).filter(
      (e): e is [string, string] => Boolean(e[1]),
    ),
  );

  return (
    <>
      <PageHeader
        title="Customers"
        description="One record per customer, matched by phone or email across their enquiries."
        actions={
          <>
            <Link
              href="/admin/customers/duplicates"
              className="inline-flex min-h-10 items-center border border-charcoal/25 bg-white px-4 text-sm hover:bg-sand"
            >
              Possible duplicates
            </Link>
            <a
              href={`/admin/customers/export?${params}`}
              className="inline-flex min-h-10 items-center bg-charcoal px-4 text-sm font-medium text-ivory"
            >
              Export to Excel (CSV)
            </a>
          </>
        }
      />
      <FilterBar>
        <FilterField label="Search">
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Name, company, area, phone, email"
            className={adminInput}
          />
        </FilterField>
        <FilterField label="Type">
          <select name="type" defaultValue={filters.type ?? ""} className={adminInput}>
            <option value="">Any</option>
            {customerTypes.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Sort by">
          <select name="sort" defaultValue={filters.sort ?? "newest"} className={adminInput}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </FilterField>
      </FilterBar>
      {result.items.length === 0 ? (
        <Empty>No customers match.</Empty>
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-muted">{result.total} customer(s)</p>
          <Table label="Customers">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Contact</Th>
                <Th>Type</Th>
                <Th>Location</Th>
                <Th>Leads</Th>
                <Th>Latest lead</Th>
                <Th>Since</Th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((c) => {
                const latest = c.leads[0];
                return (
                  <tr key={c.id} className="hover:bg-sand/40">
                    <Td>
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.company && <span className="block text-xs text-ink-muted">{c.company}</span>}
                    </Td>
                    <Td>
                      <span dir="ltr">{c.phone}</span>
                      <span className="block text-xs">{c.email}</span>
                    </Td>
                    <Td>{label(c.type)}</Td>
                    <Td>{c.location ?? <span className="text-ink-muted">—</span>}</Td>
                    <Td className="tabular-nums">{c._count.leads}</Td>
                    <Td>
                      {latest ? (
                        <>
                          <Badge tone={leadStatusTone[latest.status]}>{leadStatusNames[latest.status]}</Badge>
                          {latest.lastContactAt && (
                            <span className="block text-xs text-ink-muted">
                              Contacted {fmtDateTime(latest.lastContactAt)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{fmtDateTime(c.createdAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={result.page} pages={result.pages} params={Object.fromEntries(params)} />
        </>
      )}
    </>
  );
}
