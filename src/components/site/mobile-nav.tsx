"use client";

import { Menu, Phone, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Link } from "@/i18n/navigation";

interface Props {
  items: { key: string; hash: string; label: string }[];
  labels: { menu: string; close: string; nav: string };
  phone: { href: string; label: string; display: string };
}

/** Full-screen menu for small screens (Radix Dialog: focus trap, Escape to close, scroll lock). */
export function MobileNav({ items, labels, phone }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="inline-flex size-11 items-center justify-center text-charcoal lg:hidden"
        aria-label={labels.menu}
      >
        <Menu aria-hidden className="size-5" strokeWidth={1.5} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-charcoal/30" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col bg-ivory" aria-describedby={undefined}>
          <div className="container-site flex h-18 items-center justify-end border-b border-line">
            <Dialog.Title className="sr-only">{labels.nav}</Dialog.Title>
            <Dialog.Close
              className="inline-flex size-11 items-center justify-center"
              aria-label={labels.close}
            >
              <X aria-hidden className="size-5" strokeWidth={1.5} />
            </Dialog.Close>
          </div>
          <nav aria-label={labels.nav} className="container-site flex-1 overflow-y-auto py-10">
            <ul className="flex flex-col">
              {items.map((item) => (
                <li key={item.key} className="border-b border-line">
                  <Link
                    href={{ pathname: "/", hash: item.hash }}
                    prefetch={false}
                    onClick={() => setOpen(false)}
                    className="block py-5 font-display text-3xl"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="container-site border-t border-line py-6">
            <a
              href={phone.href}
              aria-label={phone.label}
              className="inline-flex min-h-11 items-center gap-3 text-lg"
            >
              <Phone aria-hidden className="size-5 text-walnut" strokeWidth={1.5} />
              <span dir="ltr">{phone.display}</span>
            </a>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
