import type { Metadata } from "next";
import Link from "next/link";
import { isPast } from "@/lib/admin/time";
import { ActionForm } from "@/components/admin/action-form";
import { Badge, Empty, fmtDateTime, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { listFollowUps } from "@/server/crm/leads";
import { db } from "@/server/db";
import { completeFollowUpAction } from "../leads/actions";

export const metadata: Metadata = { title: "Follow-ups" };

export default async function FollowUpsPage({ searchParams }: PageProps<"/admin/follow-ups">) {
  const actor = await requireActor("lead.read");
  const scope = (await searchParams).scope === "all" && can(actor, "lead.assign") ? "all" : "mine";
  const items = await listFollowUps(db, actor, scope);

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Open follow-ups, earliest first. Schedule them from a lead."
        actions={
          can(actor, "lead.assign") ? (
            <div className="flex gap-3 text-sm">
              <Link
                href="?scope=mine"
                aria-current={scope === "mine" ? "page" : undefined}
                className="underline-offset-4 aria-[current=page]:font-semibold aria-[current=page]:underline"
              >
                Mine
              </Link>
              <Link
                href="?scope=all"
                aria-current={scope === "all" ? "page" : undefined}
                className="underline-offset-4 aria-[current=page]:font-semibold aria-[current=page]:underline"
              >
                Everyone&apos;s
              </Link>
            </div>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <Empty>No open follow-ups.</Empty>
      ) : (
        <Table label="Follow-ups">
          <thead>
            <tr>
              <Th>Due</Th>
              <Th>Lead</Th>
              <Th>Note</Th>
              <Th>For</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.id}>
                <Td className="whitespace-nowrap">
                  {fmtDateTime(f.dueAt)} {isPast(f.dueAt) && <Badge tone="bad">Overdue</Badge>}
                </Td>
                <Td>
                  <Link href={`/admin/leads/${f.lead.id}`} className="font-mono text-xs underline">
                    {f.lead.reference}
                  </Link>
                  <span className="block">{f.lead.customer.name}</span>
                </Td>
                <Td>{f.note ?? <span className="text-ink-muted">—</span>}</Td>
                <Td>{f.assignedTo?.name ?? "—"}</Td>
                <Td>
                  {can(actor, "lead.update") && (
                    <ActionForm
                      action={completeFollowUpAction.bind(null, f.id, "/admin/follow-ups")}
                      submitLabel="Done"
                      variant="outline"
                    />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
