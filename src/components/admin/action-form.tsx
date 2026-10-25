"use client";

import { startTransition, useActionState, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState, type ActionState } from "@/lib/admin/action-state";
import { cn } from "@/lib/cn";

/** "showroomEn.0" → "Showroom En 1" */
function fieldLabel(path: string) {
  return path
    .replace(/\.(\d+)/g, (_, n) => ` ${Number(n) + 1}`)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Form bound to an admin server action, with pending state and an announced result message.
 * `confirm` asks before submitting (for destructive or hard-to-undo actions). Submitting through
 * onSubmit (rather than React's form action, which resets the form) keeps what was typed when the
 * server rejects it; `resetOnSuccess` clears the form after a successful save (e.g. a new account).
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  confirm,
  variant = "primary",
  className,
  inline = false,
  resetOnSuccess = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel: string;
  confirm?: string;
  variant?: "primary" | "outline";
  className?: string;
  inline?: boolean;
  resetOnSuccess?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, data: FormData) => {
    const next = await action(prev, data);
    if (next.ok && resetOnSuccess) form.current?.reset();
    return next;
  }, initialActionState);

  return (
    <form
      ref={form}
      action={formAction}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className={cn(inline ? "flex flex-wrap items-end gap-3" : "space-y-4", className)}
    >
      {children}
      <div className={cn("flex flex-wrap items-center gap-3", inline && "contents")}>
        <Button type="submit" variant={variant} disabled={pending} className="min-h-10 px-4 py-2">
          {pending ? "Saving…" : submitLabel}
        </Button>
        {(state.message || state.error) && (
          <p
            role={state.error ? "alert" : "status"}
            className={cn("text-sm", state.error ? "text-red-800" : "text-emerald-800")}
          >
            {state.error ?? state.message}
          </p>
        )}
        {state.fieldErrors && (
          <ul className="w-full list-disc ps-5 text-sm text-red-800">
            {Object.entries(state.fieldErrors).map(([field, message]) => (
              <li key={field}>
                <span className="font-medium">{fieldLabel(field)}:</span> {message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  );
}
