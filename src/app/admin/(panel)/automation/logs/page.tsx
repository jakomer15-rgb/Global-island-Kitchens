import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { ActionForm } from "@/components/admin/action-form";
import {
  adminInput,
  Badge,
  Empty,
  PageHeader,
  Panel,
  StatCard,
  Table,
  Td,
  Th,
  type Tone,
} from "@/components/admin/ui";
import { centreText, fmtCentreDateTime, tr, trOr } from "@/content/automation-centre";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import {
  deliveryHealth,
  listDeliveries,
  outboxStatuses,
  recentIntegrationChecks,
} from "@/server/automation/logs";
import { db } from "@/server/db";
import { retryDeliveryAction } from "../actions";
import { getCentreLang } from "../lang";

export const metadata: Metadata = { title: "System log · Automation Centre" };

const filtersSchema = z.object({
  status: z.enum(outboxStatuses).optional().catch(undefined),
  type: z
    .string()
    .regex(/^[a-z_.]{1,60}$/)
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().positive().max(10_000).optional().catch(undefined),
});

const statusTone: Record<string, Tone> = { pending: "info", processing: "info", done: "good", failed: "bad" };
const integrationNames = Object.fromEntries(
  Object.entries(centreText.integrationInfo).map(([key, info]) => [key, info.name]),
);

export default async function LogsPage({ searchParams }: PageProps<"/admin/automation/logs">) {
  const actor = await requireActor("automation.read");
  const lang = await getCentreLang();
  const raw = await searchParams;
  const filters = filtersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const [list, health, checks] = await Promise.all([
    listDeliveries(db, actor, filters),
    deliveryHealth(db, actor),
    recentIntegrationChecks(db, actor),
  ]);
  const T = centreText.logs;
  const mayRetry = can(actor, "integrations.manage");
  const pageHref = (p: number) =>
    `?${new URLSearchParams(
      Object.entries({ status: filters.status, type: filters.type, page: String(p) }).filter(
        (e): e is [string, string] => Boolean(e[1]),
      ),
    ).toString()}`;

  return (
    <>
      <PageHeader title={tr(centreText.nav.logs, lang)} description={tr(T.description, lang)} />

      <h2 className="sr-only">{tr(T.health, lang)}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={tr(T.pending, lang)} value={health.pending} href="?status=pending" />
        <StatCard
          label={tr(T.overdue, lang)}
          value={health.overdue}
          hint={health.overdue ? tr(T.overdueHint, lang) : undefined}
        />
        <StatCard label={tr(T.failed, lang)} value={health.failed} href="?status=failed" />
      </div>

      <h2 className="mt-10 mb-4 font-display text-2xl">{tr(T.deliveries, lang)}</h2>
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3 border border-line bg-white p-4">
        <label className="text-xs font-medium text-ink-muted">
          {tr(T.event, lang)}
          <select name="type" defaultValue={filters.type ?? ""} className={adminInput} dir="ltr">
            <option value="">{tr(T.allTypes, lang)}</option>
            {list.types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink-muted">
          {tr(T.status, lang)}
          <select name="status" defaultValue={filters.status ?? ""} className={adminInput}>
            <option value="">{tr(T.allStatuses, lang)}</option>
            {outboxStatuses.map((s) => (
              <option key={s} value={s}>
                {tr(T.statuses[s], lang)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-10 bg-charcoal px-4 text-sm font-medium text-ivory">
          {tr(T.filter, lang)}
        </button>
      </form>

      {list.items.length === 0 ? (
        <Empty>{tr(T.empty, lang)}</Empty>
      ) : (
        <>
          <Table label={tr(T.deliveries, lang)}>
            <thead>
              <tr>
                <Th className="text-start">{tr(T.created, lang)}</Th>
                <Th className="text-start">{tr(T.event, lang)}</Th>
                <Th className="text-start">{tr(T.status, lang)}</Th>
                <Th className="text-start">{tr(T.channels, lang)}</Th>
                <Th className="text-start">{tr(T.error, lang)}</Th>
                <Th>
                  <span className="sr-only">{tr(T.retry, lang)}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((e) => {
                const channels = Object.entries((e.result ?? {}) as Record<string, string>);
                return (
                  <tr key={e.id}>
                    <Td className="text-start whitespace-nowrap">{fmtCentreDateTime(e.createdAt, lang)}</Td>
                    <Td className="text-start">
                      <code className="text-xs" dir="ltr">
                        {e.type}
                      </code>
                    </Td>
                    <Td className="text-start">
                      <Badge tone={statusTone[e.status]}>{tr(T.statuses[e.status], lang)}</Badge>
                      <span className="block text-xs text-ink-muted">
                        {tr(T.attempts, lang)}: {e.attempts}
                      </span>
                    </Td>
                    <Td className="text-start text-xs">
                      {channels.length === 0
                        ? "—"
                        : channels.map(([channel, result]) => (
                            <span key={channel} className="block" dir="ltr">
                              {channel}: {trOr(T.channelResults, result, lang)}
                            </span>
                          ))}
                    </Td>
                    <Td className="max-w-xs text-start text-xs text-red-800">
                      <span dir="ltr">{e.lastError ?? ""}</span>
                    </Td>
                    <Td className="text-end">
                      {mayRetry && e.status === "failed" && (
                        <ActionForm
                          action={retryDeliveryAction.bind(null, e.id)}
                          submitLabel={tr(T.retry, lang)}
                          pendingLabel="…"
                          variant="outline"
                          inline
                        />
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {list.pages > 1 && (
            <nav aria-label={tr(T.page, lang)} className="mt-4 flex items-center justify-between text-sm">
              {list.page > 1 ? (
                <Link href={pageHref(list.page - 1)} className="underline underline-offset-4">
                  {tr(T.previous, lang)}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-ink-muted">
                {tr(T.page, lang)} {list.page} {tr(T.of, lang)} {list.pages}
              </span>
              {list.page < list.pages ? (
                <Link href={pageHref(list.page + 1)} className="underline underline-offset-4">
                  {tr(T.next, lang)}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}

      <Panel title={tr(T.checks, lang)} className="mt-10">
        {checks.length === 0 ? (
          <p className="text-sm text-ink-muted">{tr(T.noChecks, lang)}</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {checks.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 py-2">
                <Badge tone={c.ok ? "good" : "bad"}>{trOr(integrationNames, c.integration, lang)}</Badge>
                <span dir="ltr">{c.message}</span>
                <span className="text-xs text-ink-muted">
                  {fmtCentreDateTime(c.createdAt, lang)}
                  {c.checkedBy && ` · ${tr(T.by, lang)} ${c.checkedBy.name}`} · {c.durationMs} ms
                </span>
              </li>
            ))}
          </ul>
        )}
        {can(actor, "audit.read") && (
          <p className="mt-4 text-sm">
            <Link href="/admin/audit" className="underline underline-offset-4">
              {tr(T.audit, lang)}
            </Link>
          </p>
        )}
      </Panel>
    </>
  );
}
