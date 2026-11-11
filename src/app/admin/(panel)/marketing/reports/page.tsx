import type { Metadata } from "next";
import Link from "next/link";
import { label, PageHeader, Panel, StatCard } from "@/components/admin/ui";
import { gccCountries, prospectTypeNames, type ProspectTypeKey } from "@/lib/prospect-score";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { marketingReport } from "@/server/marketing/report";

export const metadata: Metadata = { title: "Lead generation report" };

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Asia/Bahrain",
});

function change(now: number, before: number) {
  if (now === before) return "same as before";
  return `${now > before ? "+" : ""}${now - before} vs the previous period`;
}

export default async function ReportsPage({ searchParams }: PageProps<"/admin/marketing/reports">) {
  const actor = await requireActor("marketing.manage");
  const period = (await searchParams).period === "day" ? "day" : "week";
  const r = await marketingReport(db, actor, period);
  const t = r.thisPeriod;
  const l = r.lastPeriod;
  const end = new Date(r.period.end.getTime() - 1);

  return (
    <>
      <PageHeader
        title="Lead generation report"
        description={`${period === "day" ? "Today" : "This week (from Saturday)"}: ${dayFormat.format(r.period.start)}${period === "week" ? ` – ${dayFormat.format(end)}` : ""}. Counted from the database; compared with the previous ${period}.`}
        actions={
          <>
            <Link
              href="?period=day"
              aria-current={period === "day" ? "page" : undefined}
              className="inline-flex min-h-10 items-center border border-charcoal/25 bg-white px-4 text-sm aria-[current=page]:bg-charcoal aria-[current=page]:text-ivory"
            >
              Daily
            </Link>
            <Link
              href="?period=week"
              aria-current={period === "week" ? "page" : undefined}
              className="inline-flex min-h-10 items-center border border-charcoal/25 bg-white px-4 text-sm aria-[current=page]:bg-charcoal aria-[current=page]:text-ivory"
            >
              Weekly
            </Link>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Prospects added" value={t.added} hint={change(t.added, l.added)} />
        <StatCard
          label="Contacted"
          value={t.contacted}
          hint={`${t.emailsSent} by campaign email · ${change(t.contacted, l.contacted)}`}
        />
        <StatCard
          label="Interested"
          value={t.interested}
          hint={`${t.notInterested} not interested · ${change(t.interested, l.interested)}`}
        />
        <StatCard
          label="Converted to leads"
          value={t.converted}
          hint={`${t.unsubscribed} unsubscribed · ${change(t.converted, l.converted)}`}
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title={`Leads received (${t.leads})`}>
          {t.leadsBySource.length === 0 ? (
            <p className="text-sm text-ink-muted">None in this period.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {t.leadsBySource.map((s) => (
                <li key={s.source} className="flex justify-between">
                  <span>{label(s.source)}</span>
                  <span className="tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-muted">
            Previous {period}: {l.leads}
          </p>
        </Panel>
        <Panel title="Open prospects by priority">
          <ul className="space-y-1 text-sm">
            {(["high", "medium", "low"] as const).map((p) => (
              <li key={p} className="flex justify-between">
                <Link href={`/admin/marketing?priority=${p}`} className="underline-offset-4 hover:underline">
                  {label(p)}
                </Link>
                <span className="tabular-nums">{r.pipeline.byPriority[p] ?? 0}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">New, contacted or interested.</p>
        </Panel>
        <Panel title="All prospects by type and country">
          <ul className="space-y-1 text-sm">
            {Object.entries(r.pipeline.byType)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => (
                <li key={k} className="flex justify-between">
                  <span>{prospectTypeNames[k as ProspectTypeKey] ?? k}</span>
                  <span className="tabular-nums">{n}</span>
                </li>
              ))}
          </ul>
          <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
            {Object.entries(r.pipeline.byCountry).map(([k, n]) => (
              <li key={k} className="flex justify-between">
                <span>{gccCountries[k as keyof typeof gccCountries] ?? k}</span>
                <span className="tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
