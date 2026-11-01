import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/action-form";
import { MediaUploader } from "@/components/admin/media-uploader";
import { Empty, fmtDate, PageHeader, Panel } from "@/components/admin/ui";
import {
  canManageMedia,
  listMedia,
  mediaKinds,
  mediaUrl,
  timesUsed,
  type MediaKind,
} from "@/server/admin/media";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { db } from "@/server/db";
import { redirect } from "next/navigation";
import { deleteMediaAction, finishMediaAction, startMediaAction } from "./actions";

export const metadata: Metadata = { title: "Website images" };

const kindLabels: Record<MediaKind, string> = {
  material_image: "Material décor",
  project_photo: "Project photo",
  blog_image: "Blog image",
  catalog_image: "Category, product or machine",
};

export default async function MediaPage() {
  const actor = await requireActor();
  if (!canManageMedia(actor)) redirect("/admin/no-access");
  const items = await listMedia(db, actor);
  const kinds = (Object.keys(mediaKinds) as MediaKind[])
    .filter((k) => can(actor, mediaKinds[k]))
    .map((k) => ({ value: k, label: kindLabels[k] }));

  return (
    <>
      <PageHeader
        title="Website images"
        description="Photos shown on the public website. Only upload images the company owns or has written permission to use, and say so in the credit."
      />
      <Panel title="Upload an image" className="mb-8">
        <MediaUploader kinds={kinds} start={startMediaAction} finish={finishMediaAction} />
      </Panel>
      {items.length === 0 ? (
        <Empty>No website images yet.</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((m) => {
            const uses = timesUsed(m._count);
            return (
              <li key={m.id} className="border border-line bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element -- served through /media redirects */}
                <img
                  src={mediaUrl(m.id)}
                  alt=""
                  className="aspect-[4/3] w-full bg-sand object-cover"
                  loading="lazy"
                />
                <div className="space-y-1 p-3 text-sm">
                  <p className="truncate font-medium" title={m.originalName}>
                    {m.originalName}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {kindLabels[m.kind as MediaKind]} · {fmtDate(m.createdAt)} · {m.uploadedBy?.name ?? "—"}
                  </p>
                  <p className="text-xs">{m.credit}</p>
                  {uses > 0 ? (
                    <p className="text-xs text-ink-muted">
                      Used on {uses} page{uses === 1 ? "" : "s"}
                    </p>
                  ) : (
                    <ActionForm
                      action={deleteMediaAction.bind(null, m.id)}
                      submitLabel="Delete"
                      variant="outline"
                      confirm="Delete this image permanently?"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
