"use client";

import { ImageIcon, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { chatCopy } from "@/content/chat";
import { CHAT_MAX_FILES, type ChatRequest, type ContactReason } from "@/lib/chat";
import { cn } from "@/lib/cn";
import { localizedPath } from "@/lib/seo";
import { acceptAttribute, MAX_UPLOAD_BYTES, resolveUploadType } from "@/lib/uploads/policy";

type Locale = "en" | "ar";
const f = chatCopy.form;
type ErrorKey = keyof typeof f.errors;
const errorText = (key: string | undefined, locale: Locale) =>
  (f.errors[(key ?? "invalid") as ErrorKey] ?? f.errors.invalid)[locale];

interface Upload {
  key: string;
  name: string;
  status: "uploading" | "ready" | "error";
  error?: string;
  id?: string;
  ticket?: string;
}

/**
 * The chat's contact form. What the visitor types here goes to POST /api/chat/contact and from there
 * to the CRM: never to the AI provider. Photos use the same signed, server-checked uploads as the
 * quotation form.
 */
export function ChatContactForm({
  locale,
  reason,
  uploads,
  conversation,
  onSession,
  onSent,
  onCancel,
}: {
  locale: Locale;
  reason: ContactReason;
  /** Whether file storage is set up on the server. */
  uploads: boolean;
  /** The conversation as the window shows it, to save with the form. */
  conversation: () => { session?: string; messages: ChatRequest["messages"]; fresh: number };
  onSession: (token: string) => void;
  onSent: (reference: string | null) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [startedAt] = useState(() => Date.now());
  const [values, setValues] = useState({
    name: "",
    phone: "",
    email: "",
    area: "",
    message: "",
    preferredContact: "whatsapp" as "whatsapp" | "call" | "email",
    consentEmail: false,
    consentWhatsapp: false,
    privacyAccepted: false,
    website: "",
  });
  const [files, setFiles] = useState<Upload[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [sending, setSending] = useState(false);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const patchFile = (key: string, patch: Partial<Upload>) =>
    setFiles((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)));

  async function upload(file: File, key: string) {
    try {
      const start = await fetch("/api/uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
      });
      const data = await start.json().catch(() => ({}));
      if (!start.ok) return patchFile(key, { status: "error", error: data.error ?? "uploadFailed" });
      const put = await fetch(data.upload.url, { method: "PUT", headers: data.upload.headers, body: file });
      if (!put.ok) return patchFile(key, { status: "error", error: "uploadFailed" });
      patchFile(key, { status: "ready", id: data.id, ticket: data.ticket });
    } catch {
      patchFile(key, { status: "error", error: "uploadFailed" });
    }
  }

  function choose(list: FileList | null) {
    if (!list) return;
    const room = CHAT_MAX_FILES - files.length;
    const added = Array.from(list)
      .slice(0, Math.max(room, 0))
      .map((file): Upload => {
        const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
        const bad = !resolveUploadType(file.name, file.type)
          ? "fileType"
          : file.size > MAX_UPLOAD_BYTES
            ? "fileTooLarge"
            : file.size === 0
              ? "fileEmpty"
              : null;
        if (bad) return { key, name: file.name, status: "error", error: bad };
        void upload(file, key);
        return { key, name: file.name, status: "uploading" };
      });
    setFiles((current) => [...current, ...added]);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    setErrors({});
    setFormError(undefined);
    if (files.some((u) => u.status === "uploading")) return setFormError("fileNotUploaded");
    setSending(true);
    try {
      const res = await fetch("/api/chat/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...conversation(),
          ...values,
          email: values.email || undefined,
          area: values.area || undefined,
          message: values.message || undefined,
          locale,
          reason,
          startedAt,
          files: files.filter((u) => u.status === "ready").map((u) => ({ id: u.id, ticket: u.ticket })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.session === "string") onSession(data.session);
      if (res.ok) return onSent(typeof data.reference === "string" ? data.reference : null);
      if (data.fieldErrors && Object.keys(data.fieldErrors).length) setErrors(data.fieldErrors);
      setFormError(data.error ?? "server");
    } catch {
      setFormError("server");
    } finally {
      setSending(false);
    }
  }

  const field = (name: "name" | "phone" | "email" | "area", label: string, props: object = {}) => (
    <div>
      <label htmlFor={`${id}-${name}`} className="mb-1 block text-xs font-medium">
        {label}
      </label>
      <input
        id={`${id}-${name}`}
        value={values[name]}
        onChange={(e) => set(name, e.target.value)}
        aria-invalid={Boolean(errors[name]) || undefined}
        aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
        className="min-h-10 w-full border border-line bg-white px-3 text-base focus:border-walnut sm:text-sm"
        {...props}
      />
      {errors[name] && (
        <p id={`${id}-${name}-error`} className="mt-1 text-xs text-red-800">
          {errorText(errors[name], locale)}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="relative space-y-3" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="font-display text-base">
        {f.title[reason][locale]}
      </h3>
      <p className="text-xs text-ink-muted">{f.intro[locale]}</p>
      <div aria-hidden className="absolute -start-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={(e) => set("website", e.target.value)}
          />
        </label>
      </div>
      {field("name", f.name[locale], { autoComplete: "name", required: true, maxLength: 100 })}
      {field("phone", f.phone[locale], {
        autoComplete: "tel",
        inputMode: "tel",
        type: "tel",
        dir: "ltr",
        required: true,
        maxLength: 30,
      })}
      {field("email", f.email[locale], { autoComplete: "email", type: "email", dir: "ltr", maxLength: 254 })}
      {field("area", f.area[locale], { maxLength: 120 })}
      <fieldset>
        <legend className="mb-1 text-xs font-medium">{f.preferred[locale]}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {(["whatsapp", "call", "email"] as const).map((option) => (
            <label key={option} className="inline-flex min-h-9 items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${id}-preferred`}
                checked={values.preferredContact === option}
                onChange={() => set("preferredContact", option)}
                className="accent-walnut"
              />
              {f.preferredOptions[option][locale]}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${id}-message`} className="mb-1 block text-xs font-medium">
          {f.message[locale]}
        </label>
        <textarea
          id={`${id}-message`}
          rows={2}
          dir="auto"
          maxLength={1000}
          value={values.message}
          onChange={(e) => set("message", e.target.value)}
          className="w-full resize-y border border-line bg-white px-3 py-2 text-base focus:border-walnut sm:text-sm"
        />
      </div>

      {uploads && (
        <div>
          <p className="mb-1 text-xs font-medium">{f.photos[locale]}</p>
          <label
            className={cn(
              "inline-flex min-h-10 cursor-pointer items-center gap-2 border border-dashed border-charcoal/30 px-3 text-sm hover:border-walnut has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus",
              files.length >= CHAT_MAX_FILES && "pointer-events-none opacity-50",
            )}
          >
            <ImageIcon aria-hidden className="size-4 text-walnut" strokeWidth={1.5} />
            {f.addPhotos[locale]}
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={acceptAttribute}
              disabled={files.length >= CHAT_MAX_FILES}
              onChange={(e) => choose(e.target.files)}
              className="sr-only"
            />
          </label>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1" aria-live="polite">
              {files.map((u) => (
                <li key={u.key} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" dir="auto">
                      {u.name}
                    </span>
                    {u.status === "uploading" && (
                      <span className="text-ink-muted">{f.uploading[locale]}</span>
                    )}
                    {u.status === "error" && (
                      <span className="text-red-800">{errorText(u.error, locale)}</span>
                    )}
                  </span>
                  {u.status === "uploading" ? (
                    <Loader2 aria-hidden className="size-4 animate-spin text-ink-muted" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFiles((list) => list.filter((x) => x.key !== u.key))}
                      aria-label={`${f.remove[locale]}: ${u.name}`}
                      className="inline-flex size-9 items-center justify-center text-ink-muted hover:text-charcoal"
                    >
                      <X aria-hidden className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <fieldset className="space-y-1 border-t border-line pt-3">
        <legend className="sr-only">{f.consentTitle[locale]}</legend>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={values.privacyAccepted}
            onChange={(e) => set("privacyAccepted", e.target.checked)}
            aria-invalid={Boolean(errors.privacyAccepted) || undefined}
            className="mt-0.5 accent-walnut"
          />
          <span>
            {f.privacyBefore[locale]}
            <Link
              href={localizedPath("/privacy-policy", locale)}
              target="_blank"
              className="underline underline-offset-2"
            >
              {f.privacyLink[locale]}
            </Link>
            {f.privacyAfter[locale]}
          </span>
        </label>
        {errors.privacyAccepted && <p className="text-xs text-red-800">{errorText("privacy", locale)}</p>}
        <p className="pt-1 text-xs font-medium">{f.consentTitle[locale]}</p>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={values.consentWhatsapp}
            onChange={(e) => set("consentWhatsapp", e.target.checked)}
            className="mt-0.5 accent-walnut"
          />
          {f.consentWhatsapp[locale]}
        </label>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={values.consentEmail}
            onChange={(e) => set("consentEmail", e.target.checked)}
            className="mt-0.5 accent-walnut"
          />
          {f.consentEmail[locale]}
        </label>
      </fieldset>

      {formError && (
        <p role="alert" className="text-xs text-red-800">
          {errorText(formError, locale)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={sending}
          className="inline-flex min-h-10 items-center gap-2 bg-espresso px-4 text-xs font-medium tracking-[0.06em] text-ivory uppercase transition-colors hover:bg-walnut-deep disabled:opacity-60 rtl:tracking-normal rtl:normal-case"
        >
          {sending && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {sending ? f.sending[locale] : f.submit[locale]}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-10 px-2 text-xs underline underline-offset-2"
        >
          {f.cancel[locale]}
        </button>
      </div>
    </form>
  );
}
