import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { CUID } from "@/server/admin/action";
import { getMaterial } from "@/server/admin/content";
import { listMedia } from "@/server/admin/media";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { deleteMaterialAction } from "../actions";
import { MaterialForm } from "../material-form";

export const metadata: Metadata = { title: "Material" };

export default async function MaterialPage({ params }: PageProps<"/admin/materials/[id]">) {
  const actor = await requireActor("materials.manage");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  const material = await getMaterial(db, actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const images = await listMedia(db, actor, "material_image");

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/materials" className="underline underline-offset-4">
          ← Materials
        </Link>
      </p>
      <PageHeader title={material.nameEn} description={material.code} />
      <Panel>
        <MaterialForm material={material} images={images} />
      </Panel>
      <Panel title="Delete" className="mt-6 max-w-xl">
        <p className="mb-3 text-sm text-ink-muted">
          To take a décor off the website but keep it, untick “Show on the website”.
        </p>
        <ActionForm
          action={deleteMaterialAction.bind(null, material.id)}
          submitLabel="Delete material"
          variant="outline"
          confirm={`Delete ${material.nameEn}?`}
        />
      </Panel>
    </>
  );
}
