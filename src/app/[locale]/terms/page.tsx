import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/pages/legal-page";
import { pathFor } from "@/config/routes";
import { terms } from "@/content/legal";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  return legalMetadata(terms, pathFor("terms"), (await params).locale as Locale);
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  return <LegalPage doc={terms} path={pathFor("terms")} locale={(await params).locale as Locale} />;
}
