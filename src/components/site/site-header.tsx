import { Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { company, telHref } from "@/config/company";
import { pathFor } from "@/config/routes";
import { Link } from "@/i18n/navigation";
import { DesktopNav } from "./desktop-nav";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { mainNavItems, productNavKeys } from "./nav-items";
import { Wordmark } from "./wordmark";

export function SiteHeader() {
  const t = useTranslations();
  const phone = company.phones[0];
  const products = [
    ...productNavKeys.map((key) => ({ href: pathFor(key), label: t(`Products.items.${key}.name`) })),
    { href: pathFor("bespoke"), label: t("Nav.bespoke") },
    { href: pathFor("materials"), label: t("Nav.allMaterials") },
  ];
  const links = mainNavItems.map(([page, key]) => ({ href: pathFor(page), label: t(`Nav.${key}`) }));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ivory/95 backdrop-blur-sm">
      <div className="container-site flex h-18 items-center justify-between gap-6">
        <Link href="/" aria-label={t("Common.homeLink")} className="shrink-0 py-2">
          <Wordmark />
        </Link>

        <DesktopNav
          label={t("Common.mainNav")}
          productsLabel={t("Nav.products")}
          products={products}
          links={links}
        />

        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href={telHref(phone)}
            className="hidden min-h-11 items-center gap-2 px-2 text-sm text-charcoal/80 transition-colors hover:text-charcoal xl:inline-flex"
            aria-label={t("Common.callNumber", { number: phone.display })}
          >
            <Phone aria-hidden className="size-4 text-walnut" strokeWidth={1.5} />
            <span dir="ltr">{phone.display}</span>
          </a>
          <LanguageSwitcher />
          <Button asChild className="hidden sm:inline-flex">
            <Link href={pathFor("requestQuote")}>{t("Nav.quote")}</Link>
          </Button>
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
    </header>
  );
}
