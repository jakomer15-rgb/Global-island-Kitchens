import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/ui";
import { listMedia } from "@/server/admin/media";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { MaterialForm } from "../material-form";

export const metadata: Metadata = { title: "Add material" };

export default async function NewMaterialPage() {
  const actor = await requireActor("materials.manage");
  const images = await listMedia(db, actor, "material_image");
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/materials" className="underline underline-offset-4">
          ← Materials
        </Link>
      </p>
      <PageHeader title="Add material" />
      <Panel>
        <MaterialForm images={images} />
      </Panel>
    </>
  );
}
