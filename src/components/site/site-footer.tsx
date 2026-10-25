import { useLocale, useTranslations } from "next-intl";
import { company, telHref } from "@/config/company";
import { Address } from "./address";
import { Wordmark } from "./wordmark";

export function SiteFooter() {
  const t = useTranslations();
  const ar = useLocale() === "ar";
  const year = new Date().getFullYear();

  return (
    <footer className="bg-charcoal text-ivory/80">
      <div className="container-site grid gap-12 py-16 md:grid-cols-12 md:py-20">
        <div className="md:col-span-4">
          <Wordmark tone="light" />
          <p className="mt-6 max-w-xs text-sm leading-relaxed">{t("Footer.tagline")}</p>
        </div>

        <div className="md:col-span-3">
          <h2 className="eyebrow text-walnut-soft">{t("Footer.contact")}</h2>
          <ul className="mt-5 space-y-2 text-sm">
            {company.phones.map((phone) => (
              <li key={phone.e164}>
                <a href={telHref(phone)} className="hover:text-ivory" dir="ltr">
                  {phone.display}
                </a>
              </li>
            ))}
            <li>
              <a href={`mailto:${company.email}`} className="break-all hover:text-ivory">
                {company.email}
              </a>
            </li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <h2 className="eyebrow text-walnut-soft">{t("Footer.visit")}</h2>
          <div className="mt-5 space-y-5 text-sm">
            <div>
              <p className="text-ivory">{t("Showroom.showroom")}</p>
              <Address lines={ar ? company.showroom.linesAr : company.showroom.lines} />
            </div>
            <div>
              <p className="text-ivory">{t("Showroom.headOffice")}</p>
              <Address lines={ar ? company.headOffice.linesAr : company.headOffice.lines} />
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <h2 className="eyebrow text-walnut-soft">{t("Footer.follow")}</h2>
          <a
            href={company.instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block text-sm hover:text-ivory"
          >
            {t("Common.instagram")} <span dir="ltr">@{company.instagram.handle}</span>
          </a>
        </div>
      </div>

      <div className="border-t border-ivory/10">
        <div className="container-site flex flex-col gap-2 py-6 text-xs text-ivory/60 md:flex-row md:justify-between">
          <p>{t("Footer.rights", { year })}</p>
          <p>{t("Footer.materialsNote")}</p>
        </div>
      </div>
    </footer>
  );
}
