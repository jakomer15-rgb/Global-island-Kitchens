import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ProjectForm } from "@/components/designers/project-form";
import { FormMessages } from "@/components/forms/form-messages";
import { PageHero } from "@/components/site/page-hero";
import { pathFor } from "@/config/routes";
import { portal } from "@/content/portal";
import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/lib/seo";
import { db } from "@/server/db";
import { pickableMaterials } from "@/server/designers/designers";
import { requireApprovedDesigner } from "@/server/designers/session";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/designers/portal/projects/new">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return { title: portal.project.newTitle[locale] };
}

export default async function NewDesignerProjectPage({
  params,
}: PageProps<"/[locale]/designers/portal/projects/new">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  await requireApprovedDesigner(
    localizedPath("/designers/sign-in", locale),
    localizedPath("/designers/portal", locale),
  );
  const rows = await pickableMaterials(db);
  const materials = rows.map((m) => ({
    id: m.id,
    label: `${m.code} · ${locale === "ar" && m.nameAr ? m.nameAr : m.nameEn}`,
  }));
  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[
          { label: portal.eyebrow[locale], path: pathFor("designers") },
          { label: portal.home.metaTitle[locale], path: "/designers/portal" },
          { label: portal.project.newTitle[locale], path: "/designers/portal/projects/new" },
        ]}
        eyebrow={portal.eyebrow[locale]}
        title={portal.project.newTitle[locale]}
        intro={portal.project.newIntro[locale]}
      />
      <section className="py-12 md:py-16">
        <div className="container-site max-w-3xl">
          <FormMessages>
            <ProjectForm locale={locale} materials={materials} />
          </FormMessages>
        </div>
      </section>
    </>
  );
}
