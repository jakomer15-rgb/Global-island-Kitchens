import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageHeader, Panel, StatCard, TemperatureBadge } from "@/components/admin/ui";
import { centreText, tr, type CentreLang } from "@/content/automation-centre";
import type { Permission } from "@/server/auth/permissions";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { aiConfigured } from "@/server/ai/provider";
import { deliveryHealth } from "@/server/automation/logs";
import { approvalQueue, centreOverview } from "@/server/automation/overview";
import { chatSettings } from "@/server/chat/reply";
import { db } from "@/server/db";
import { getCentreLang } from "./lang";

export const metadata: Metadata = { title: "Automation Centre" };

type Module = {
  key: keyof typeof centreText.modules;
  href?: string;
  permission?: Permission;
  stage?: number;
};

/** The 14 areas of the Centre (owner's brief §10). Areas not built yet name the stage that builds them. */
const modules: Module[] = [
  { key: "overview", href: "/admin/automation", permission: "automation.read" },
  { key: "salesAgent", href: "/admin/ai-sales", permission: "lead.read" },
  { key: "marketingAgent", href: "/admin/marketing", permission: "marketing.manage" },
  { key: "leads", href: "/admin/leads", permission: "lead.read" },
  { key: "customers", href: "/admin/customers", permission: "customer.read" },
  { key: "social", href: "/admin/social/posts", permission: "social.manage" },
  { key: "calendar", href: "/admin/social", permission: "social.manage" },
  { key: "campaigns", href: "/admin/marketing/campaigns", permission: "marketing.manage" },
  { key: "analytics", stage: 7 },
  { key: "knowledge", href: "/admin/ai-agent#knowledge", permission: "chat.manage" },
  { key: "workflows", stage: 8 },
  { key: "integrations", href: "/admin/automation/integrations", permission: "automation.read" },
  { key: "users", href: "/admin/staff", permission: "staff.manage" },
  { key: "logs", href: "/admin/automation/logs", permission: "automation.read" },
];

function salesAgentState(enabled: boolean, keySet: boolean, lang: CentreLang) {
  const s = centreText.agents.sales;
  if (!keySet) return { tone: "warn" as const, text: tr(s.noKey, lang) };
  if (!enabled) return { tone: "neutral" as const, text: tr(s.off, lang) };
  return { tone: "good" as const, text: tr(s.live, lang) };
}

export default async function AutomationOverviewPage() {
  const actor = await requireActor("automation.read");
  const lang = await getCentreLang();
  const [o, approvals, health, chat] = await Promise.all([
    centreOverview(db, actor),
    approvalQueue(db, actor, 1),
    deliveryHealth(db, actor),
    chatSettings(db),
  ]);
  const T = centreText.overview;
  const A = centreText.agents;
  const sales = salesAgentState(chat.enabled, aiConfigured(), lang);

  return (
    <>
      <PageHeader title={tr(centreText.nav.overview, lang)} description={tr(T.description, lang)} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {o.enquiriesToday !== null && (
          <StatCard
            label={tr(T.enquiriesToday, lang)}
            value={o.enquiriesToday}
            hint={`${o.enquiries7} · ${tr(T.last7, lang)} — ${o.enquiries30} · ${tr(T.last30, lang)}`}
            href="/admin/leads"
          />
        )}
        {o.notContacted !== null && (
          <StatCard label={tr(T.notContacted, lang)} value={o.notContacted} href="/admin/leads?status=new" />
        )}
        {o.handoversWaiting !== null && (
          <StatCard
            label={tr(T.handovers, lang)}
            value={o.handoversWaiting}
            hint={tr(T.handoversHint, lang)}
            href="/admin/leads?source=website_chat&sort=stale"
          />
        )}
        {o.followUpsOverdue !== null && (
          <StatCard
            label={tr(T.followUpsOverdue, lang)}
            value={o.followUpsOverdue}
            hint={`${o.followUpsToday} ${tr(T.followUpsToday, lang)}`}
            href="/admin/follow-ups"
          />
        )}
        <StatCard
          label={tr(T.pendingApprovals, lang)}
          value={approvals.total}
          href="/admin/automation/approvals"
        />
        {o.quotationsAwaiting !== null && (
          <StatCard
            label={tr(T.quotationsAwaiting, lang)}
            value={o.quotationsAwaiting}
            hint={`${o.quotationsCreated30} ${tr(T.quotationsCreated, lang)}`}
            href="/admin/quotations?status=sent"
          />
        )}
        {o.quotationsApproved30 !== null && (
          <StatCard
            label={tr(T.quotationsApproved, lang)}
            value={o.quotationsApproved30}
            hint={`${o.orders30} ${tr(T.orders, lang)}`}
            href="/admin/orders"
          />
        )}
        {o.enquiriesToday !== null && (
          <StatCard
            label={tr(T.conversion, lang)}
            value={o.conversion ? `${o.conversion.percent}%` : "—"}
            hint={
              o.conversion
                ? `${o.conversion.won} / ${o.conversion.decided} ${tr(T.conversionHint, lang)}`
                : tr(T.noConversion, lang)
            }
          />
        )}
        <StatCard
          label={tr(T.deliveryProblems, lang)}
          value={health.failed}
          hint={tr(T.deliveryHint, lang)}
          href="/admin/automation/logs?status=failed"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {o.temperature && (
          <Panel title={tr(T.openByRating, lang)}>
            <ul className="space-y-3 text-sm">
              {(["hot", "warm", "cold"] as const).map((t) => (
                <li key={t} className="flex items-center justify-between gap-3">
                  <Link href={`/admin/leads?temperature=${t}`} className="hover:underline">
                    <TemperatureBadge value={t} />
                  </Link>
                  <span className="font-display text-2xl tabular-nums">{o.temperature![t]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">
              {o.temperature.unrated} {tr(T.unrated, lang)}
              {o.chats7 !== null && ` · ${tr(T.chats7, lang)}: ${o.chats7}`}
            </p>
          </Panel>
        )}

        <Panel title={tr(T.agents, lang)} className={o.temperature ? "xl:col-span-2" : "xl:col-span-3"}>
          <ul className="grid gap-4 sm:grid-cols-2">
            <li className="border border-line p-4">
              <p className="font-medium">{tr(A.sales.name, lang)}</p>
              <p className="mt-1">
                <Badge tone={sales.tone}>{sales.text}</Badge>
              </p>
              <p className="mt-2 text-sm text-ink-muted">{tr(A.sales.about, lang)}</p>
              <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
                {can(actor, "lead.read") && (
                  <Link href="/admin/ai-sales" className="underline underline-offset-4">
                    {tr(A.sales.results, lang)}
                  </Link>
                )}
                {can(actor, "chat.manage") && (
                  <Link href="/admin/ai-agent" className="underline underline-offset-4">
                    {tr(A.sales.settings, lang)}
                  </Link>
                )}
              </p>
            </li>
            <li className="border border-line p-4">
              <p className="font-medium">{tr(A.marketing.name, lang)}</p>
              <p className="mt-1">
                <Badge tone="good">{tr(A.marketing.live, lang)}</Badge>
              </p>
              <p className="mt-2 text-sm text-ink-muted">{tr(A.marketing.about, lang)}</p>
              {can(actor, "marketing.manage") && (
                <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
                  <Link href="/admin/marketing" className="underline underline-offset-4">
                    {tr(A.marketing.prospects, lang)}
                  </Link>
                  <Link href="/admin/marketing/campaigns" className="underline underline-offset-4">
                    {tr(A.marketing.campaigns, lang)}
                  </Link>
                  <Link href="/admin/marketing/reports" className="underline underline-offset-4">
                    {tr(A.marketing.report, lang)}
                  </Link>
                </p>
              )}
            </li>
            <li className="border border-line p-4">
              <p className="font-medium">{tr(A.social.name, lang)}</p>
              <p className="mt-1">
                <Badge tone="good">{tr(A.social.live, lang)}</Badge>
              </p>
              <p className="mt-2 text-sm text-ink-muted">{tr(A.social.about, lang)}</p>
              {can(actor, "social.manage") && (
                <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
                  <Link href="/admin/social" className="underline underline-offset-4">
                    {tr(A.social.calendar, lang)}
                  </Link>
                  <Link href="/admin/social/plan" className="underline underline-offset-4">
                    {tr(A.social.plan, lang)}
                  </Link>
                  <Link href="/admin/social/performance" className="underline underline-offset-4">
                    {tr(A.social.performance, lang)}
                  </Link>
                </p>
              )}
            </li>
            {([["analytics", 7]] as const).map(([key, stage]) => (
              <li key={key} className="border border-dashed border-line p-4">
                <p className="font-medium">{tr(A[key].name, lang)}</p>
                <p className="mt-1">
                  <Badge>
                    {tr(A.planned, lang)} {stage}
                  </Badge>
                </p>
                <p className="mt-2 text-sm text-ink-muted">{tr(A[key].about, lang)}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <section className="mt-10" aria-labelledby="modules">
        <h2 id="modules" className="font-display text-2xl">
          {tr(T.modules, lang)}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">{tr(T.modulesHint, lang)}</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((m, i) => {
            const allowed = m.href && (!m.permission || can(actor, m.permission));
            return (
              <li key={m.key}>
                {allowed ? (
                  <Link
                    href={m.href!}
                    className="flex min-h-16 items-center justify-between gap-3 border border-line bg-white px-4 py-3 transition-colors hover:border-walnut"
                  >
                    <span>
                      <span className="me-2 text-xs text-ink-muted tabular-nums">{i + 1}.</span>
                      {tr(centreText.modules[m.key], lang)}
                    </span>
                    <Badge tone="good">{tr(T.available, lang)}</Badge>
                  </Link>
                ) : (
                  <div className="flex min-h-16 items-center justify-between gap-3 border border-dashed border-line px-4 py-3 text-ink-muted">
                    <span>
                      <span className="me-2 text-xs tabular-nums">{i + 1}.</span>
                      {tr(centreText.modules[m.key], lang)}
                    </span>
                    {m.stage ? (
                      <Badge>
                        {tr(T.stage, lang)} {m.stage}
                      </Badge>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
