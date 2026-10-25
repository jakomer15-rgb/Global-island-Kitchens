import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Empty, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { listTestimonials } from "@/server/admin/content";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  const actor = await requireActor("content.manage");
  const items = await listTestimonials(db, actor);

  return (
    <>
      <PageHeader
        title="Testimonials"
        description="Shown on the homepage once at least one is published. Each needs the customer's recorded consent."
        actions={
          <Link href="/admin/testimonials/new" className="text-sm font-medium underline underline-offset-4">
            Add testimonial
          </Link>
        }
      />
      {items.length === 0 ? (
        <Empty>No testimonials yet. The homepage shows none until a real, consented one is published.</Empty>
      ) : (
        <Table label="Testimonials">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Text</Th>
              <Th>Consent</Th>
              <Th>Website</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <Td>
                  <Link
                    href={`/admin/testimonials/${t.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {t.displayName}
                  </Link>
                </Td>
                <Td className="max-w-md">
                  <span className="line-clamp-2">{t.textEn ?? t.textAr}</span>
                </Td>
                <Td>
                  {t.consentRecordedAt ? (
                    <Badge tone="good">Recorded</Badge>
                  ) : (
                    <Badge tone="warn">Missing</Badge>
                  )}
                </Td>
                <Td>
                  {t.status === "published" ? <Badge tone="good">Published</Badge> : <Badge>Draft</Badge>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
