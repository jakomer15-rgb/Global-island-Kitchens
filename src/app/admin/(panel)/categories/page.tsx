import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { Badge, Empty, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import type { CategorySection } from "@/generated/prisma/client";
import { cn } from "@/lib/cn";
import { categorySections, listCategories, sectionLabels } from "@/server/admin/categories";
import { mediaUrl } from "@/server/admin/media";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { moveCategoryAction } from "./actions";
import { categoryPath } from "./paths";

export const metadata: Metadata = { title: "Manage categories" };

const intro: Record<CategorySection, string> = {
  products:
    "Product categories appear in the “What we make” menu, the footer and the homepage tiles, each with its own page listing its products.",
  projects:
    "Project categories group the portfolio on the Projects page. Assign projects to them in Portfolio.",
  factory: "Factory categories group the machinery shown on the About page.",
};

export default async function CategoriesPage({ searchParams }: PageProps<"/admin/categories">) {
  const actor = await requireActor("catalog.manage");
  const raw = (await searchParams).section;
  const section = categorySections.find((s) => s === raw) ?? "products";
  const items = await listCategories(db, actor, section);
  const labels = sectionLabels[section];

  return (
    <>
      <PageHeader
        title="Manage categories"
        description={intro[section]}
        actions={
          <Link
            href={`/admin/categories/new?section=${section}`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Add {labels.title.toLowerCase()} category
          </Link>
        }
      />
      <nav aria-label="Sections" className="mb-5 flex flex-wrap gap-1 border-b border-line">
        {categorySections.map((s) => (
          <Link
            key={s}
            href={`/admin/categories?section=${s}`}
            aria-current={s === section ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm",
              s === section
                ? "border-walnut font-medium"
                : "border-transparent text-ink-muted hover:text-charcoal",
            )}
          >
            {sectionLabels[s].title}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <Empty>No {labels.title.toLowerCase()} categories yet.</Empty>
      ) : (
        <Table label={`${labels.title} categories`}>
          <thead>
            <tr>
              <Th className="w-24">Order</Th>
              <Th>Category</Th>
              <Th>Web address</Th>
              <Th>
                {section === "projects" ? "Projects" : labels.items.replace(/^./, (c) => c.toUpperCase())}
              </Th>
              <Th>Website</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((c, i) => {
              const path = categoryPath(c);
              return (
                <tr key={c.id}>
                  <Td>
                    <div className="flex gap-1">
                      <ActionForm
                        action={moveCategoryAction.bind(null, c.id, "up")}
                        submitLabel="Up"
                        variant="outline"
                        inline
                        className={i === 0 ? "invisible" : undefined}
                      />
                      <ActionForm
                        action={moveCategoryAction.bind(null, c.id, "down")}
                        submitLabel="Down"
                        variant="outline"
                        inline
                        className={i === items.length - 1 ? "invisible" : undefined}
                      />
                    </div>
                  </Td>
                  <Td>
                    <span className="flex items-center gap-3">
                      {c.imageFileId ? (
                        // eslint-disable-next-line @next/next/no-img-element -- served through /media redirects
                        <img
                          src={mediaUrl(c.imageFileId)}
                          alt=""
                          className="size-10 shrink-0 bg-sand object-cover"
                        />
                      ) : (
                        <span aria-hidden className="size-10 shrink-0 border border-line bg-sand" />
                      )}
                      <span>
                        <Link
                          href={`/admin/categories/${c.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {c.nameEn}
                        </Link>
                        <span className="block text-xs text-ink-muted" dir="rtl" lang="ar">
                          {c.nameAr}
                        </span>
                      </span>
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs" dir="ltr">
                      {path ?? c.slug}
                    </span>
                    {c.pageKey && <span className="block text-xs text-ink-muted">Built-in page</span>}
                  </Td>
                  <Td className="tabular-nums">
                    {section === "projects" ? c._count.projects : c._count.items}
                  </Td>
                  <Td>{c.published ? <Badge tone="good">Published</Badge> : <Badge>Hidden</Badge>}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
