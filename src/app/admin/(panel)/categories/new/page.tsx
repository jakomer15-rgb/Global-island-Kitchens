import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/ui";
import { categorySections, sectionLabels } from "@/server/admin/categories";
import { listMedia } from "@/server/admin/media";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { CategoryForm } from "../forms";

export const metadata: Metadata = { title: "Add category" };

export default async function NewCategoryPage({ searchParams }: PageProps<"/admin/categories/new">) {
  const actor = await requireActor("catalog.manage");
  const raw = (await searchParams).section;
  const section = categorySections.find((s) => s === raw) ?? "products";
  const images = await listMedia(db, actor, "catalog_image");
  const title = sectionLabels[section].title;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={`/admin/categories?section=${section}`} className="underline underline-offset-4">
          ← {title} categories
        </Link>
      </p>
      <PageHeader title={`Add ${title.toLowerCase()} category`} />
      <Panel>
        <CategoryForm section={section} images={images} />
      </Panel>
    </>
  );
}
