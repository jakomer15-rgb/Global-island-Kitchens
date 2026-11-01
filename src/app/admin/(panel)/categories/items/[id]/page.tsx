import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { CUID } from "@/server/admin/action";
import { getItemForEdit, itemCategoryOptions, sectionLabels } from "@/server/admin/categories";
import { listMedia } from "@/server/admin/media";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { deleteItemAction } from "../../actions";
import { ItemForm } from "../../forms";

export const metadata: Metadata = { title: "Category item" };

export default async function ItemPage({ params }: PageProps<"/admin/categories/items/[id]">) {
  const actor = await requireActor("catalog.manage");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  const item = await getItemForEdit(db, actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const [images, categories] = await Promise.all([
    listMedia(db, actor, "catalog_image"),
    itemCategoryOptions(db, actor, item.category.section),
  ]);
  const noun = sectionLabels[item.category.section].item;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={`/admin/categories/${item.categoryId}`} className="underline underline-offset-4">
          ← {item.category.nameEn}
        </Link>
      </p>
      <PageHeader
        title={item.nameEn}
        description={`To move this ${noun} to another category, choose it under Category and save.`}
      />
      <Panel>
        <ItemForm
          item={item}
          categoryId={item.categoryId}
          categories={categories}
          images={images}
          noun={noun}
        />
      </Panel>
      <Panel title="Delete" className="mt-6 max-w-xl">
        <p className="mb-3 text-sm text-ink-muted">
          To take it off the website but keep it, untick “Show on the website”.
        </p>
        <ActionForm
          action={deleteItemAction.bind(null, item.id)}
          submitLabel={`Delete ${noun}`}
          variant="outline"
          confirm={`Delete ${item.nameEn}?`}
        />
      </Panel>
    </>
  );
}
