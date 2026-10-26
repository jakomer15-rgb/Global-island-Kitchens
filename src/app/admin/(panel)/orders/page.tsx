import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import {
  adminInput,
  Badge,
  Empty,
  FilterBar,
  FilterField,
  fmtDate,
  label,
  PageHeader,
  Pagination,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { formatBhd } from "@/lib/money";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { listOrders, orderStatuses } from "@/server/quotations/projects";

export const metadata: Metadata = { title: "Orders" };

const filtersSchema = z.object({
  status: z
    .enum(orderStatuses as [string, ...string[]])
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const actor = await requireActor("quotation.read");
  const raw = await searchParams;
  const filters = filtersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const result = await listOrders(db, actor, filters as never);

  return (
    <>
      <PageHeader
        title="Orders"
        description="Created from approved quotations. Manage each order from its project."
      />
      <FilterBar>
        <FilterField label="Status">
          <select name="status" defaultValue={filters.status ?? ""} className={adminInput}>
            <option value="">Any</option>
            {orderStatuses.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>
      {result.items.length === 0 ? (
        <Empty>No orders yet.</Empty>
      ) : (
        <>
          <Table label="Orders">
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer / quotation</Th>
                <Th>Total</Th>
                <Th>Deposit</Th>
                <Th>Status</Th>
                <Th>Project</Th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <span className="font-mono text-xs whitespace-nowrap">{o.number}</span>
                    <span className="block text-xs text-ink-muted">{fmtDate(o.createdAt)}</span>
                  </Td>
                  <Td>
                    {o.customer.name}
                    <Link
                      href={`/admin/quotations/${o.revision.quotation.id}`}
                      className="block font-mono text-xs underline"
                    >
                      {o.revision.quotation.number} rev. {o.revision.revision}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">{formatBhd(Number(o.totalFils))}</Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {o.depositFils !== null ? formatBhd(Number(o.depositFils)) : "—"}
                    {o.depositReceivedAt && <span className="block text-xs text-emerald-800">Received</span>}
                  </Td>
                  <Td>
                    <Badge
                      tone={o.status === "cancelled" ? "bad" : o.status === "completed" ? "good" : "info"}
                    >
                      {label(o.status)}
                    </Badge>
                  </Td>
                  <Td>
                    {o.project ? (
                      <Link href={`/admin/projects/${o.project.id}`} className="font-mono text-xs underline">
                        {o.project.reference}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={result.page} pages={result.pages} params={{ status: filters.status }} />
        </>
      )}
    </>
  );
}
