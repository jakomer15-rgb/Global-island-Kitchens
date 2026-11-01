import { Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { telHref, type Phone as PhoneNumber } from "@/config/company";
import { pathFor } from "@/config/routes";
import { photos } from "@/content/photos";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { DesktopNav } from "./desktop-nav";
import { HeaderShell } from "./header-shell";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { mainNavItems, type NavLink } from "./nav-items";
import { Wordmark } from "./wordmark";

/** phone is the main number from the contact settings; productLinks are the product categories. */
export function SiteHeader({ phone, productLinks }: { phone: PhoneNumber; productLinks: NavLink[] }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const products = [
    ...productLinks,
    { href: pathFor("bespoke"), label: t("Nav.bespoke") },
    { href: pathFor("materials"), label: t("Nav.allMaterials") },
  ];
  const links = mainNavItems.map(([page, key]) => ({ href: pathFor(page), label: t(`Nav.${key}`) }));
  const feature = photos.walkInCloset;

  return (
    <HeaderShell>
      <div className="container-site flex h-18 items-center justify-between gap-3 sm:gap-6 lg:h-20">
        <Link href="/" aria-label={t("Common.homeLink")} className="shrink-0 py-2">
          <Wordmark tone="inherit" />
        </Link>

        <DesktopNav
          label={t("Common.mainNav")}
          productsLabel={t("Nav.products")}
          products={products}
          links={links}
          feature={{
            src: feature.src,
            alt: feature.alt[locale],
            width: feature.width,
            height: feature.height,
          }}
        />

        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href={telHref(phone)}
            className="hidden min-h-11 items-center gap-2 px-2 text-sm opacity-85 transition-opacity hover:opacity-100 xl:inline-flex"
            aria-label={t("Common.callNumber", { number: phone.display })}
          >
            <Phone aria-hidden className="size-4" strokeWidth={1.5} />
            <span dir="ltr">{phone.display}</span>
          </a>
          <LanguageSwitcher />
          <Link
            href={pathFor("requestQuote")}
            className="hidden min-h-11 items-center nav-cta px-5 text-xs font-medium tracking-[0.09em] uppercase sm:inline-flex rtl:tracking-normal rtl:normal-case"
          >
            {t("Nav.quote")}
          </Link>
          <MobileNav
            products={products}
            links={[...links, { href: pathFor("faq"), label: t("Nav.faq") }]}
            labels={{
              menu: t("Common.menu"),
              close: t("Common.closeMenu"),
              nav: t("Common.mainNav"),
              products: t("Nav.products"),
              quote: t("Nav.quote"),
            }}
            quoteHref={pathFor("requestQuote")}
            phone={{
              href: telHref(phone),
              label: t("Common.callNumber", { number: phone.display }),
              display: phone.display,
            }}
          />
        </div>
      </div>
    </HeaderShell>
  );
}
