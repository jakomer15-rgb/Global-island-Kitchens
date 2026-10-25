import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/pages/legal-page";
import { pathFor } from "@/config/routes";
import { privacy } from "@/content/legal";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy-policy">): Promise<Metadata> {
  return legalMetadata(privacy, pathFor("privacy"), (await params).locale as Locale);
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy-policy">) {
  return <LegalPage doc={privacy} path={pathFor("privacy")} locale={(await params).locale as Locale} />;
}
