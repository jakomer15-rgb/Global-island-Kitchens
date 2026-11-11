import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminTextarea } from "@/components/admin/fields";
import { PageHeader, Panel, StatCard } from "@/components/admin/ui";
import { change, hoursText, reportKindNames, type ReportKind } from "@/lib/analytics";
import { parseSetting } from "@/lib/site-settings";
import { businessReport, reportSettingsReady } from "@/server/analytics/report";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { db } from "@/server/db";
import { saveSettingAction } from "../settings/actions";
import { ResultView } from "./result-view";

export const metadata: Metadata = { title: "Business analytics" };

const kinds: ReportKind[] = ["daily", "weekly", "monthly"];
const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const vs = (a: number, b: number) => {
  const c = change(a, b);
  return c ? `${c} vs previous (${b})` : undefined;
};

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  const actor = await requireActor("analytics.read");
  const sp = await searchParams;
  const kind = kinds.find((k) => k === pick(sp.report)) ?? "weekly";
  const offset = Math.max(0, Math.min(24, Number(pick(sp.back) ?? 0) || 0));
  const manage = can(actor, "analytics.manage");
  const [r, settingRow] = await Promise.all([
    businessReport(db, actor, kind, offset),
    manage ? db.siteSetting.findUnique({ where: { key: "analyticsReports" } }) : Promise.resolve(null),
  ]);
  const emails = parseSetting("analyticsReports", settingRow?.value);
  const c = r.current;
  const b = r.previous;
  const href = (k: ReportKind, back: number) => `/admin/analytics?report=${k}${back ? `&back=${back}` : ""}`;
  const running = offset === 0;

  return (
    <>
      <PageHeader
        title="Business analytics"
        description="Every figure is counted from the database when you open the page; nothing is estimated. Compare with the previous period, or ask a question in plain words."
        actions={
          <Link
            href="/admin/analytics/ask"
            className="inline-flex min-h-10 items-center bg-charcoal px-4 text-sm font-medium text-ivory"
          >
            Ask a question
          </Link>
        }
      />
      <nav aria-label="Report" className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        {kinds.map((k) => (
          <Link
            key={k}
            href={href(k, 0)}
            aria-current={k === kind ? "page" : undefined}
            className={`border px-3 py-2 ${k === kind ? "border-charcoal bg-charcoal text-ivory" : "border-line bg-white hover:bg-sand"}`}
          >
            {reportKindNames[k]}
          </Link>
        ))}
        <span className="mx-2 text-ink-muted">|</span>
        <Link href={href(kind, offset + 1)} className="border border-line bg-white px-3 py-2 hover:bg-sand">
          ← Earlier
        </Link>
        {offset > 0 && (
          <Link href={href(kind, offset - 1)} className="border border-line bg-white px-3 py-2 hover:bg-sand">
            Later →
          </Link>
        )}
      </nav>
      <h2 className="mb-4 font-display text-2xl">
        {r.period.from}
        {r.period.to !== r.period.from ? ` to ${r.period.to}` : ""}
        <span className="ms-2 text-sm text-ink-muted">
          {running ? "so far · " : ""}compared with {r.previousPeriod.from}
          {r.previousPeriod.to !== r.previousPeriod.from ? ` to ${r.previousPeriod.to}` : ""}
        </span>
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total enquiries"
          value={c.inquiries}
          hint={vs(c.inquiries, b.inquiries)}
          href="/admin/leads"
        />
        <StatCard
          label="New customers"
          value={c.newCustomers}
          hint={vs(c.newCustomers, b.newCustomers)}
          href="/admin/customers"
        />
        <StatCard
          label="Hot · warm · cold"
          value={`${c.hotLeads} · ${c.warmLeads} · ${c.coldLeads}`}
          hint={`${c.notRated} not rated (of this period's enquiries)`}
        />
        <StatCard
          label="Follow-ups overdue (now)"
          value={c.followUpsOverdueNow}
          hint={`${c.followUpsDueRestOfToday} more due today`}
          href="/admin/follow-ups"
        />
        <StatCard
          label="Quotations created"
          value={c.quotationsCreated}
          hint={vs(c.quotationsCreated, b.quotationsCreated)}
          href="/admin/quotations"
        />
        <StatCard
          label="Quotations approved"
          value={c.quotationsApproved}
          hint={vs(c.quotationsApproved, b.quotationsApproved)}
        />
        <StatCard
          label="Awaiting the customer (now)"
          value={c.quotationsAwaitingCustomerNow}
          hint="Quotations sent, no answer yet"
          href="/admin/quotations?status=sent"
        />
        <StatCard
          label="Orders received"
          value={c.ordersReceived}
          hint={`BHD ${c.ordersValueBhd.toFixed(3)}${change(c.ordersReceived, b.ordersReceived) ? ` · ${vs(c.ordersReceived, b.ordersReceived)}` : ""}`}
          href="/admin/orders"
        />
        <StatCard
          label="Conversion"
          value={c.conversion.winRatePercent === null ? "—" : `${c.conversion.winRatePercent}%`}
          hint={`Of this period's enquiries: ${c.conversion.won} won, ${c.conversion.lost} lost, ${c.conversion.open} open`}
        />
        <StatCard
          label="Response time (median)"
          value={hoursText(c.responseTime.medianHours)}
          hint={`${c.responseTime.within24h} of ${c.responseTime.contacted} contacted within 24 h · ${c.responseTime.notYetContacted} not contacted yet`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Lead sources">
          <ResultView result={r.sources as never} />
        </Panel>
        <Panel title="Products asked about">
          <ResultView result={r.productsAsked as never} />
        </Panel>
        <Panel title="New customers by type">
          <ResultView result={r.customers as never} />
        </Panel>
        <Panel title="Open leads by stage (now)">
          <ResultView result={r.pipeline as never} />
        </Panel>
        <Panel title="Social media">
          <ResultView result={r.social as never} />
        </Panel>
        <Panel title="Campaigns">
          <ResultView result={r.campaigns as never} />
        </Panel>
        <Panel title="Follow-ups due (now)">
          <ResultView result={r.followUps as never} />
        </Panel>
        <Panel title="Quotations awaiting the customer (now)">
          <ResultView result={r.quotations as never} />
        </Panel>
      </div>

      {manage && (
        <Panel title="Email these reports" className="mt-6">
          <ActionForm action={saveSettingAction.bind(null, "analyticsReports")} submitLabel="Save">
            <p className="text-sm text-ink-muted">
              The scheduled job emails the reports switched on here: yesterday&apos;s every morning, last
              week&apos;s on Saturday, last month&apos;s on the 1st. Each period is sent once.
              {reportSettingsReady()
                ? ""
                : " Email sending (Resend) isn't set up yet, so nothing can be sent."}
            </p>
            <div className="flex flex-wrap gap-x-6">
              <AdminCheckbox name="daily" defaultChecked={emails.daily} label="Daily" />
              <AdminCheckbox name="weekly" defaultChecked={emails.weekly} label="Weekly" />
              <AdminCheckbox name="monthly" defaultChecked={emails.monthly} label="Monthly" />
            </div>
            <AdminTextarea
              label="Send to"
              name="emails"
              rows={3}
              dir="ltr"
              defaultValue={emails.emails.join("\n")}
              hint="Staff addresses, one per line (up to 10). Empty uses the server's NOTIFY_EMAILS. Reports contain figures and lead references, no customer details."
            />
          </ActionForm>
        </Panel>
      )}
    </>
  );
}
