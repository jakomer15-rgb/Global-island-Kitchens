import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { fontVariables } from "@/app/fonts";
import { AnnouncementBanner } from "@/components/site/announcement-banner";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SkipLink } from "@/components/site/skip-link";
import { WhatsAppButton } from "@/components/site/whatsapp-button";
import { company } from "@/config/company";
import { siteUrl } from "@/config/site";
import { htmlLang, localeDirection, routing } from "@/i18n/routing";
import { getBlogPosts } from "@/server/content/public";
import { getSiteSettings } from "@/server/settings/site";
import "../globals.css";

function pick<T extends Record<string, unknown>>(obj: T, keys: (keyof T)[]) {
  return Object.fromEntries(keys.map((k) => [k, obj[k]])) as Partial<T>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  const { seo } = await getSiteSettings();
  const ar = locale === "ar";
  return {
    metadataBase: new URL(siteUrl),
    title: { default: (ar ? seo.titleAr : seo.titleEn) ?? t("title"), template: `%s | ${company.shortName}` },
    description: (ar ? seo.descriptionAr : seo.descriptionEn) ?? t("description"),
    applicationName: company.shortName,
    openGraph: {
      type: "website",
      siteName: company.shortName,
      locale: locale === "ar" ? "ar_BH" : "en_BH",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#faf7f2",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [{ contact, locations, banner }, posts] = await Promise.all([getSiteSettings(), getBlogPosts()]);
  const bannerText = banner.enabled ? (locale === "ar" ? banner.textAr : banner.textEn) : null;

  return (
    <html lang={htmlLang[locale]} dir={localeDirection[locale]} className={fontVariables}>
      <body className="flex min-h-svh flex-col">
        {/* Client components only need the Common strings; everything else renders on the server. */}
        <NextIntlClientProvider messages={pick(await getMessages(), ["Common"])}>
          <SkipLink />
          <AnnouncementBanner text={bannerText} />
          <SiteHeader phone={contact.phones[0]} />
          <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
          <SiteFooter contact={contact} locations={locations} showBlog={posts.length > 0} />
          <WhatsAppButton number={contact.whatsappNumber} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
