import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { ActionForm } from "@/components/admin/action-form";
import {
  adminInput,
  Badge,
  consultationTone,
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
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { consultationStatuses, listConsultations, nextStatuses } from "@/server/crm/consultations";
import { assignableStaff } from "@/server/crm/shared";
import { db } from "@/server/db";
import { consultationAssignAction, consultationStatusAction } from "./actions";

export const metadata: Metadata = { title: "Consultations" };

const filtersSchema = z.object({
  status: z
    .enum(consultationStatuses as [string, ...string[]])
    .optional()
    .catch(undefined),
  when: z.enum(["upcoming", "past"]).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

export default async function ConsultationsPage({ searchParams }: PageProps<"/admin/consultations">) {
  const actor = await requireActor("consultation.read");
  const raw = await searchParams;
  const filters = filtersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const [result, staff] = await Promise.all([
    listConsultations(db, actor, filters as never),
    assignableStaff(db),
  ]);
  const canUpdate = can(actor, "consultation.update");

  return (
    <>
      <PageHeader
        title="Consultations"
        description="Requests from the website. Call the customer to agree a time, then mark the consultation confirmed."
      />
      <FilterBar>
        <FilterField label="When">
          <select name="when" defaultValue={filters.when ?? ""} className={adminInput}>
            <option value="">Any date</option>
            <option value="upcoming">Today and later</option>
            <option value="past">Past</option>
          </select>
        </FilterField>
        <FilterField label="Status">
          <select name="status" defaultValue={filters.status ?? ""} className={adminInput}>
            <option value="">Any</option>
            {consultationStatuses.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>
      {result.items.length === 0 ? (
        <Empty>No consultations match.</Empty>
      ) : (
        <>
          <Table label="Consultations">
            <thead>
              <tr>
                <Th>Preferred date</Th>
                <Th>Customer</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Assigned</Th>
                {canUpdate && <Th>Update</Th>}
              </tr>
            </thead>
            <tbody>
              {result.items.map((c) => (
                <tr key={c.id}>
                  <Td className="whitespace-nowrap">
                    {fmtDate(c.preferredDate)}
                    <span className="block text-xs text-ink-muted">{label(c.preferredSlot)}</span>
                  </Td>
                  <Td>
                    {c.customer.name}
                    <span className="block text-xs" dir="ltr">
                      {c.customer.phone}
                    </span>
                    <Link href={`/admin/leads/${c.lead.id}`} className="font-mono text-xs underline">
                      {c.lead.reference}
                    </Link>
                  </Td>
                  <Td>
                    {label(c.type)}
                    {c.area && <span className="block text-xs text-ink-muted">{c.area}</span>}
                  </Td>
                  <Td>
                    <Badge tone={consultationTone[c.status]}>{label(c.status)}</Badge>
                  </Td>
                  <Td>
                    {canUpdate ? (
                      <ActionForm
                        action={consultationAssignAction.bind(null, c.id)}
                        submitLabel="Save"
                        variant="outline"
                        inline
                      >
                        <select
                          name="userId"
                          defaultValue={c.assignedToId ?? ""}
                          aria-label="Assigned to"
                          className={adminInput}
                        >
                          <option value="">Unassigned</option>
                          {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </ActionForm>
                    ) : (
                      (c.assignedTo?.name ?? "—")
                    )}
                  </Td>
                  {canUpdate && (
                    <Td>
                      {nextStatuses(c.status).length === 0 ? (
                        <span className="text-ink-muted">Closed</span>
                      ) : (
                        <ActionForm
                          action={consultationStatusAction.bind(null, c.id)}
                          submitLabel="Set"
                          variant="outline"
                          inline
                        >
                          <select name="status" aria-label="New status" className={adminInput}>
                            {nextStatuses(c.status).map((s) => (
                              <option key={s} value={s}>
                                {label(s)}
                              </option>
                            ))}
                          </select>
                        </ActionForm>
                      )}
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={result.page}
            pages={result.pages}
            params={{ status: filters.status, when: filters.when }}
          />
        </>
      )}
    </>
  );
}
