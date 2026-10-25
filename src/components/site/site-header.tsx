import { Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { company, telHref } from "@/config/company";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { navItems } from "./nav-items";
import { Wordmark } from "./wordmark";

export function SiteHeader() {
  const t = useTranslations();
  const phone = company.phones[0];
  const items = navItems.map((item) => ({ ...item, label: t(`Nav.${item.key}`) }));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ivory/90 backdrop-blur-md supports-[backdrop-filter]:bg-ivory/80">
      <div className="container-site flex h-18 items-center justify-between gap-6">
        <Link href="/" aria-label={t("Common.homeLink")} className="shrink-0 py-2">
          <Wordmark />
        </Link>

        <nav aria-label={t("Common.mainNav")} className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  href={{ pathname: "/", hash: item.hash }}
                  prefetch={false}
                  className="relative py-2 text-sm text-charcoal/80 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-walnut after:transition-transform after:duration-300 hover:text-charcoal hover:after:scale-x-100 rtl:after:origin-right"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1 sm:gap-3">
          <a
            href={telHref(phone)}
            className="hidden min-h-11 items-center gap-2 px-3 text-sm text-charcoal/80 transition-colors hover:text-charcoal sm:inline-flex"
            aria-label={t("Common.callNumber", { number: phone.display })}
          >
            <Phone aria-hidden className="size-4 text-walnut" strokeWidth={1.5} />
            <span dir="ltr">{phone.display}</span>
          </a>
          <LanguageSwitcher />
          <MobileNav
            items={items}
            labels={{ menu: t("Common.menu"), close: t("Common.closeMenu"), nav: t("Common.mainNav") }}
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
