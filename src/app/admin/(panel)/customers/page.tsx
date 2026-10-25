import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import {
  adminInput,
  Empty,
  FilterBar,
  FilterField,
  fmtDateTime,
  label,
  PageHeader,
  Pagination,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { customerTypes, listCustomers } from "@/server/crm/customers";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Customers" };

const filtersSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  type: z
    .enum(customerTypes as [string, ...string[]])
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const actor = await requireActor("customer.read");
  const raw = await searchParams;
  const filters = filtersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const result = await listCustomers(db, actor, filters as never);

  return (
    <>
      <PageHeader
        title="Customers"
        description="One record per customer, matched by phone or email across their enquiries."
      />
      <FilterBar>
        <FilterField label="Search">
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Name, company, phone, email"
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
      </FilterBar>
      {result.items.length === 0 ? (
        <Empty>No customers match.</Empty>
      ) : (
        <>
          <Table label="Customers">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Contact</Th>
                <Th>Type</Th>
                <Th>Leads</Th>
                <Th>Since</Th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((c) => (
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
                  <Td className="tabular-nums">{c._count.leads}</Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(c.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={result.page} pages={result.pages} params={{ q: filters.q, type: filters.type }} />
        </>
      )}
    </>
  );
}
