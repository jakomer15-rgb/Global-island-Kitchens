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
import { requireActor } from "@/server/auth/session";
import { assignableStaff } from "@/server/crm/shared";
import { db } from "@/server/db";
import { listProjects, projectStages } from "@/server/quotations/projects";
import { stageTone } from "../quotations/tones";

export const metadata: Metadata = { title: "Projects" };

const filtersSchema = z.object({
  stage: z
    .enum(projectStages as [string, ...string[]])
    .optional()
    .catch(undefined),
  assignedTo: z
    .string()
    .regex(/^(none|[a-z0-9-]{20,40})$/i)
    .optional()
    .catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

export default async function ProjectsPage({ searchParams }: PageProps<"/admin/projects">) {
  const actor = await requireActor("project.read");
  const raw = await searchParams;
  const filters = filtersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const [result, staff] = await Promise.all([listProjects(db, actor, filters as never), assignableStaff(db)]);

  return (
    <>
      <PageHeader
        title="Projects"
        description="From first enquiry to completion. Start one from a lead, or it is created when a quotation becomes an order."
      />
      <ul className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Projects by stage">
        {projectStages.map((s) => (
          <li key={s}>
            <Link
              href={filters.stage === s ? "/admin/projects" : `/admin/projects?stage=${s}`}
              aria-current={filters.stage === s ? "page" : undefined}
              className="inline-flex items-center gap-2 border border-line bg-white px-3 py-1.5 aria-[current=page]:border-charcoal aria-[current=page]:bg-charcoal aria-[current=page]:text-ivory"
            >
              {label(s)} <span className="tabular-nums">{result.byStage[s] ?? 0}</span>
            </Link>
          </li>
        ))}
      </ul>
      <FilterBar>
        <FilterField label="Search">
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Reference, title, customer"
            className={adminInput}
          />
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
        {filters.stage && <input type="hidden" name="stage" value={filters.stage} />}
      </FilterBar>
      {result.items.length === 0 ? (
        <Empty>No projects match.</Empty>
      ) : (
        <>
          <Table label="Projects">
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Project</Th>
                <Th>Stage</Th>
                <Th>Order</Th>
                <Th>Target date</Th>
                <Th>Assigned</Th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link
                      href={`/admin/projects/${p.id}`}
                      className="font-mono text-xs font-medium whitespace-nowrap underline-offset-4 hover:underline"
                    >
                      {p.reference}
                    </Link>
                  </Td>
                  <Td>
                    {p.title}
                    <span className="block text-xs text-ink-muted">{p.customer.name}</span>
                  </Td>
                  <Td>
                    <Badge tone={stageTone[p.stage]}>{label(p.stage)}</Badge>
                  </Td>
                  <Td className="font-mono text-xs whitespace-nowrap">{p.order?.number ?? "—"}</Td>
                  <Td className="whitespace-nowrap">{p.targetDate ? fmtDate(p.targetDate) : "—"}</Td>
                  <Td>{p.assignedTo?.name ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={result.page}
            pages={result.pages}
            params={{ stage: filters.stage, assignedTo: filters.assignedTo, q: filters.q }}
          />
        </>
      )}
    </>
  );
}
