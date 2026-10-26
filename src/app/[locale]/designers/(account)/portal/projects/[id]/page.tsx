import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { MessageForm } from "@/components/designers/project-form";
import { PageHero } from "@/components/site/page-hero";
import { pathFor } from "@/config/routes";
import { portal } from "@/content/portal";
import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/lib/seo";
import { db } from "@/server/db";
import { getMyProject } from "@/server/designers/designers";
import { requireApprovedDesigner } from "@/server/designers/session";
import { NotFoundError } from "@/server/errors";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/designers/portal/projects/[id]">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return { title: portal.home.metaTitle[locale] };
}

const ID = /^[a-z0-9]{20,40}$/;

const dimensionLabels = { en: ["W", "H", "D"], ar: ["عرض", "ارتفاع", "عمق"] } as const;

/** "W 320 × H 240 cm", in the unit the designer used. */
function measureText(
  wall: { width?: number; height?: number; depth?: number },
  locale: Locale,
  unit: string,
) {
  const [w, h, d] = dimensionLabels[locale];
  const parts = [
    wall.width && `${w} ${wall.width}`,
    wall.height && `${h} ${wall.height}`,
    wall.depth && `${d} ${wall.depth}`,
  ].filter(Boolean);
  return parts.length ? `${parts.join(" × ")} ${unit}` : "";
}

export default async function DesignerProjectPage({
  params,
  searchParams,
}: PageProps<"/[locale]/designers/portal/projects/[id]">) {
  const { locale: rawLocale, id } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  const designer = await requireApprovedDesigner(
    localizedPath("/designers/sign-in", locale),
    localizedPath("/designers/portal", locale),
  );
  if (!ID.test(id)) notFound();
  const project = await getMyProject(db, designer, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const sent = (await searchParams).sent === "1";
  const stamp = new Intl.DateTimeFormat(locale === "ar" ? "ar-BH" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bahrain",
  });
  const walls =
    (project.request.measurements as { label?: string; width?: number; height?: number; depth?: number }[]) ??
    [];
  const p = portal.project;

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[
          { label: portal.eyebrow[locale], path: pathFor("designers") },
          { label: portal.home.metaTitle[locale], path: "/designers/portal" },
          { label: project.title, path: `/designers/portal/projects/${project.id}` },
        ]}
        eyebrow={`${portal.home.reference[locale]} ${project.request.reference}`}
        title={project.title}
      />
      <section className="py-12 md:py-16">
        <div className="container-site grid gap-12 lg:grid-cols-12">
          <div className="space-y-10 lg:col-span-7">
            {sent && (
              <p role="status" className="border-s-2 border-walnut bg-sand px-4 py-3 text-sm">
                {p.done[locale]}
              </p>
            )}
            <div>
              <h2 className="font-display text-display-md">{portal.home.status[locale]}</h2>
              <p className="mt-3 text-lg">{portal.progress[project.progress][locale]}</p>
              <p className="mt-2 text-sm text-ink-muted">{p.quotationNote[locale]}</p>
            </div>

            <div>
              <h2 className="font-display text-display-md">{p.messages[locale]}</h2>
              {project.messages.length === 0 ? (
                <p className="mt-3 text-ink-muted">{p.noMessages[locale]}</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {project.messages.map((m) => (
                    <li
                      key={m.id}
                      className={`border border-line p-4 ${m.fromStaff ? "bg-sand" : "bg-white"}`}
                    >
                      <p className="text-sm text-ink-muted">
                        {m.fromStaff ? p.team[locale] : p.you[locale]} · {stamp.format(m.createdAt)}
                      </p>
                      <p className="mt-2 whitespace-pre-line" dir="auto">
                        {m.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-8">
                <MessageForm locale={locale} projectId={project.id} />
              </div>
            </div>
          </div>

          <aside className="space-y-8 lg:col-span-4 lg:col-start-9">
            <div>
              <h2 className="font-display text-display-md">{p.detail[locale]}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-ink-muted">{p.category[locale]}</dt>
                  <dd>
                    {(p.categories as Record<string, { en: string; ar: string }>)[project.request.category]?.[
                      locale
                    ] ?? project.request.category}
                  </dd>
                </div>
                {project.clientLabel && (
                  <div>
                    <dt className="text-ink-muted">{p.clientLabel[locale]}</dt>
                    <dd dir="auto">{project.clientLabel}</dd>
                  </div>
                )}
                {project.request.area && (
                  <div>
                    <dt className="text-ink-muted">{p.area[locale]}</dt>
                    <dd dir="auto">{project.request.area}</dd>
                  </div>
                )}
                {walls.length > 0 && (
                  <div>
                    <dt className="text-ink-muted">
                      {p.measurements[locale]} ({project.request.unit})
                    </dt>
                    <dd>
                      <ul>
                        {walls.map((w, i) => (
                          <li key={i} dir="auto">
                            {w.label ? `${w.label}: ` : ""}
                            {measureText(w, locale, project.request.unit)}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
                {project.materials.length > 0 && (
                  <div>
                    <dt className="text-ink-muted">{p.chosenMaterials[locale]}</dt>
                    <dd>
                      <ul>
                        {project.materials.map(({ material }) => (
                          <li key={material.id} dir="auto">
                            {material.code} ·{" "}
                            {locale === "ar" && material.nameAr ? material.nameAr : material.nameEn}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
            <div>
              <h2 className="font-display text-display-md">{p.attachments[locale]}</h2>
              {project.files.length === 0 ? (
                <p className="mt-3 text-sm text-ink-muted">{p.noFiles[locale]}</p>
              ) : (
                <ul className="mt-4 divide-y divide-line text-sm">
                  {project.files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0 truncate" dir="auto">
                        {f.originalName}
                      </span>
                      <a
                        href={`/api/designer/files/${f.id}`}
                        className="shrink-0 underline underline-offset-4"
                      >
                        {p.download[locale]}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link
              href={localizedPath("/designers/portal", locale)}
              className="inline-block underline underline-offset-4"
            >
              {p.back[locale]}
            </Link>
          </aside>
        </div>
      </section>
    </>
  );
}
