import type { Metadata } from "next";
import Link from "next/link";
import { Empty, fmtDateTime, label, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { possibleDuplicates } from "@/server/crm/customers";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Possible duplicate customers" };

export default async function DuplicatesPage() {
  const actor = await requireActor("customer.read");
  const groups = await possibleDuplicates(db, actor);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/customers" className="underline underline-offset-4">
          ← All customers
        </Link>
      </p>
      <PageHeader
        title="Possible duplicate customers"
        description="Customers with the same name but a different phone or email (the same phone or email always joins one record already). Check they are the same person, then open the record to keep and merge the other into it."
      />
      {groups.length === 0 ? (
        <Empty>No possible duplicates found.</Empty>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <Table key={group[0]!.id} label={`Customers named ${group[0]!.name}`}>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Contact</Th>
                  <Th>Type</Th>
                  <Th>Location</Th>
                  <Th>Leads</Th>
                  <Th>Since</Th>
                </tr>
              </thead>
              <tbody>
                {group.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <Link href={`/admin/customers/${c.id}#duplicates`} className="font-medium underline">
                        {c.name}
                      </Link>
                      {c.company && <span className="block text-xs text-ink-muted">{c.company}</span>}
                    </Td>
                    <Td>
                      <span dir="ltr">{c.phone}</span>
                      <span className="block text-xs">{c.email}</span>
                    </Td>
                    <Td>{label(c.type)}</Td>
                    <Td>{c.location ?? "—"}</Td>
                    <Td className="tabular-nums">{c._count.leads}</Td>
                    <Td className="whitespace-nowrap">{fmtDateTime(c.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ))}
        </div>
      )}
    </>
  );
}
