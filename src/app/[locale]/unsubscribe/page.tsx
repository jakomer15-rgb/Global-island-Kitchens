import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PAlert } from "@/components/designers/ui";
import { UnsubscribeForm } from "@/components/assistant/unsubscribe-form";
import { unsubscribePage as c } from "@/content/assistant";
import type { Locale } from "@/i18n/routing";
import { readUnsubscribeToken } from "@/server/consent";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

export default async function UnsubscribePage({ params, searchParams }: PageProps<"/[locale]/unsubscribe">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw.slice(0, 300) : "";
  const parsed = token ? readUnsubscribeToken(token) : null;
  return (
    <section className="py-20 md:py-28">
      <div className="container-site max-w-xl">
        <h1 className="font-display text-display-lg">{c.title[locale]}</h1>
        <div className="mt-8">
          {parsed ? (
            <UnsubscribeForm token={token} channel={parsed.channel} locale={locale} />
          ) : (
            <PAlert tone="error">{c.invalid[locale]}</PAlert>
          )}
        </div>
      </div>
    </section>
  );
}
