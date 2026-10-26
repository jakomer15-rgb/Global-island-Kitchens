import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { SignOutButton } from "@/components/designers/account-forms";
import { PageHero } from "@/components/site/page-hero";
import { Button } from "@/components/ui/button";
import { pathFor } from "@/config/routes";
import { portal } from "@/content/portal";
import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/lib/seo";
import { db } from "@/server/db";
import { listMyProjects } from "@/server/designers/designers";
import { requireDesigner } from "@/server/designers/session";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/designers/portal">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return { title: portal.home.metaTitle[locale] };
}

export default async function DesignerPortalPage({ params }: PageProps<"/[locale]/designers/portal">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const designer = await requireDesigner(localizedPath("/designers/sign-in", locale));
  const crumbs = [
    { label: portal.eyebrow[locale], path: pathFor("designers") },
    { label: portal.home.metaTitle[locale], path: "/designers/portal" },
  ];

  if (designer.status !== "approved") {
    const account = await db.designerAccount.findUniqueOrThrow({
      where: { id: designer.designerId },
      select: { statusNote: true },
    });
    const state = portal.state[designer.status];
    return (
      <>
        <PageHero
          locale={locale}
          crumbs={crumbs}
          eyebrow={portal.eyebrow[locale]}
          title={state.title[locale]}
          intro={state.body[locale]}
        />
        <section className="py-12">
          <div className="container-site max-w-2xl space-y-6">
            {account.statusNote && designer.status !== "pending" && (
              <p className="border-s-2 border-walnut bg-sand px-4 py-3 text-sm">
                <span className="font-medium">{portal.state.reason[locale]}: </span>
                {account.statusNote}
              </p>
            )}
            <SignOutButton locale={locale} />
          </div>
        </section>
      </>
    );
  }

  const projects = await listMyProjects(db, designer);
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-BH" : "en-GB", {
    dateStyle: "medium",
    timeZone: "Asia/Bahrain",
  });
  return (
    <>
      <PageHero
        locale={locale}
        crumbs={crumbs}
        eyebrow={`${portal.home.hello[locale]}, ${designer.name}`}
        title={portal.home.title[locale]}
      />
      <section className="py-12 md:py-16">
        <div className="container-site space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Button asChild size="lg">
              <Link href={localizedPath("/designers/portal/projects/new", locale)}>
                {portal.home.newProject[locale]}
              </Link>
            </Button>
            <SignOutButton locale={locale} />
          </div>
          {projects.length === 0 ? (
            <p className="text-ink-muted">{portal.home.none[locale]}</p>
          ) : (
            <table className="w-full text-start">
              <caption className="sr-only">{portal.home.projects[locale]}</caption>
              <thead>
                <tr className="border-b border-line text-sm text-ink-muted">
                  <th scope="col" className="py-3 pe-4 text-start font-medium">
                    {portal.project.title[locale]}
                  </th>
                  <th scope="col" className="py-3 pe-4 text-start font-medium">
                    {portal.home.reference[locale]}
                  </th>
                  <th scope="col" className="py-3 pe-4 text-start font-medium">
                    {portal.home.sent[locale]}
                  </th>
                  <th scope="col" className="py-3 text-start font-medium">
                    {portal.home.status[locale]}
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-line align-top">
                    <td className="py-4 pe-4">
                      <Link
                        href={localizedPath(`/designers/portal/projects/${p.id}`, locale)}
                        className="font-medium underline underline-offset-4"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="py-4 pe-4 font-mono text-sm whitespace-nowrap" dir="ltr">
                      {p.reference}
                    </td>
                    <td className="py-4 pe-4 whitespace-nowrap">{date.format(p.createdAt)}</td>
                    <td className="py-4">{portal.progress[p.progress][locale]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
