"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { NavLink } from "./nav-items";

// The underline draws in from the start edge on hover and stays under the current page.
const linkClass =
  "relative inline-flex min-h-11 items-center py-2 text-sm tracking-wide whitespace-nowrap text-charcoal/80 transition-colors hover:text-charcoal aria-[current=page]:text-charcoal after:absolute after:inset-x-0 after:bottom-2 after:h-px after:origin-left after:scale-x-0 after:bg-walnut after:transition-transform after:duration-500 after:ease-out-soft hover:after:scale-x-100 aria-[current=page]:after:scale-x-100 rtl:after:origin-right";

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
  feature,
}: {
  label: string;
  productsLabel: string;
  products: NavLink[];
  links: NavLink[];
  /** A photograph shown beside the products menu. */
  feature?: { src: string; alt: string; width: number; height: number };
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
      <ul className="flex items-center gap-6 xl:gap-8">
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
          <div id={panelId} hidden={!open} className="absolute -start-6 top-full w-[48rem] pt-4">
            <div className="grid grid-cols-[1fr_15rem] gap-8 border border-line bg-ivory p-8 shadow-[0_40px_80px_-40px_rgb(26_23_20/0.45)]">
              <ul className="grid grid-cols-2 content-start gap-x-8">
                {products.map((p) => (
                  <li key={p.href}>
                    <Link
                      href={p.href}
                      aria-current={pathname === p.href ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className="block border-b border-line py-3 font-display text-xl transition-[color,padding] duration-300 hover:ps-2 hover:text-walnut aria-[current=page]:text-walnut"
                    >
                      {p.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {/* Mounted only while open, so closed menus never hold an unloaded lazy image. */}
              {feature && open && (
                // eslint-disable-next-line @next/next/no-img-element -- static file, already optimised
                <img
                  src={feature.src}
                  alt={feature.alt}
                  width={feature.width}
                  height={feature.height}
                  loading="lazy"
                  decoding="async"
                  className="h-full min-h-56 w-full bg-sand object-cover"
                />
              )}
            </div>
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
