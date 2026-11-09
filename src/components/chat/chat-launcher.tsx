"use client";

import { MessageCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { chatCopy as c } from "@/content/chat";
import { cn } from "@/lib/cn";
import type { ChatContact } from "./chat-panel";

const loadPanel = () => import("./chat-panel");

/**
 * The chat window's code is downloaded only when a visitor first opens it (or points at the button),
 * so the floating button costs every page almost nothing. Once loaded it stays mounted, so the
 * conversation survives closing the window and moving between pages.
 */
const ChatPanel = dynamic(() => loadPanel().then((m) => m.ChatPanel), {
  ssr: false,
  loading: () => null,
});

export function ChatLauncher({
  locale,
  contact,
  hours,
  stacked,
  welcome,
  uploads,
}: {
  locale: "en" | "ar";
  contact: ChatContact;
  hours: string;
  /** The WhatsApp button is shown too: sit above it. */
  stacked: boolean;
  /** The owner's own welcome text from Admin → AI agent; null keeps the built-in one. */
  welcome: string | null;
  /** File storage is set up: the contact form offers photo uploads. */
  uploads: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  return (
    <>
      {!open && (
        <button
          ref={button}
          type="button"
          aria-label={c.open[locale]}
          aria-haspopup="dialog"
          aria-expanded={false}
          onPointerEnter={() => void loadPanel()}
          onFocus={() => void loadPanel()}
          onClick={() => {
            setMounted(true);
            setOpen(true);
          }}
          className={cn(
            "fixed end-5 z-30 inline-flex size-14 items-center justify-center rounded-full bg-espresso text-ivory shadow-lg ring-1 shadow-charcoal/25 ring-oak/60 transition-transform duration-300 hover:scale-105 motion-reduce:transition-none",
            stacked ? "bottom-23" : "bottom-5",
          )}
        >
          <MessageCircle aria-hidden className="size-6" strokeWidth={1.5} />
        </button>
      )}
      {mounted && (
        <ChatPanel
          locale={locale}
          contact={contact}
          hours={hours}
          welcome={welcome}
          uploads={uploads}
          open={open}
          onClose={() => {
            setOpen(false);
            // The button is rendered again on the next frame; give it focus back.
            requestAnimationFrame(() => button.current?.focus());
          }}
        />
      )}
    </>
  );
}
