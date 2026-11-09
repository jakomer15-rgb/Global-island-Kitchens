"use client";

import { CheckCircle2, Mail, MessageCircle, Phone, RotateCcw, SendHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { pages, pathFor } from "@/config/routes";
import { mailtoHref, whatsappHref } from "@/config/company";
import { chatCardText, chatCopy as c, quickReplies, type QuickReply } from "@/content/chat";
import { products, type ProductKey } from "@/content/products";
import {
  CHAT_MAX_HISTORY,
  CHAT_MAX_MESSAGE,
  chatErrorFrom,
  readChatStream,
  splitSitePaths,
  type ChatErrorCode,
  type ChatRequest,
  type ContactReason,
} from "@/lib/chat";
import { cn } from "@/lib/cn";
import { localizedPath } from "@/lib/seo";
import { ChatContactForm } from "./chat-contact-form";

export interface ChatContact {
  phones: { display: string; e164: string }[];
  email: string;
  whatsappNumber: string | null;
}

type Card =
  | { card: "product"; key: ProductKey }
  | { card: "quote" | "showroom" | "team" }
  /** The contact form; `status` keeps a sent or dismissed form from showing again. */
  | { card: "form"; reason: ContactReason; status: "open" | "sent" | "closed" }
  | { card: "sent"; reference: string | null };
type Item =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string }
  | ({ id: string; role: "card" } & Card)
  | { id: string; role: "error"; code: ChatErrorCode };

/** What this tab remembers: the window's items, the conversation token and how much the server has. */
interface Saved {
  items: Item[];
  session?: string;
  /** Number of messages (as sent to the server) the server has already saved. */
  synced: number;
}

type Locale = "en" | "ar";

const STORAGE_KEY = "gik-chat:v2";
const MAX_ITEMS = 60;
/** Below this width the window fills the screen. */
const SMALL_SCREEN = "(max-width: 639px)";
const empty: Saved = { items: [], synced: 0 };

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** The conversation is kept for this browser tab only (sessionStorage), never on the device for good. */
function load(): Saved {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const value = raw ? (JSON.parse(raw) as Partial<Saved>) : null;
    if (!value || !Array.isArray(value.items)) return empty;
    return {
      items: value.items.slice(-MAX_ITEMS),
      session: typeof value.session === "string" ? value.session : undefined,
      synced: typeof value.synced === "number" ? value.synced : 0,
    };
  } catch {
    return empty;
  }
}

function save(state: Saved) {
  try {
    if (state.items.length || state.session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or storage blocked: the chat still works, it just isn't kept on reload.
  }
}

/** Every message the window has shown, as text, in order (errors left out). */
function allMessages(items: Item[], locale: Locale): ChatRequest["messages"] {
  const out: ChatRequest["messages"] = [];
  for (const item of items) {
    if (item.role === "user") out.push({ role: "user", text: item.text });
    else if (item.role === "assistant") out.push({ role: "assistant", text: item.text });
    else if (item.role === "card") out.push({ role: "assistant", text: chatCardText(item, locale) });
  }
  return out;
}

/** What is sent: the recent conversation, starting with the visitor (as the AI provider requires). */
function recentMessages(all: ChatRequest["messages"]): ChatRequest["messages"] {
  const recent = all.slice(-CHAT_MAX_HISTORY);
  while (recent.length && recent[0]!.role !== "user") recent.shift();
  return recent;
}

export function ChatPanel({
  locale,
  contact,
  hours,
  welcome,
  uploads,
  open,
  onClose,
}: {
  locale: Locale;
  contact: ChatContact;
  hours: string;
  welcome: string | null;
  uploads: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const inputId = useId();
  const [state, setState] = useState<Saved>(load);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  // The latest state for callbacks that run after awaits.
  const latest = useRef(state);
  const { items } = state;

  useEffect(() => {
    latest.current = state;
    save(state);
  }, [state]);

  // Keep the newest message in view, including while a reply is being written.
  // Before the conversation starts, the welcome stays in view from its first line.
  // A newly opened contact form is shown from its title.
  useEffect(() => {
    const el = log.current;
    if (!el) return;
    const last = items.at(-1);
    const form =
      last?.role === "card" && last.card === "form" && last.status === "open"
        ? el.querySelector<HTMLElement>(`[data-chat-item="${last.id}"]`)
        : null;
    if (form) el.scrollTop = form.offsetTop - el.offsetTop - 16;
    else el.scrollTop = items.length || pending ? el.scrollHeight : 0;
  }, [items, pending, open]);

  // Focus the message box when the window opens; lock page scrolling while it fills a small screen.
  useEffect(() => {
    if (!open) return;
    input.current?.focus({ preventScroll: true });
    const small = window.matchMedia(SMALL_SCREEN).matches;
    if (small) document.documentElement.style.overflow = "hidden";
    return () => {
      if (small) document.documentElement.style.removeProperty("overflow");
    };
  }, [open]);

  const closeIfSmall = useCallback(() => {
    if (window.matchMedia(SMALL_SCREEN).matches) onClose();
  }, [onClose]);

  const update = (fn: (s: Saved) => Saved) => setState((s) => fn(s));
  const add = (...next: Item[]) => update((s) => ({ ...s, items: [...s.items, ...next].slice(-MAX_ITEMS) }));
  const markSynced = () => update((s) => ({ ...s, synced: allMessages(s.items, locale).length }));

  /** Opens the contact form (one open form at a time). */
  const showForm = (reason: ContactReason) =>
    update((s) => ({
      ...s,
      items: [
        ...s.items.map((i) =>
          i.role === "card" && i.card === "form" && i.status === "open"
            ? { ...i, status: "closed" as const }
            : i,
        ),
        { id: newId(), role: "card" as const, card: "form" as const, reason, status: "open" as const },
      ].slice(-MAX_ITEMS),
    }));
  const setFormStatus = (id: string, status: "sent" | "closed") =>
    update((s) => ({
      ...s,
      items: s.items.map((i) =>
        i.id === id && i.role === "card" && i.card === "form" ? { ...i, status } : i,
      ),
    }));

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    if (message.length > CHAT_MAX_MESSAGE) {
      add({ id: newId(), role: "error", code: "invalid" });
      return;
    }
    const userItem: Item = { id: newId(), role: "user", text: message };
    const now = latest.current;
    const all = allMessages([...now.items, userItem], locale);
    update((s) => ({ ...s, items: [...s.items, userItem].slice(-MAX_ITEMS) }));
    setDraft("");
    setPending(true);
    const body: ChatRequest = {
      locale,
      messages: recentMessages(all),
      session: now.session,
      fresh: Math.min(12, Math.max(1, all.length - now.synced)),
      website,
    };
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        add({ id: newId(), role: "error", code: chatErrorFrom(await res.json().catch(() => null)) });
        return;
      }
      const id = newId();
      let started = false;
      let form: ContactReason | null = null;
      const end = await readChatStream(res.body, (event) => {
        if (event.t === "session") update((s) => ({ ...s, session: event.v }));
        else if (event.t === "form") form = event.reason;
        else if (event.t === "text" && event.v) {
          if (!started) {
            started = true;
            setStreamingId(id);
            add({ id, role: "assistant", text: event.v });
          } else {
            update((s) => ({
              ...s,
              items: s.items.map((i) =>
                i.id === id && i.role === "assistant" ? { ...i, text: i.text + event.v } : i,
              ),
            }));
          }
        }
      });
      // The server has saved the visitor's turn and the reply.
      markSynced();
      if (form) showForm(form);
      if (end !== "done") add({ id: newId(), role: "error", code: end });
    } catch {
      add({ id: newId(), role: "error", code: "server" });
    } finally {
      setPending(false);
      setStreamingId(null);
    }
  }

  function choose(reply: QuickReply) {
    if (pending) return;
    const card: Card = reply.kind === "product" ? { card: "product", key: reply.key } : { card: reply.kind };
    add({ id: newId(), role: "user", text: reply.label[locale] }, { id: newId(), role: "card", ...card });
  }

  /** The conversation for the contact form to save with the visitor's details. */
  const formConversation = () => {
    const s = latest.current;
    const all = allMessages(s.items, locale);
    return {
      session: s.session,
      messages: recentMessages(all),
      fresh: Math.min(12, Math.max(0, all.length - s.synced)),
    };
  };

  const started = items.length > 0;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      hidden={!open}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className={cn(
        "fixed inset-0 z-40 flex-col bg-ivory text-charcoal",
        open ? "flex" : "hidden",
        "sm:inset-auto sm:end-5 sm:bottom-5 sm:h-[min(40rem,calc(100dvh-2.5rem))] sm:w-[24rem] sm:border sm:border-line sm:shadow-2xl sm:shadow-charcoal/25",
        "motion-safe:animate-[chat-in_220ms_cubic-bezier(0.22,1,0.36,1)]",
      )}
    >
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 bg-espresso px-4 py-3 text-ivory">
        <ChatMark />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate font-display text-lg leading-tight">
            {c.name[locale]}
          </h2>
          <p className="truncate text-xs text-walnut-soft">{c.role[locale]}</p>
        </div>
        {started && (
          <button
            type="button"
            onClick={() => {
              if (pending) return;
              // A new conversation: the old one stays with the team, this tab starts afresh.
              setState(empty);
              input.current?.focus();
            }}
            aria-label={c.restart[locale]}
            title={c.restart[locale]}
            className="inline-flex size-11 items-center justify-center text-ivory/80 hover:text-ivory"
          >
            <RotateCcw aria-hidden className="size-4.5" strokeWidth={1.5} />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={c.close[locale]}
          className="inline-flex size-11 items-center justify-center text-ivory/80 hover:text-ivory"
        >
          <X aria-hidden className="size-5" strokeWidth={1.5} />
        </button>
      </header>

      {/* Conversation */}
      <div
        ref={log}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5"
      >
        <Bubble role="assistant" label={c.assistant[locale]}>
          {welcome ?? c.welcome[locale]}
        </Bubble>
        <p className="border-s-2 border-oak ps-3 text-xs leading-relaxed text-ink-muted">
          {c.notice[locale]}
        </p>
        {!started && <QuickReplies locale={locale} onChoose={choose} disabled={pending} layout="wrap" />}

        {items.map((item) => {
          if (item.role === "user")
            return (
              <Bubble key={item.id} role="user" label={c.you[locale]}>
                {item.text}
              </Bubble>
            );
          if (item.role === "assistant")
            return (
              <Bubble
                key={item.id}
                role="assistant"
                label={c.assistant[locale]}
                live={item.id === streamingId}
              >
                <LinkedText text={item.text} locale={locale} onNavigate={closeIfSmall} />
              </Bubble>
            );
          if (item.role === "error")
            return (
              <div key={item.id} role="alert" className="space-y-3 border border-line bg-white p-3 text-sm">
                <p>{c.errors[item.code][locale]}</p>
                <ContactButtons locale={locale} contact={contact} />
              </div>
            );
          if (item.card === "form") {
            if (item.status !== "open") return null;
            return (
              <Panel key={item.id} id={item.id}>
                <ChatContactForm
                  locale={locale}
                  reason={item.reason}
                  uploads={uploads}
                  conversation={formConversation}
                  onSession={(token) => update((s) => ({ ...s, session: token }))}
                  onSent={(reference) => {
                    setFormStatus(item.id, "sent");
                    add({ id: newId(), role: "card", card: "sent", reference });
                    // The server saved the conversation and recorded the form.
                    markSynced();
                  }}
                  onCancel={() => setFormStatus(item.id, "closed")}
                />
              </Panel>
            );
          }
          if (item.card === "sent")
            return (
              <Panel key={item.id}>
                <p className="flex gap-2">
                  <CheckCircle2
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-emerald-700"
                    strokeWidth={1.5}
                  />
                  <span>
                    {c.form.done[locale]}{" "}
                    {item.reference && (
                      <strong dir="ltr" className="font-medium whitespace-nowrap">
                        {item.reference}
                      </strong>
                    )}
                  </span>
                </p>
              </Panel>
            );
          return (
            <CardView
              key={item.id}
              item={item}
              locale={locale}
              contact={contact}
              hours={hours}
              onNavigate={closeIfSmall}
              onLeaveDetails={showForm}
            />
          );
        })}

        {pending && !streamingId && (
          <div className="flex items-center gap-3" role="status">
            <ChatMark small />
            <span className="inline-flex items-center gap-1 border border-line bg-white px-3 py-3">
              {[0, 1, 2].map((n) => (
                <span
                  key={n}
                  className="size-1.5 rounded-full bg-walnut motion-safe:animate-[chat-dot_1s_ease-in-out_infinite]"
                  style={{ animationDelay: `${n * 160}ms` }}
                />
              ))}
              <span className="sr-only">{c.typing[locale]}</span>
            </span>
          </div>
        )}
      </div>

      {/* Quick options once the conversation has started, then the message box */}
      <div className="shrink-0 border-t border-line bg-ivory">
        {started && <QuickReplies locale={locale} onChoose={choose} disabled={pending} layout="row" />}
        <form
          className="relative flex items-end gap-2 px-3 pt-2 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <div aria-hidden className="absolute -start-[9999px] h-px w-px overflow-hidden">
            <label>
              Website
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>
          <label htmlFor={inputId} className="sr-only">
            {c.inputLabel[locale]}
          </label>
          <textarea
            ref={input}
            id={inputId}
            rows={1}
            dir="auto"
            value={draft}
            maxLength={CHAT_MAX_MESSAGE}
            placeholder={c.placeholder[locale]}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(draft);
              }
            }}
            className="field-sizing-content max-h-32 min-h-11 flex-1 resize-none border border-line bg-white px-3 py-2.5 text-base placeholder:text-ink-muted/80 focus:border-walnut sm:text-sm"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            aria-label={c.send[locale]}
            className="inline-flex size-11 shrink-0 items-center justify-center bg-espresso text-ivory transition-colors hover:bg-walnut-deep disabled:opacity-50"
          >
            <SendHorizontal aria-hidden className="size-5 rtl:-scale-x-100" strokeWidth={1.5} />
          </button>
        </form>
      </div>
    </section>
  );
}

/** Website paths in the assistant's reply become links to this site's own pages (src/lib/chat.ts). */
function LinkedText({ text, locale, onNavigate }: { text: string; locale: Locale; onNavigate: () => void }) {
  return (
    <>
      {splitSitePaths(text).map((part, i) =>
        part.path ? (
          <Link
            key={i}
            href={localizedPath(part.path, locale)}
            onClick={onNavigate}
            className="underline underline-offset-2 hover:text-walnut"
            dir="ltr"
          >
            {part.text}
          </Link>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** Interim mark (the cabinet-door motif of the site icon) until the company's logo is supplied. */
function ChatMark({ small }: { small?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 64 64" className={cn("shrink-0 rounded-md", small ? "size-7" : "size-10")}>
      <rect width="64" height="64" rx="10" fill="#4a2e1b" />
      <rect x="14" y="12" width="17" height="40" fill="none" stroke="#f1e9dd" strokeWidth="2.5" />
      <rect x="33" y="12" width="17" height="40" fill="none" stroke="#f1e9dd" strokeWidth="2.5" />
      <path d="M27 28v8M37 28v8" stroke="#c9a27e" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Bubble({
  role,
  label,
  live,
  children,
}: {
  role: "user" | "assistant";
  label: string;
  live?: boolean;
  children: React.ReactNode;
}) {
  const user = role === "user";
  return (
    <div className={cn("flex items-end gap-3", user && "justify-end")}>
      {!user && <ChatMark small />}
      <div
        className={cn(
          "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line",
          user ? "bg-espresso text-ivory" : "border border-line bg-white",
        )}
        aria-busy={live || undefined}
      >
        <span className="sr-only">{label}: </span>
        <span dir="auto">{children}</span>
      </div>
    </div>
  );
}

/** A card from the assistant (product overview, form, confirmation). */
function Panel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div className="flex items-start gap-3" data-chat-item={id}>
      <ChatMark small />
      <div className="max-w-[85%] flex-1 space-y-3 border border-line bg-white px-3.5 py-3 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function QuickReplies({
  locale,
  onChoose,
  disabled,
  layout,
}: {
  locale: Locale;
  onChoose: (reply: QuickReply) => void;
  disabled: boolean;
  layout: "wrap" | "row";
}) {
  return (
    <div role="group" aria-label={c.quickTitle[locale]}>
      <ul
        className={cn(
          "flex gap-2",
          layout === "wrap" ? "flex-wrap ps-10" : "[scrollbar-width:none] overflow-x-auto px-3 pt-2.5 pb-0.5",
        )}
      >
        {quickReplies.map((reply) => (
          <li key={reply.label.en} className="shrink-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChoose(reply)}
              className={cn(
                "inline-flex min-h-9 items-center border px-3 text-xs transition-colors disabled:opacity-50",
                reply.kind === "product"
                  ? "border-line bg-white hover:border-walnut hover:text-walnut"
                  : "border-walnut/40 bg-sand text-walnut-deep hover:border-walnut",
              )}
            >
              {reply.label[locale]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const actionLink =
  "inline-flex min-h-10 items-center gap-2 border border-espresso px-3 text-xs font-medium tracking-[0.06em] uppercase transition-colors hover:bg-espresso hover:text-ivory rtl:tracking-normal rtl:normal-case";
const primaryLink =
  "inline-flex min-h-10 items-center gap-2 bg-espresso px-3 text-xs font-medium tracking-[0.06em] text-ivory uppercase transition-colors hover:bg-walnut-deep rtl:tracking-normal rtl:normal-case";

function CardView({
  item,
  locale,
  contact,
  hours,
  onNavigate,
  onLeaveDetails,
}: {
  item: Extract<Card, { card: "product" | "quote" | "showroom" | "team" }>;
  locale: Locale;
  contact: ChatContact;
  hours: string;
  onNavigate: () => void;
  onLeaveDetails: (reason: ContactReason) => void;
}) {
  const details = (reason: ContactReason, label: string = c.leaveDetails[locale], primary = true) => (
    <button
      type="button"
      onClick={() => onLeaveDetails(reason)}
      className={primary ? primaryLink : actionLink}
    >
      {label}
    </button>
  );
  let body: React.ReactNode;
  if (item.card === "product") {
    const p = products.find((x) => x.key === item.key);
    if (!p) return null;
    body = (
      <>
        <h3 className="font-display text-base">{p.name[locale]}</h3>
        <p>{p.intro[locale]}</p>
        <p className="text-ink-muted">{c.cards.product[locale]}</p>
        <div className="flex flex-wrap gap-2">
          <Link href={localizedPath(pages[p.key].path, locale)} onClick={onNavigate} className={actionLink}>
            {c.viewProduct[locale]}: {p.name[locale]}
          </Link>
          {details("quotation", c.requestQuote[locale])}
        </div>
      </>
    );
  } else if (item.card === "quote") {
    body = (
      <>
        <p>{c.cards.quote[locale]}</p>
        <div className="flex flex-wrap gap-2">
          {details("quotation")}
          <Link
            href={localizedPath(pathFor("requestQuote"), locale)}
            onClick={onNavigate}
            className={actionLink}
          >
            {c.fullQuoteForm[locale]}
          </Link>
        </div>
      </>
    );
  } else if (item.card === "showroom") {
    body = (
      <>
        <p>{c.cards.showroom[locale]}</p>
        <p>
          <span className="font-medium">{c.cards.showroomHours[locale]}:</span> {hours}
        </p>
        <div className="flex flex-wrap gap-2">
          {details("showroom_visit")}
          <Link
            href={localizedPath(pathFor("bookConsultation"), locale)}
            onClick={onNavigate}
            className={actionLink}
          >
            {c.bookVisit[locale]}
          </Link>
          <Link href={localizedPath(pathFor("showroom"), locale)} onClick={onNavigate} className={actionLink}>
            {c.aboutShowroom[locale]}
          </Link>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <p>{c.cards.team[locale]}</p>
        <ContactButtons locale={locale} contact={contact} />
        <div>{details("callback", c.requestCallback[locale])}</div>
      </>
    );
  }
  return <Panel>{body}</Panel>;
}

function ContactButtons({ locale, contact }: { locale: Locale; contact: ChatContact }) {
  const phone = contact.phones[0];
  return (
    <div className="flex flex-wrap gap-2">
      {phone && (
        <a href={`tel:${phone.e164}`} className={actionLink}>
          <Phone aria-hidden className="size-3.5" strokeWidth={1.5} />
          {c.call[locale]} <span dir="ltr">{phone.display}</span>
        </a>
      )}
      {contact.whatsappNumber && (
        <a
          href={whatsappHref(contact.whatsappNumber)}
          target="_blank"
          rel="noopener noreferrer"
          className={actionLink}
        >
          <MessageCircle aria-hidden className="size-3.5" strokeWidth={1.5} />
          {c.whatsapp[locale]}
          <span className="sr-only">{c.newTab[locale]}</span>
        </a>
      )}
      <a href={mailtoHref(contact.email)} className={actionLink}>
        <Mail aria-hidden className="size-3.5" strokeWidth={1.5} />
        {c.email[locale]}
      </a>
    </div>
  );
}
