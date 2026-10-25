import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LeadsPerWeekChart } from "@/components/admin/charts";
import {
  Badge,
  fmtDateTime,
  label,
  leadStatusTone,
  PageHeader,
  Panel,
  StatCard,
} from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { dashboard, recentActivity } from "@/server/crm/dashboard";
import { db } from "@/server/db";
import { firstAdminPage } from "./nav";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const actor = await requireActor();
  if (!can(actor, "lead.read")) redirect(firstAdminPage(actor.permissions));
  const [d, activity] = await Promise.all([dashboard(db, actor), recentActivity(db, actor)]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live figures from website enquiries and the CRM. Quotation and project figures appear once quotations and projects are managed here (next phase)."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total enquiries"
          value={d.total}
          hint={`${d.last30} in the last 30 days`}
          href="/admin/leads"
        />
        <StatCard
          label="New leads"
          value={d.newLeads}
          hint="Not contacted yet"
          href="/admin/leads?status=new"
        />
        <StatCard
          label="Open quotation requests"
          value={d.openRequests}
          hint="Received or being reviewed"
          href="/admin/leads?source=website_quote"
        />
        {d.upcomingConsultations !== null && (
          <StatCard
            label="Upcoming consultations"
            value={d.upcomingConsultations}
            hint="Requested or confirmed"
            href="/admin/consultations?when=upcoming"
          />
        )}
        <StatCard
          label="Lead conversion"
          value={d.conversion === null ? "—" : `${d.conversion}%`}
          hint={
            d.conversion === null
              ? "No won or lost leads yet"
              : `${d.statusCount.won ?? 0} won of ${(d.statusCount.won ?? 0) + (d.statusCount.lost ?? 0)} decided`
          }
        />
        <StatCard
          label="My follow-ups due"
          value={d.dueFollowUps}
          hint="Due within 24 hours"
          href="/admin/follow-ups"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="New leads per week" className="xl:col-span-2">
          <LeadsPerWeekChart data={d.weeks} />
          <table className="sr-only">
            <caption>New leads per week</caption>
            <thead>
              <tr>
                <th>Week starting</th>
                <th>Leads</th>
              </tr>
            </thead>
            <tbody>
              {d.weeks.map((w) => (
                <tr key={w.week}>
                  <td>{w.week}</td>
                  <td>{w.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Sources (last 30 days)">
          {d.bySource.length === 0 ? (
            <p className="text-sm text-ink-muted">No enquiries in the last 30 days.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {d.bySource.map((s) => (
                <li key={s.source} className="flex justify-between gap-4">
                  <span>{label(s.source)}</span>
                  <span className="tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-6 text-sm font-semibold">Leads by status</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {Object.entries(d.statusCount).map(([status, count]) => (
              <li key={status}>
                <Link href={`/admin/leads?status=${status}`}>
                  <Badge tone={leadStatusTone[status]}>
                    {label(status)} · {count}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel
          title="Latest enquiries"
          actions={
            <Link href="/admin/leads" className="text-sm underline underline-offset-4">
              All leads
            </Link>
          }
        >
          {d.recentLeads.length === 0 ? (
            <p className="text-sm text-ink-muted">No enquiries yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {d.recentLeads.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-4 py-2.5">
                  <span>
                    <Link
                      href={`/admin/leads/${l.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {l.customer.name}
                    </Link>{" "}
                    <span className="font-mono text-xs text-ink-muted">{l.reference}</span>
                    <span className="block text-ink-muted">{l.summary}</span>
                  </span>
                  <span className="shrink-0 text-end">
                    <Badge tone={leadStatusTone[l.status]}>{label(l.status)}</Badge>
                    <span className="block text-xs text-ink-muted">{fmtDateTime(l.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent activity">
          {activity.length === 0 ? (
            <p className="text-sm text-ink-muted">No staff activity yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {activity.map((a) => (
                <li key={a.id} className="py-2.5">
                  <span className="text-ink-muted">
                    {fmtDateTime(a.createdAt)} · {a.author?.name ?? "System"} ·{" "}
                  </span>
                  <Link
                    href={`/admin/leads/${a.lead.id}`}
                    className="font-mono text-xs underline-offset-4 hover:underline"
                  >
                    {a.lead.reference}
                  </Link>
                  <span className="block">
                    {label(a.kind)}: {a.body.length > 140 ? `${a.body.slice(0, 137)}…` : a.body}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
