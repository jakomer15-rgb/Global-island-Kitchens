"use client";

import { Bell, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Wordmark } from "@/components/site/wordmark";

export interface NavGroup {
  label: string;
  items: { href: string; label: string }[];
}

/** Admin layout: sidebar (drawer on small screens), top bar with notifications and sign-out. */
export function AdminShell({
  nav,
  userName,
  unread,
  signOut,
  children,
}: {
  nav: NavGroup[];
  userName: string;
  unread: number;
  signOut: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const sidebar = (
    <nav
      aria-label="Admin"
      className="flex flex-col gap-6 p-5"
      onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
    >
      {nav.map((group) => (
        <div key={group.label}>
          <p className="eyebrow text-walnut">{group.label}</p>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active(item.href) ? "page" : undefined}
                  className="block px-3 py-2 text-sm transition-colors hover:bg-sand aria-[current=page]:bg-charcoal aria-[current=page]:text-ivory"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-svh bg-ivory lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-e border-line bg-white lg:block">
        <div className="border-b border-line px-5 py-4">
          <Link href="/admin" aria-label="Admin home">
            <Wordmark />
          </Link>
        </div>
        {sidebar}
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white/95 px-5 py-3 backdrop-blur">
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center lg:hidden"
            aria-label="Open admin menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu aria-hidden className="size-5" />
          </button>
          <span className="text-sm text-ink-muted">
            Signed in as <span className="text-charcoal">{userName}</span>
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/notifications"
              className="relative inline-flex size-10 items-center justify-center hover:bg-sand"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell aria-hidden className="size-5" />
              {unread > 0 && (
                <span className="absolute end-1 top-1 min-w-4 rounded-full bg-walnut px-1 text-center text-[0.625rem] leading-4 text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            {signOut}
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button
            type="button"
            className="absolute inset-0 bg-charcoal/40"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 w-72 overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <Wordmark />
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}
