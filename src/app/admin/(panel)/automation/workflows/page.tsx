import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput } from "@/components/admin/fields";
import { adminInput, Badge, Empty, PageHeader, Panel, Table, Td, Th, type Tone } from "@/components/admin/ui";
import { centreText, fmtCentreDateTime, tr, trOr } from "@/content/automation-centre";
import { workflowTextAr } from "@/content/workflows-ar";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { db } from "@/server/db";
import { workflowOverview, workflowRuns } from "@/server/workflows/registry";
import { runWorkflowAction, saveWorkflowAction } from "../actions";
import { getCentreLang } from "../lang";

export const metadata: Metadata = { title: "Workflows · Automation Centre" };

const runTone: Record<string, Tone> = { succeeded: "good", failed: "bad", skipped: "neutral" };
const pick = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function WorkflowsPage({ searchParams }: PageProps<"/admin/automation/workflows">) {
  const actor = await requireActor("automation.read");
  const lang = await getCentreLang();
  const sp = await searchParams;
  const filters = {
    workflow: pick(sp.workflow),
    status: pick(sp.status),
    page: Number(pick(sp.page) ?? 1) || 1,
  };
  const [list, runs] = await Promise.all([workflowOverview(db, actor), workflowRuns(db, actor, filters)]);
  const manage = can(actor, "workflows.manage");
  const T = centreText.workflows;
  const ar = lang === "ar";

  return (
    <>
      <PageHeader title={tr(centreText.nav.workflows, lang)} description={tr(T.description, lang)} />

      <ol className="space-y-4">
        {list.map((w, i) => {
          const text = ar ? workflowTextAr[w.key] : undefined;
          const status = w.notBuilt
            ? { tone: "warn" as Tone, label: tr(T.partly, lang) }
            : !w.switchable
              ? { tone: "good" as Tone, label: tr(T.always, lang) }
              : w.enabled
                ? { tone: "good" as Tone, label: tr(T.on, lang) }
                : { tone: "neutral" as Tone, label: tr(T.off, lang) };
          const booleans = w.configFields.filter((f) => f.type === "boolean").map((f) => f.name);
          return (
            <li key={w.key} id={w.key}>
              <Panel>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="font-display text-xl">
                    <span className="me-2 text-sm text-ink-muted tabular-nums">{i + 1}.</span>
                    {trOr(T.names, w.key, lang)}
                  </h2>
                  <span className="flex flex-wrap gap-2">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {w.needs.length > 0 && <Badge tone="warn">{tr(T.notSetUp, lang)}</Badge>}
                  </span>
                </div>
                <div className="mt-3 grid gap-4 lg:grid-cols-3">
                  <div className="space-y-2 text-sm lg:col-span-2">
                    <p>
                      <span className="text-ink-muted">{tr(T.trigger, lang)}: </span>
                      {text?.trigger ?? w.trigger}
                    </p>
                    <div>
                      <p className="text-ink-muted">{tr(T.steps, lang)}:</p>
                      <ol className="list-decimal space-y-0.5 ps-5">
                        {(text?.steps ?? w.steps).map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                    </div>
                    {w.notBuilt && (
                      <p className="border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                        {tr(T.notBuilt, lang)}: {text?.notBuilt ?? w.notBuilt}
                      </p>
                    )}
                    {w.needs.length > 0 && (
                      <p className="text-xs text-amber-900">
                        {tr(T.needs, lang)}: <span dir="ltr">{w.needs.join(" · ")}</span>
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 text-xs text-ink-muted">
                    {w.everyMinutes && (
                      <p>
                        {tr(T.every, lang)} {w.everyMinutes} {tr(T.minutes, lang)} · {tr(T.lastChecked, lang)}
                        : {w.lastCheckedAt ? fmtCentreDateTime(w.lastCheckedAt, lang) : tr(T.never, lang)}
                      </p>
                    )}
                    <p>
                      {tr(T.lastRun, lang)}:{" "}
                      {w.lastRun ? (
                        <>
                          {fmtCentreDateTime(new Date(w.lastRun.startedAt), lang)}{" "}
                          <Badge tone={runTone[w.lastRun.status]}>
                            {trOr(T.statuses, w.lastRun.status, lang)}
                          </Badge>
                        </>
                      ) : (
                        tr(T.never, lang)
                      )}
                    </p>
                    <p>
                      {tr(T.last7, lang)}: {w.runs7.succeeded} {tr(T.succeeded, lang)} · {w.runs7.failed}{" "}
                      {tr(T.failed, lang)}
                      {w.events7 &&
                        ` · ${w.events7.done} ${tr(T.delivered, lang)} · ${w.events7.pending} ${tr(T.waiting, lang)} · ${w.events7.failed} ${tr(T.failed, lang)}`}
                    </p>
                  </div>
                </div>
                {manage && (w.switchable || w.canRun) && (
                  <div className="mt-4 flex flex-wrap items-end gap-6 border-t border-line pt-4">
                    {w.switchable && (
                      <ActionForm
                        action={saveWorkflowAction.bind(null, w.key)}
                        submitLabel={tr(T.save, lang)}
                        variant="outline"
                        inline
                      >
                        <input type="hidden" name="booleans" value={booleans.join(",")} />
                        <AdminCheckbox
                          name="enabled"
                          defaultChecked={w.enabled}
                          label={tr(T.switchOn, lang)}
                        />
                        {w.configFields.map((f) =>
                          f.type === "boolean" ? (
                            <AdminCheckbox
                              key={f.name}
                              name={`cfg_${f.name}`}
                              defaultChecked={w.config[f.name] !== false}
                              label={text?.fields?.[f.name] ?? f.label}
                            />
                          ) : (
                            <AdminInput
                              key={f.name}
                              label={text?.fields?.[f.name] ?? f.label}
                              name={`cfg_${f.name}`}
                              type="number"
                              min={f.min}
                              max={f.max}
                              required
                              defaultValue={String(w.config[f.name] ?? f.min ?? "")}
                              className="w-48"
                            />
                          ),
                        )}
                      </ActionForm>
                    )}
                    {w.canRun && (
                      <ActionForm
                        action={runWorkflowAction.bind(null, w.key, null)}
                        submitLabel={tr(T.runNow, lang)}
                        pendingLabel={tr(T.running, lang)}
                        variant="outline"
                        inline
                      />
                    )}
                  </div>
                )}
              </Panel>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title={tr(T.timerTitle, lang)}>
          <p className="text-sm">{tr(T.timer, lang)}</p>
        </Panel>
        <Panel title={tr(T.n8nTitle, lang)}>
          <p className="text-sm">{tr(T.n8n, lang)}</p>
        </Panel>
      </div>

      <section className="mt-10" aria-labelledby="runs">
        <h2 id="runs" className="font-display text-2xl">
          {tr(T.runs, lang)}
        </h2>
        <form method="get" className="my-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            {tr(T.workflow, lang)}
            <select name="workflow" defaultValue={filters.workflow ?? ""} className={adminInput}>
              <option value="">—</option>
              {list.map((w) => (
                <option key={w.key} value={w.key}>
                  {trOr(T.names, w.key, lang)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {tr(T.status, lang)}
            <select name="status" defaultValue={filters.status ?? ""} className={adminInput}>
              <option value="">—</option>
              {["succeeded", "failed", "skipped"].map((s) => (
                <option key={s} value={s}>
                  {trOr(T.statuses, s, lang)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-10 bg-charcoal px-4 text-sm font-medium text-ivory">
            {tr(centreText.logs.filter, lang)}
          </button>
        </form>
        {runs.items.length === 0 ? (
          <Empty>{tr(T.noRuns, lang)}</Empty>
        ) : (
          <Table label={tr(T.runs, lang)}>
            <thead>
              <tr>
                <Th>{tr(T.started, lang)}</Th>
                <Th>{tr(T.workflow, lang)}</Th>
                <Th>{tr(T.by, lang)}</Th>
                <Th>{tr(T.status, lang)}</Th>
                <Th>{tr(T.result, lang)}</Th>
              </tr>
            </thead>
            <tbody>
              {runs.items.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">{fmtCentreDateTime(r.startedAt, lang)}</Td>
                  <Td>
                    <Link href={`#${r.workflow}`} className="underline-offset-4 hover:underline">
                      {trOr(T.names, r.workflow, lang)}
                    </Link>
                  </Td>
                  <Td>
                    {trOr(T.triggers, r.trigger, lang)}
                    {r.triggeredBy ? ` · ${r.triggeredBy.name}` : ""}
                  </Td>
                  <Td>
                    <Badge tone={runTone[r.status]}>{trOr(T.statuses, r.status, lang)}</Badge>
                  </Td>
                  <Td className="text-xs">
                    <span dir="ltr">
                      {r.error ??
                        Object.entries((r.result ?? {}) as Record<string, unknown>)
                          .filter(([, v]) => v !== null && typeof v !== "object")
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                    </span>
                    {manage && r.status === "failed" && (
                      <ActionForm
                        action={runWorkflowAction.bind(null, r.workflow, r.id)}
                        submitLabel={tr(T.runAgain, lang)}
                        pendingLabel={tr(T.running, lang)}
                        variant="outline"
                        className="mt-1"
                      />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {runs.pages > 1 && (
          <p className="mt-3 flex gap-4 text-sm">
            {runs.page > 1 && (
              <Link
                href={`?${new URLSearchParams({ ...(filters.workflow ? { workflow: filters.workflow } : {}), ...(filters.status ? { status: filters.status } : {}), page: String(runs.page - 1) })}`}
                className="underline"
              >
                {tr(centreText.logs.previous, lang)}
              </Link>
            )}
            <span>
              {tr(centreText.logs.page, lang)} {runs.page} {tr(centreText.logs.of, lang)} {runs.pages}
            </span>
            {runs.page < runs.pages && (
              <Link
                href={`?${new URLSearchParams({ ...(filters.workflow ? { workflow: filters.workflow } : {}), ...(filters.status ? { status: filters.status } : {}), page: String(runs.page + 1) })}`}
                className="underline"
              >
                {tr(centreText.logs.next, lang)}
              </Link>
            )}
          </p>
        )}
      </section>
    </>
  );
}
