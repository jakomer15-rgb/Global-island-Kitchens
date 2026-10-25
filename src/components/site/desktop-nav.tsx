"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { NavLink } from "./nav-items";

const linkClass =
  "relative inline-flex min-h-11 items-center py-2 text-sm text-charcoal/80 transition-colors hover:text-charcoal aria-[current=page]:text-charcoal";

/**
 * Desktop navigation. The products menu is a disclosure (button + aria-expanded + list of links,
 * the WAI pattern for site navigation): Escape and clicking outside close it, and focus returns
 * to the button on Escape. No menu library, to keep JavaScript small on every page.
 */
export function DesktopNav({
  label,
  productsLabel,
  products,
  links,
}: {
  label: string;
  productsLabel: string;
  products: NavLink[];
  links: NavLink[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const inProducts = products.some((p) => pathname === p.href);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <nav aria-label={label} className="hidden lg:block">
      <ul className="flex items-center gap-7">
        <li
          ref={rootRef}
          className="relative"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
          }}
        >
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className={cn(linkClass, "gap-1.5", inProducts && "text-charcoal")}
          >
            {productsLabel}
            <ChevronDown
              aria-hidden
              className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
            />
          </button>
          <div id={panelId} hidden={!open} className="absolute start-0 top-full w-[34rem] pt-3">
            <ul className="grid grid-cols-2 gap-x-6 border border-line bg-ivory p-6 shadow-[0_24px_48px_-24px_rgb(35_32_29/0.35)]">
              {products.map((p) => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    aria-current={pathname === p.href ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className="block border-b border-line py-3 font-display text-xl transition-colors hover:text-walnut aria-[current=page]:text-walnut"
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </li>
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={pathname === l.href || pathname.startsWith(`${l.href}/`) ? "page" : undefined}
              className={linkClass}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
