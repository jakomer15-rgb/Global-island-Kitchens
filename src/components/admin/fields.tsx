import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { adminInput } from "./ui";

function Wrap({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

export function AdminInput({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} className={className}>
      <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={adminInput} {...props} />
    </Wrap>
  );
}

export function AdminTextarea({
  label,
  hint,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} className={className}>
      <textarea
        id={id}
        rows={4}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cn(adminInput, "resize-y")}
        {...props}
      />
    </Wrap>
  );
}

export function AdminSelect({
  label,
  hint,
  options,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: ReactNode;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} className={className}>
      <select id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={adminInput} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrap>
  );
}

export function AdminCheckbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="flex min-h-10 items-center gap-2.5 text-sm">
      <input type="checkbox" className="size-4 accent-walnut" {...props} />
      {label}
    </label>
  );
}
