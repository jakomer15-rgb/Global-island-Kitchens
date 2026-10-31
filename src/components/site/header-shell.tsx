"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * The sticky header. On the home page it starts transparent over the hero photograph with light
 * text, and turns solid ivory once the page scrolls; everywhere else it is solid from the start.
 * Children inherit the text colour, so only the shell switches state (`data-over-hero`).
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const isHome = usePathname() === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 60);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const overHero = isHome && !scrolled;

  return (
    <header
      data-over-hero={overHero}
      className={cn(
        "sticky top-0 z-40 transition-[background-color,box-shadow,color] duration-500",
        overHero
          ? "bg-transparent text-ivory"
          : "bg-ivory/92 text-charcoal shadow-[0_1px_0_var(--color-line)] backdrop-blur-md backdrop-saturate-150",
      )}
    >
      {children}
    </header>
  );
}
