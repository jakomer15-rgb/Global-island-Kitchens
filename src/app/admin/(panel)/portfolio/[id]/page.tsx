import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput, AdminSelect } from "@/components/admin/fields";
import { Empty, PageHeader, Panel } from "@/components/admin/ui";
import { CUID } from "@/server/admin/action";
import { listMedia, mediaUrl } from "@/server/admin/media";
import { getProjectForEdit } from "@/server/admin/portfolio";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { addImageAction, deleteProjectAction, removeImageAction } from "../actions";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/admin/portfolio/[id]">) {
  const actor = await requireActor("portfolio.manage");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  const project = await getProjectForEdit(db, actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const photos = await listMedia(db, actor, "project_photo");
  const used = new Set(project.images.map((i) => i.fileId));
  const available = photos.filter((p) => !used.has(p.id));

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/portfolio" className="underline underline-offset-4">
          ← Portfolio
        </Link>
      </p>
      <PageHeader
        title={project.nameEn}
        actions={
          project.published ? (
            <a
              href={`/projects/${project.slug}`}
              target="_blank"
              rel="noopener"
              className="text-sm underline underline-offset-4"
            >
              View on the website
            </a>
          ) : undefined
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <ProjectForm project={project} />
        </Panel>
        <div className="space-y-6">
          <Panel title="Photos">
            {project.images.length === 0 ? (
              <Empty>No photos. The project shows as text until one is added.</Empty>
            ) : (
              <ul className="space-y-4">
                {project.images.map((img) => (
                  <li key={img.id} className="flex gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served through /media */}
                    <img
                      src={mediaUrl(img.fileId)}
                      alt=""
                      className="size-20 shrink-0 bg-sand object-cover"
                    />
                    <div className="min-w-0 text-sm">
                      <p>{img.altEn}</p>
                      <p className="text-xs text-ink-muted">{img.file.credit}</p>
                      <ActionForm
                        action={removeImageAction.bind(null, img.id)}
                        submitLabel="Remove"
                        variant="outline"
                        className="mt-2"
                        confirm="Remove this photo from the project?"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Add a photo">
            {available.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Upload project photos in{" "}
                <Link href="/admin/media" className="underline">
                  Website images
                </Link>{" "}
                first.
              </p>
            ) : (
              <ActionForm
                action={addImageAction.bind(null, project.id)}
                submitLabel="Add photo"
                resetOnSuccess
              >
                <AdminSelect
                  label="Photo"
                  name="fileId"
                  options={available.map((p) => ({ value: p.id, label: p.originalName }))}
                />
                <AdminInput
                  label="Description (English)"
                  name="altEn"
                  required
                  maxLength={160}
                  hint="What the photo shows."
                />
                <AdminInput
                  label="Description (Arabic)"
                  name="altAr"
                  required
                  maxLength={160}
                  dir="rtl"
                  lang="ar"
                />
                <AdminCheckbox
                  name="usagePermission"
                  label="The client and the photographer agreed to this photo being shown"
                />
              </ActionForm>
            )}
          </Panel>
          <Panel title="Delete">
            <p className="mb-3 text-sm text-ink-muted">
              To hide the project but keep it, untick “Show on the website”.
            </p>
            <ActionForm
              action={deleteProjectAction.bind(null, project.id)}
              submitLabel="Delete project"
              variant="outline"
              confirm={`Delete ${project.nameEn}?`}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
