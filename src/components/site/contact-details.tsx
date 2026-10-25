import { AtSign, Clock, Mail, MapPin, Phone, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { instagramUrl, telHref } from "@/config/company";
import type { Locale } from "@/i18n/routing";
import type { ContactSettings, LocationSettings } from "@/lib/site-settings";
import { Address } from "./address";

/** One dt/dd pair; the icon sits inside the dt so the list stays valid (dl > div > dt + dd). */
function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="border-t border-line py-6">
      <dt className="flex items-center gap-3 text-sm text-ink-muted">
        <Icon aria-hidden className="size-4 shrink-0 text-walnut" strokeWidth={1.5} />
        {label}
      </dt>
      <dd className="mt-2 ps-7">{children}</dd>
    </div>
  );
}

/** The company's verified contact details: phones, email, Instagram, showroom (with hours) and head office. */
export async function ContactDetails({
  locale,
  contact,
  locations,
  showHeadOffice = true,
}: {
  locale: Locale;
  contact: ContactSettings;
  locations: LocationSettings;
  showHeadOffice?: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "Page" });
  const ar = locale === "ar";

  return (
    <dl>
      <Row icon={Phone} label={t("phone")}>
        <span className="flex flex-wrap gap-x-5">
          {contact.phones.map((p) => (
            <a key={p.e164} href={telHref(p)} dir="ltr" className="text-lg hover:text-walnut">
              {p.display}
            </a>
          ))}
        </span>
      </Row>
      <Row icon={Mail} label={t("email")}>
        <a href={`mailto:${contact.email}`} className="text-lg break-all hover:text-walnut">
          {contact.email}
        </a>
      </Row>
      <Row icon={AtSign} label={t("instagram")}>
        <a
          href={instagramUrl(contact.instagramHandle)}
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          className="text-lg hover:text-walnut"
        >
          @{contact.instagramHandle}
        </a>
      </Row>
      <Row icon={MapPin} label={t("showroom")}>
        <Address lines={ar ? locations.showroomAr : locations.showroomEn} />
      </Row>
      <Row icon={Clock} label={t("hours")}>
        {ar ? locations.hoursAr : locations.hoursEn}
      </Row>
      {showHeadOffice && (
        <Row icon={MapPin} label={t("headOffice")}>
          <Address lines={ar ? locations.headOfficeAr : locations.headOfficeEn} />
        </Row>
      )}
    </dl>
  );
}
