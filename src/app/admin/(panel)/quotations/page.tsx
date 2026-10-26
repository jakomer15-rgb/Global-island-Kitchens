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
import { isPast } from "@/lib/admin/time";
import { formatBhd } from "@/lib/money";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { listQuotations, quotationStatuses } from "@/server/quotations/quotations";
import { quotationTone } from "./tones";

export const metadata: Metadata = { title: "Quotations" };

const filtersSchema = z.object({
  status: z
    .enum(quotationStatuses as [string, ...string[]])
    .optional()
    .catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

export default async function QuotationsPage({ searchParams }: PageProps<"/admin/quotations">) {
  const actor = await requireActor("quotation.read");
  const raw = await searchParams;
  const filters = filtersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const result = await listQuotations(db, actor, filters as never);

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Quotations are started from a lead (open the lead and choose “Create quotation”)."
      />
      <FilterBar>
        <FilterField label="Search">
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Number, title, customer, lead"
            className={adminInput}
          />
        </FilterField>
        <FilterField label="Status">
          <select name="status" defaultValue={filters.status ?? ""} className={adminInput}>
            <option value="">Any</option>
            {quotationStatuses.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>
      {result.items.length === 0 ? (
        <Empty>No quotations match.</Empty>
      ) : (
        <>
          <Table label="Quotations">
            <thead>
              <tr>
                <Th>Number</Th>
                <Th>Customer / title</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th>Valid until</Th>
                <Th>Owner</Th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((q) => {
                const rev = q.revisions[0];
                const expired =
                  q.status === "sent" &&
                  rev?.validUntil &&
                  isPast(new Date(rev.validUntil.getTime() + 864e5));
                return (
                  <tr key={q.id}>
                    <Td>
                      <Link
                        href={`/admin/quotations/${q.id}`}
                        className="font-mono text-xs font-medium whitespace-nowrap underline-offset-4 hover:underline"
                      >
                        {q.number}
                      </Link>
                      {rev && <span className="block text-xs text-ink-muted">rev. {rev.revision}</span>}
                    </Td>
                    <Td>
                      {q.customer.name}
                      <span className="block text-xs text-ink-muted">{q.title}</span>
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {rev ? formatBhd(Number(rev.totalFils)) : "—"}
                    </Td>
                    <Td>
                      <Badge tone={quotationTone[q.status]}>{label(q.status)}</Badge>{" "}
                      {expired && <Badge tone="warn">Expired</Badge>}
                    </Td>
                    <Td className="whitespace-nowrap">{rev?.validUntil ? fmtDate(rev.validUntil) : "—"}</Td>
                    <Td>{q.assignedTo?.name ?? "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination
            page={result.page}
            pages={result.pages}
            params={{ status: filters.status, q: filters.q }}
          />
        </>
      )}
    </>
  );
}
