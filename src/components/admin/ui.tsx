import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-display-md">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
  actions,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("border border-line bg-white", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="block border border-line bg-white p-5 transition-colors hover:border-walnut">
      {body}
    </Link>
  ) : (
    <div className="border border-line bg-white p-5">{body}</div>
  );
}

const tones = {
  neutral: "bg-sand text-charcoal",
  info: "bg-sky-50 text-sky-900",
  good: "bg-emerald-50 text-emerald-900",
  warn: "bg-amber-50 text-amber-900",
  bad: "bg-red-50 text-red-900",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export const leadStatusTone: Record<string, Tone> = {
  new: "info",
  contacted: "neutral",
  qualified: "warn",
  quoted: "warn",
  won: "good",
  lost: "bad",
};

export const consultationTone: Record<string, Tone> = {
  requested: "info",
  confirmed: "good",
  completed: "neutral",
  cancelled: "bad",
  no_show: "bad",
};

export function Table({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      className="overflow-x-auto border border-line bg-white"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">{label}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn("border-b border-line bg-sand/50 px-4 py-2.5 font-medium text-ink-muted", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-line px-4 py-3 align-top", className)}>{children}</td>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="border border-dashed border-line bg-white p-10 text-center text-sm text-ink-muted">
      {children}
    </p>
  );
}

/** Previous/next links that keep the current filters. */
export function Pagination({
  page,
  pages,
  params,
}: {
  page: number;
  pages: number;
  params: Record<string, string | undefined>;
}) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(
      Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][],
    );
    return `?${q.toString()}`;
  };
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className="underline underline-offset-4">
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-ink-muted">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="underline underline-offset-4">
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export const adminInput =
  "mt-1 block w-full border border-charcoal/25 bg-white px-3 py-2 text-sm focus:border-walnut aria-[invalid=true]:border-red-700";

/** GET filter form; submitting reloads the page with the query string. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <form method="get" className="mb-5 flex flex-wrap items-end gap-3 border border-line bg-white p-4">
      {children}
      <button type="submit" className="min-h-10 bg-charcoal px-4 text-sm font-medium text-ivory">
        Filter
      </button>
      <Link href="?" className="min-h-10 px-2 py-2 text-sm underline underline-offset-4">
        Clear
      </Link>
    </form>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-xs font-medium text-ink-muted">
      {label}
      {children}
    </label>
  );
}

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bahrain",
});
const dateOnly = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });
export const fmtDateTime = (d: Date) => dateTime.format(d);
/** For `@db.Date` columns (stored at UTC midnight). */
export const fmtDate = (d: Date) => dateOnly.format(d);
export const label = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
