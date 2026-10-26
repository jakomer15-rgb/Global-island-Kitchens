import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { RegisterForm } from "@/components/designers/account-forms";
import { PageHero } from "@/components/site/page-hero";
import { pathFor } from "@/config/routes";
import { portal } from "@/content/portal";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/designers/register">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return { title: portal.register.metaTitle[locale] };
}

export default async function DesignerRegisterPage({ params }: PageProps<"/[locale]/designers/register">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[
          { label: portal.eyebrow[locale], path: pathFor("designers") },
          { label: portal.register.title[locale], path: "/designers/register" },
        ]}
        eyebrow={portal.eyebrow[locale]}
        title={portal.register.title[locale]}
        intro={portal.register.intro[locale]}
      />
      <section className="py-16 md:py-20">
        <div className="container-site max-w-2xl">
          <RegisterForm locale={locale} />
        </div>
      </section>
    </>
  );
}
