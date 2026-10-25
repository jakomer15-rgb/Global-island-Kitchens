import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Empty, fmtDate, label, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { listMaterials } from "@/server/admin/content";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { boardLabels } from "./material-form";

export const metadata: Metadata = { title: "Materials" };

export default async function MaterialsPage() {
  const actor = await requireActor("materials.manage");
  const items = await listMaterials(db, actor);

  return (
    <>
      <PageHeader
        title="Materials library"
        description="EGGER laminate and melamine décors and painted MDF colours. A décor appears on the website only after it is checked against the current range and published."
        actions={
          <Link href="/admin/materials/new" className="text-sm font-medium underline underline-offset-4">
            Add material
          </Link>
        }
      />
      {items.length === 0 ? (
        <Empty>No materials yet. Add the décors you stock or order regularly.</Empty>
      ) : (
        <Table label="Materials">
          <thead>
            <tr>
              <Th>Décor</Th>
              <Th>Board</Th>
              <Th>Availability</Th>
              <Th>Checked</Th>
              <Th>Website</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id}>
                <Td>
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="size-6 shrink-0 border border-line"
                      style={{ background: m.swatchHex ?? "transparent" }}
                    />
                    <span>
                      <Link
                        href={`/admin/materials/${m.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {m.nameEn}
                      </Link>
                      <span className="block font-mono text-xs text-ink-muted" dir="ltr">
                        {m.code}
                      </span>
                    </span>
                  </span>
                </Td>
                <Td>{boardLabels[m.board]}</Td>
                <Td>{label(m.availability)}</Td>
                <Td>
                  {m.verifiedAt ? (
                    <span className="text-xs">
                      {fmtDate(m.verifiedAt)}
                      {m.verifiedBy && <span className="block text-ink-muted">{m.verifiedBy.name}</span>}
                    </span>
                  ) : (
                    <Badge tone="warn">Not checked</Badge>
                  )}
                </Td>
                <Td>{m.published ? <Badge tone="good">Published</Badge> : <Badge>Hidden</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
