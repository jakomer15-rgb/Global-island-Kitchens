"use client";

import { Menu, Phone, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import type { NavLink } from "./nav-items";

interface Props {
  products: NavLink[];
  links: NavLink[];
  labels: { menu: string; close: string; nav: string; products: string; quote: string };
  quoteHref: string;
  phone: { href: string; label: string; display: string };
}

/**
 * Full-screen menu for small screens, on the native <dialog> element: showModal() gives the focus
 * trap, inert background and Escape to close, with no dialog library.
 */
export function MobileNav({ products, links, labels, quoteHref, phone }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const close = () => ref.current?.close();

  // Close after navigating, and unlock page scrolling whenever the dialog closes.
  useEffect(() => close(), [pathname]);
  useEffect(() => {
    const dialog = ref.current;
    const unlock = () => document.documentElement.style.removeProperty("overflow");
    dialog?.addEventListener("close", unlock);
    return () => dialog?.removeEventListener("close", unlock);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label={labels.menu}
        aria-haspopup="dialog"
        onClick={() => {
          document.documentElement.style.overflow = "hidden";
          ref.current?.showModal();
        }}
        className="inline-flex size-11 items-center justify-center lg:hidden"
      >
        <Menu aria-hidden className="size-5" strokeWidth={1.5} />
      </button>
      <dialog
        ref={ref}
        aria-label={labels.nav}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-espresso p-0 text-ivory backdrop:bg-espresso open:flex open:flex-col"
      >
        <div className="container-site flex h-18 shrink-0 items-center justify-end">
          <button
            type="button"
            onClick={close}
            aria-label={labels.close}
            className="inline-flex min-h-11 items-center gap-2 text-xs font-medium tracking-[0.1em] uppercase rtl:tracking-normal"
          >
            {labels.close}
            <X aria-hidden className="size-5" strokeWidth={1.5} />
          </button>
        </div>
        <nav aria-label={labels.nav} className="container-site flex-1 overflow-y-auto py-6">
          <ul>
            {links.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={close} className="block py-3 font-display text-3xl">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 eyebrow text-walnut-soft">{labels.products}</p>
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8">
            {products.map((item) => (
              <li key={item.href} className="border-b border-ivory/15">
                <Link
                  href={item.href}
                  onClick={close}
                  className="block py-3 font-display text-xl text-ivory/90"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="container-site flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-ivory/15 py-5">
          <a
            href={phone.href}
            aria-label={phone.label}
            className="inline-flex min-h-11 items-center gap-3 text-lg"
          >
            <Phone aria-hidden className="size-5 text-walnut-soft" strokeWidth={1.5} />
            <span dir="ltr">{phone.display}</span>
          </a>
          <Link
            href={quoteHref}
            onClick={close}
            className="inline-flex min-h-11 items-center bg-ivory px-6 text-xs font-medium tracking-[0.09em] text-espresso uppercase rtl:tracking-normal rtl:normal-case"
          >
            {labels.quote}
          </Link>
        </div>
      </dialog>
    </>
  );
}
