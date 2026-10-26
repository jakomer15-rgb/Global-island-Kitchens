"use client";

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { portal, type PortalBi } from "@/content/portal";

export type PortalLocale = "en" | "ar";

export const tr = (value: PortalBi, locale: PortalLocale) => value[locale];

/** Text for an error code from the server or the schema; unknown codes get the generic message. */
export function errorText(code: string | undefined, locale: PortalLocale): string | undefined {
  if (!code) return undefined;
  const known = portal.errors as Record<string, PortalBi>;
  return (known[code] ?? portal.errors.invalid)[locale];
}

const control =
  "mt-2 block w-full border border-charcoal/25 bg-white px-3.5 py-3 text-base text-charcoal transition-colors placeholder:text-ink-muted/70 focus:border-walnut aria-[invalid=true]:border-red-700";

export function PField({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {children({
        id,
        describedBy: [hintId, errorId].filter(Boolean).join(" ") || undefined,
        invalid: Boolean(error),
      })}
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

export function PInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function PTextarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} className={cn(control, "resize-y", className)} {...props} />;
}

export function PSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "appearance-auto", className)} {...props} />;
}

export function PAlert({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "border-s-2 px-4 py-3 text-sm",
        tone === "error" ? "border-red-700 bg-red-50 text-red-900" : "border-walnut bg-sand text-charcoal",
      )}
    >
      {children}
    </p>
  );
}

/** Hidden field real visitors never fill (spam trap). */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden className="absolute -start-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
