import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Empty, label, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { listProjects } from "@/server/admin/portfolio";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const actor = await requireActor("portfolio.manage");
  const projects = await listProjects(db, actor);

  return (
    <>
      <PageHeader
        title="Portfolio"
        description="Projects from the company profile. Add photos and client names only with permission."
        actions={
          <Link href="/admin/portfolio/new" className="text-sm font-medium underline underline-offset-4">
            Add project
          </Link>
        }
      />
      {projects.length === 0 ? (
        <Empty>No projects. Run the seed to load the projects from the company profile.</Empty>
      ) : (
        <Table label="Projects">
          <thead>
            <tr>
              <Th>Project</Th>
              <Th>Type / category</Th>
              <Th>Photos</Th>
              <Th>Website</Th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <Td>
                  <Link
                    href={`/admin/portfolio/${p.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {p.nameEn}
                  </Link>
                  <span className="block text-xs text-ink-muted">{p.locationEn}</span>
                </Td>
                <Td>
                  {label(p.segment)}
                  {p.category && <span className="block text-xs text-ink-muted">{p.category.nameEn}</span>}
                </Td>
                <Td className="tabular-nums">{p._count.images}</Td>
                <Td>
                  {p.published ? <Badge tone="good">Published</Badge> : <Badge>Hidden</Badge>}{" "}
                  {p.featured && <Badge>Featured</Badge>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
