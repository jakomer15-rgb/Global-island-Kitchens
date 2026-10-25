import { Mail, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { mailtoHref, telHref } from "@/config/company";
import type { Locale } from "@/i18n/routing";
import type { ContactSettings } from "@/lib/site-settings";

/** Email (with an optional pre-filled request) and call buttons, using the company's real details. */
export async function ContactActions({
  locale,
  contact,
  subject,
  body,
  emailLabel,
}: {
  locale: Locale;
  contact: ContactSettings;
  subject?: string;
  body?: string;
  emailLabel?: string;
}) {
  const t = await getTranslations({ locale, namespace: "Page" });
  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild size="lg">
        <a href={mailtoHref(contact.email, subject, body)}>
          <Mail aria-hidden /> {emailLabel ?? t("emailUs")}
        </a>
      </Button>
      {contact.phones.map((p) => (
        <Button key={p.e164} asChild size="lg" variant="outline">
          <a href={telHref(p)}>
            <Phone aria-hidden /> {t("callUs")} <span dir="ltr">{p.display}</span>
          </a>
        </Button>
      ))}
    </div>
  );
}
