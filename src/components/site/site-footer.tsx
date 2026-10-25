import { useLocale, useTranslations } from "next-intl";
import { company, telHref } from "@/config/company";
import { pathFor, type PageKey } from "@/config/routes";
import { Link } from "@/i18n/navigation";
import { Address } from "./address";
import { productNavKeys } from "./nav-items";
import { Wordmark } from "./wordmark";

const companyLinks: [PageKey, string][] = [
  ["about", "about"],
  ["projects", "projects"],
  ["materials", "allMaterials"],
  ["designers", "designers"],
  ["showroom", "showroom"],
  ["faq", "faq"],
  ["contact", "contact"],
];

export function SiteFooter() {
  const t = useTranslations();
  const ar = useLocale() === "ar";
  const year = new Date().getFullYear();
  const heading = "eyebrow text-walnut-soft";
  const link = "transition-colors hover:text-ivory";

  return (
    <footer className="bg-charcoal text-ivory/80">
      <div className="container-site grid gap-12 py-16 sm:grid-cols-2 md:py-20 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <Wordmark tone="light" />
          <p className="mt-6 max-w-xs text-sm leading-relaxed">{t("Footer.tagline")}</p>
        </div>

        <nav aria-labelledby="footer-products" className="lg:col-span-3">
          <h2 id="footer-products" className={heading}>
            {t("Nav.products")}
          </h2>
          <ul className="mt-5 space-y-2 text-sm">
            {productNavKeys.map((key) => (
              <li key={key}>
                <Link href={pathFor(key)} className={link}>
                  {t(`Products.items.${key}.name`)}
                </Link>
              </li>
            ))}
            <li>
              <Link href={pathFor("bespoke")} className={link}>
                {t("Nav.bespoke")}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-company" className="lg:col-span-2">
          <h2 id="footer-company" className={heading}>
            {t("Nav.company")}
          </h2>
          <ul className="mt-5 space-y-2 text-sm">
            {companyLinks.map(([page, key]) => (
              <li key={page}>
                <Link href={pathFor(page)} className={link}>
                  {t(`Nav.${key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-4">
          <h2 className={heading}>{t("Footer.contact")}</h2>
          <ul className="mt-5 space-y-2 text-sm">
            {company.phones.map((phone) => (
              <li key={phone.e164}>
                <a href={telHref(phone)} className={link} dir="ltr">
                  {phone.display}
                </a>
              </li>
            ))}
            <li>
              <a href={`mailto:${company.email}`} className={`${link} break-all`}>
                {company.email}
              </a>
            </li>
            <li>
              <a href={company.instagram.url} target="_blank" rel="noopener noreferrer" className={link}>
                {t("Common.instagram")} <span dir="ltr">@{company.instagram.handle}</span>
              </a>
            </li>
          </ul>
          <div className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
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
      </div>

      <div className="border-t border-ivory/10">
        <div className="container-site flex flex-col gap-3 py-6 text-xs text-ivory/60 md:flex-row md:items-center md:justify-between">
          <p>{t("Footer.rights", { year })}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link href={pathFor("privacy")} className={link}>
                {t("Nav.privacy")}
              </Link>
            </li>
            <li>
              <Link href={pathFor("terms")} className={link}>
                {t("Nav.terms")}
              </Link>
            </li>
          </ul>
          <p>{t("Footer.materialsNote")}</p>
        </div>
      </div>
    </footer>
  );
}
