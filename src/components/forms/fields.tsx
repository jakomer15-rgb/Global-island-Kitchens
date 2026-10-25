"use client";

import { useTranslations } from "next-intl";
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const control =
  "mt-2 block w-full border border-charcoal/25 bg-white px-3.5 py-3 text-base text-charcoal transition-colors placeholder:text-ink-muted/70 focus:border-walnut aria-[invalid=true]:border-red-700";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  /** Error key under Forms.errors. */
  error?: string;
  optional?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Label, hint and error wired to the control with aria-describedby / aria-invalid. */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const t = useTranslations("Forms");
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="ms-1.5 font-normal text-ink-muted">({t("optional")})</span>}
      </label>
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-red-800">
          {t(`errors.${error}` as "errors.required")}
        </p>
      )}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...props }, ref) {
    return <input ref={ref} className={cn(control, className)} {...props} />;
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return <textarea ref={ref} rows={4} className={cn(control, "resize-y", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return <select ref={ref} className={cn(control, "appearance-auto", className)} {...props} />;
});

/** A group of radio or checkbox cards with a legend and shared error. */
export function ChoiceGroup({
  legend,
  error,
  children,
  className,
}: {
  legend: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations("Forms");
  const id = useId();
  return (
    <fieldset className={className} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm text-red-800">
          {t(`errors.${error}` as "errors.required")}
        </p>
      )}
    </fieldset>
  );
}

export const ChoiceCard = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode; type: "radio" | "checkbox" }
>(function ChoiceCard({ label, hint, className, ...props }, ref) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 border border-charcoal/20 bg-white p-4 transition-colors hover:border-walnut has-[:checked]:border-walnut has-[:checked]:bg-sand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus",
        className,
      )}
    >
      <input ref={ref} className="mt-1 size-4 shrink-0 accent-walnut" {...props} />
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-ink-muted">{hint}</span>}
      </span>
    </label>
  );
});

export const Checkbox = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string }
>(function Checkbox({ label, error, ...props }, ref) {
  const t = useTranslations("Forms");
  const id = useId();
  return (
    <div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-sm">
        <input
          ref={ref}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-walnut"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-800">
          {t(`errors.${error}` as "errors.required")}
        </p>
      )}
    </div>
  );
});

/** Hidden spam traps: a field humans never see or fill, and when the form was opened. */
export function SpamTraps({ register }: { register: (name: "website") => object }) {
  return (
    <div aria-hidden className="absolute -start-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
      </label>
    </div>
  );
}

/** Form-level message (error or success) announced to screen readers. */
export function FormAlert({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
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
