import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { Badge, Empty, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { CUID } from "@/server/admin/action";
import { getCategoryForEdit, itemCategoryOptions, sectionLabels } from "@/server/admin/categories";
import { listMedia, mediaUrl } from "@/server/admin/media";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { deleteCategoryAction, moveItemAction } from "../actions";
import { CategoryForm, ItemForm } from "../forms";
import { categoryPath } from "../paths";

export const metadata: Metadata = { title: "Category" };

export default async function CategoryPage({ params }: PageProps<"/admin/categories/[id]">) {
  const actor = await requireActor("catalog.manage");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  const category = await getCategoryForEdit(db, actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const [images, siblings] = await Promise.all([
    listMedia(db, actor, "catalog_image"),
    itemCategoryOptions(db, actor, category.section),
  ]);
  const labels = sectionLabels[category.section];
  const path = categoryPath(category);
  const holdsItems = category.section !== "projects";

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={`/admin/categories?section=${category.section}`} className="underline underline-offset-4">
          ← {labels.title} categories
        </Link>
      </p>
      <PageHeader
        title={category.nameEn}
        description={
          <>
            {labels.title} category
            {path && (
              <>
                {" · "}
                <a
                  href={path}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                  dir="ltr"
                >
                  {path}
                </a>
              </>
            )}
          </>
        }
      />
      <Panel>
        <CategoryForm
          category={category}
          section={category.section}
          images={images}
          fixedPath={category.pageKey ? (path ?? undefined) : undefined}
        />
      </Panel>

      {holdsItems ? (
        <>
          <h2 className="mt-10 mb-4 font-display text-2xl">
            {labels.items.replace(/^./, (c) => c.toUpperCase())} in this category
          </h2>
          {category.items.length === 0 ? (
            <Empty>No {labels.items} yet. Add the first one below.</Empty>
          ) : (
            <Table label={`${labels.items} in ${category.nameEn}`}>
              <thead>
                <tr>
                  <Th className="w-24">Order</Th>
                  <Th>Name</Th>
                  <Th>Website</Th>
                </tr>
              </thead>
              <tbody>
                {category.items.map((item, i) => (
                  <tr key={item.id}>
                    <Td>
                      <div className="flex gap-1">
                        <ActionForm
                          action={moveItemAction.bind(null, item.id, "up")}
                          submitLabel="Up"
                          variant="outline"
                          inline
                          className={i === 0 ? "invisible" : undefined}
                        />
                        <ActionForm
                          action={moveItemAction.bind(null, item.id, "down")}
                          submitLabel="Down"
                          variant="outline"
                          inline
                          className={i === category.items.length - 1 ? "invisible" : undefined}
                        />
                      </div>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-3">
                        {item.imageFileId ? (
                          // eslint-disable-next-line @next/next/no-img-element -- served through /media redirects
                          <img
                            src={mediaUrl(item.imageFileId)}
                            alt=""
                            className="size-10 shrink-0 bg-sand object-cover"
                          />
                        ) : (
                          <span aria-hidden className="size-10 shrink-0 border border-line bg-sand" />
                        )}
                        <span>
                          <Link
                            href={`/admin/categories/items/${item.id}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {item.nameEn}
                          </Link>
                          <span className="block text-xs text-ink-muted" dir="rtl" lang="ar">
                            {item.nameAr}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td>{item.published ? <Badge tone="good">Published</Badge> : <Badge>Hidden</Badge>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Panel title={`Add a ${labels.item}`} className="mt-6">
            <ItemForm categoryId={category.id} categories={siblings} images={images} noun={labels.item} />
          </Panel>
        </>
      ) : (
        <Panel title="Projects in this category" className="mt-8">
          {category.projects.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No projects yet. Open a project in Portfolio and choose this category.
            </p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {category.projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {can(actor, "portfolio.manage") ? (
                      <Link
                        href={`/admin/portfolio/${p.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {p.nameEn}
                      </Link>
                    ) : (
                      <span className="font-medium">{p.nameEn}</span>
                    )}
                    <span className="block text-xs text-ink-muted">{p.locationEn}</span>
                  </span>
                  {p.published ? <Badge tone="good">Published</Badge> : <Badge>Hidden</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Panel title="Delete" className="mt-6 max-w-xl">
        {category.pageKey ? (
          <p className="text-sm text-ink-muted">
            This product line has its own page, so it can’t be deleted. To take it off the website, untick
            “Show on the website”.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-muted">
              {holdsItems
                ? `Move or delete its ${labels.items} first. To take it off the website but keep it, untick “Show on the website”.`
                : "Its projects stay in the portfolio, without a category."}
            </p>
            <ActionForm
              action={deleteCategoryAction.bind(null, category.id)}
              submitLabel="Delete category"
              variant="outline"
              confirm={`Delete the category “${category.nameEn}”?`}
            />
          </>
        )}
      </Panel>
    </>
  );
}
