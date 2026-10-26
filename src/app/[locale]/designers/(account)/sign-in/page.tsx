import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SignInForm } from "@/components/designers/account-forms";
import { PageHero } from "@/components/site/page-hero";
import { pathFor } from "@/config/routes";
import { portal } from "@/content/portal";
import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/lib/seo";
import { getDesigner } from "@/server/designers/session";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/designers/sign-in">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return { title: portal.signIn.metaTitle[locale] };
}

export default async function DesignerSignInPage({ params }: PageProps<"/[locale]/designers/sign-in">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  if (await getDesigner()) redirect(localizedPath("/designers/portal", locale));
  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[
          { label: portal.eyebrow[locale], path: pathFor("designers") },
          { label: portal.signIn.title[locale], path: "/designers/sign-in" },
        ]}
        eyebrow={portal.eyebrow[locale]}
        title={portal.signIn.title[locale]}
      />
      <section className="py-16 md:py-20">
        <div className="container-site max-w-xl">
          <SignInForm locale={locale} />
        </div>
      </section>
    </>
  );
}
