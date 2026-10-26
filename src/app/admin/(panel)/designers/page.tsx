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
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { listDesigners } from "@/server/designers/admin";
import { designerTone } from "./tones";

export const metadata: Metadata = { title: "Designers" };

const statuses = ["pending", "approved", "rejected", "suspended"] as const;
const filtersSchema = z.object({ status: z.enum(statuses).optional().catch(undefined) });

export default async function DesignersPage({ searchParams }: PageProps<"/admin/designers">) {
  const actor = await requireActor("designer.read");
  const raw = await searchParams;
  const filters = filtersSchema.parse({ status: Array.isArray(raw.status) ? raw.status[0] : raw.status });
  const designers = await listDesigners(db, actor, filters);

  return (
    <>
      <PageHeader
        title="Designers"
        description="Trade partners who registered in the designer portal. Approve a registration after calling them; only approved designers can send projects."
      />
      <FilterBar>
        <FilterField label="Status">
          <select name="status" defaultValue={filters.status ?? ""} className={adminInput}>
            <option value="">Any</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>
      {designers.length === 0 ? (
        <Empty>No designers yet.</Empty>
      ) : (
        <Table label="Designers">
          <thead>
            <tr>
              <Th>Designer</Th>
              <Th>Contact</Th>
              <Th>Profession</Th>
              <Th>Projects</Th>
              <Th>Status</Th>
              <Th>Registered</Th>
            </tr>
          </thead>
          <tbody>
            {designers.map((d) => (
              <tr key={d.id}>
                <Td>
                  <Link
                    href={`/admin/designers/${d.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {d.user.name}
                  </Link>
                  {d.company && <span className="block text-xs text-ink-muted">{d.company}</span>}
                </Td>
                <Td>
                  <span dir="ltr" className="block">
                    {d.phone}
                  </span>
                  <span className="block text-xs break-all">{d.user.email}</span>
                </Td>
                <Td>{label(d.profession)}</Td>
                <Td className="tabular-nums">{d._count.projects}</Td>
                <Td>
                  <Badge tone={designerTone[d.status]}>{label(d.status)}</Badge>
                </Td>
                <Td className="whitespace-nowrap">{fmtDate(d.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
