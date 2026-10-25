import { Mail, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { company, mailtoHref, telHref } from "@/config/company";
import type { Locale } from "@/i18n/routing";

/** Email (with an optional pre-filled request) and call buttons, using the company's real details. */
export async function ContactActions({
  locale,
  subject,
  body,
  emailLabel,
}: {
  locale: Locale;
  subject?: string;
  body?: string;
  emailLabel?: string;
}) {
  const t = await getTranslations({ locale, namespace: "Page" });
  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild size="lg">
        <a href={mailtoHref(subject, body)}>
          <Mail aria-hidden /> {emailLabel ?? t("emailUs")}
        </a>
      </Button>
      {company.phones.map((p) => (
        <Button key={p.e164} asChild size="lg" variant="outline">
          <a href={telHref(p)}>
            <Phone aria-hidden /> {t("callUs")} <span dir="ltr">{p.display}</span>
          </a>
        </Button>
      ))}
    </div>
  );
}
