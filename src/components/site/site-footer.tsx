import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { instagramUrl, telHref } from "@/config/company";
import type { ContactSettings, LocationSettings } from "@/lib/site-settings";
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
const blogLink: [PageKey, string] = ["blog", "blog"];

/** `showBlog`: link the blog once a post is published. */
export function SiteFooter({
  contact,
  locations,
  showBlog = false,
}: {
  contact: ContactSettings;
  locations: LocationSettings;
  showBlog?: boolean;
}) {
  const t = useTranslations();
  const ar = useLocale() === "ar";
  const year = new Date().getFullYear();
  const heading = "eyebrow text-walnut-soft";
  const link = "link-draw pb-0.5 transition-colors hover:text-ivory";

  return (
    <footer className="bg-espresso text-ivory/80">
      <div className="container-site flex flex-col gap-10 border-b border-ivory/10 py-16 md:py-20 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Wordmark tone="light" size="lg" />
          <p className="mt-6 max-w-md text-sm leading-relaxed">{t("Footer.tagline")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="light" size="lg">
            <Link href={pathFor("requestQuote")}>
              {t("Nav.quote")} <ArrowRight aria-hidden className="rtl:rotate-180" />
            </Link>
          </Button>
          <Button asChild variant="outlineLight" size="lg">
            <Link href={pathFor("bookConsultation")}>{t("Nav.consultation")}</Link>
          </Button>
        </div>
      </div>

      <div className="container-site grid gap-12 py-16 sm:grid-cols-2 md:py-20 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <h2 className={heading}>{t("Showroom.showroom")}</h2>
          <div className="mt-5 text-sm">
            <Address lines={ar ? locations.showroomAr : locations.showroomEn} />
          </div>
          <h2 className={`${heading} mt-8`}>{t("Showroom.headOffice")}</h2>
          <div className="mt-5 text-sm">
            <Address lines={ar ? locations.headOfficeAr : locations.headOfficeEn} />
          </div>
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
            {(showBlog ? [...companyLinks, blogLink] : companyLinks).map(([page, key]) => (
              <li key={page}>
                <Link href={pathFor(page)} className={link}>
                  {t(`Nav.${key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-3 lg:col-start-10">
          <h2 className={heading}>{t("Footer.contact")}</h2>
          <ul className="mt-5 space-y-3 text-sm">
            {contact.phones.map((phone) => (
              <li key={phone.e164}>
                <a href={telHref(phone)} className={`${link} font-display text-xl text-ivory`} dir="ltr">
                  {phone.display}
                </a>
              </li>
            ))}
            <li>
              <a href={`mailto:${contact.email}`} className={`${link} break-all`}>
                {contact.email}
              </a>
            </li>
            <li>
              <a
                href={instagramUrl(contact.instagramHandle)}
                target="_blank"
                rel="noopener noreferrer"
                className={link}
              >
                {t("Common.instagram")} <span dir="ltr">@{contact.instagramHandle}</span>
              </a>
            </li>
          </ul>
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
