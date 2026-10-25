import type { Metadata } from "next";
import { z } from "zod";
import {
  adminInput,
  Empty,
  FilterBar,
  FilterField,
  fmtDateTime,
  PageHeader,
  Pagination,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { listAuditLog } from "@/server/admin/staff";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Audit log" };

const filtersSchema = z.object({
  entityType: z
    .string()
    .regex(/^[a-z_]{1,40}$/)
    .optional()
    .catch(undefined),
  action: z
    .string()
    .regex(/^[a-z_.]{1,60}$/)
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const actor = await requireActor("audit.read");
  const raw = await searchParams;
  const filters = filtersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const result = await listAuditLog(db, actor, filters);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every sign-in and every change made in the admin, newest first. Entries can't be edited or deleted."
      />
      <FilterBar>
        <FilterField label="Record type">
          <select name="entityType" defaultValue={filters.entityType ?? ""} className={adminInput}>
            <option value="">Any</option>
            {result.entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Action starts with">
          <input
            name="action"
            defaultValue={filters.action}
            placeholder="e.g. staff."
            className={adminInput}
          />
        </FilterField>
      </FilterBar>
      {result.items.length === 0 ? (
        <Empty>No entries.</Empty>
      ) : (
        <>
          <Table label="Audit log">
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Record</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((e) => (
                <tr key={e.id} className="align-top">
                  <Td className="whitespace-nowrap">{fmtDateTime(e.createdAt)}</Td>
                  <Td>{e.actor?.name ?? (e.actorId ? "Deleted user" : "System / website")}</Td>
                  <Td className="font-mono text-xs">{e.action}</Td>
                  <Td className="font-mono text-xs break-all">
                    {e.entityType}
                    {e.entityId && <span className="block text-ink-muted">{e.entityId}</span>}
                  </Td>
                  <Td>
                    {e.changes != null && (
                      <details>
                        <summary className="cursor-pointer text-xs">Show</summary>
                        <pre className="mt-1 max-w-md overflow-x-auto text-xs whitespace-pre-wrap" dir="ltr">
                          {JSON.stringify(e.changes, null, 2)}
                        </pre>
                      </details>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={result.page}
            pages={result.pages}
            params={{ entityType: filters.entityType, action: filters.action }}
          />
        </>
      )}
    </>
  );
}
