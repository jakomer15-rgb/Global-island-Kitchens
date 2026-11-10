import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/action-form";
import { Badge, PageHeader, type Tone } from "@/components/admin/ui";
import { centreText, fmtCentreDateTime, tr } from "@/content/automation-centre";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { integrationOverview, type IntegrationStatus } from "@/server/automation/integrations";
import { deliveryHealth } from "@/server/automation/logs";
import { db } from "@/server/db";
import { testIntegrationAction } from "../actions";
import { getCentreLang } from "../lang";

export const metadata: Metadata = { title: "Integrations · Automation Centre" };

const statusTone: Record<IntegrationStatus, Tone> = {
  planned: "neutral",
  awaiting_credentials: "warn",
  configured: "info",
  connected: "good",
  error: "bad",
};

export default async function IntegrationsPage() {
  const actor = await requireActor("automation.read");
  const lang = await getCentreLang();
  const [list, health] = await Promise.all([integrationOverview(db, actor), deliveryHealth(db, actor)]);
  const T = centreText.integrations;
  const mayTest = can(actor, "integrations.manage");

  return (
    <>
      <PageHeader title={tr(centreText.nav.integrations, lang)} description={tr(T.description, lang)} />
      <ul className="grid gap-4 lg:grid-cols-2">
        {list.map((i) => {
          const info = centreText.integrationInfo[i.key];
          return (
            <li key={i.key} className="flex flex-col border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-medium">{tr(info.name, lang)}</h2>
                <Badge tone={statusTone[i.status]}>{tr(T.status[i.status], lang)}</Badge>
              </div>
              <p className="mt-2 text-sm text-ink-muted">{tr(info.purpose, lang)}</p>

              {i.status === "planned" ? (
                <p className="mt-3 text-sm">
                  {i.plannedStage === "future"
                    ? tr(T.future, lang)
                    : `${tr(T.plannedFor, lang)} ${i.plannedStage}`}
                </p>
              ) : (
                <>
                  <h3 className="mt-4 text-xs font-medium text-ink-muted">{tr(T.settings, lang)}</h3>
                  <ul className="mt-1 space-y-1 text-xs">
                    {i.envVars.map((v) => {
                      const set = i.setVars.includes(v);
                      return (
                        <li key={v} className="flex flex-wrap items-center gap-2">
                          <code dir="ltr" className="bg-sand px-1.5 py-0.5">
                            {v}
                          </code>
                          <span className={set ? "text-emerald-900" : "text-ink-muted"}>
                            {set ? "✓ " : "○ "}
                            {tr(set ? T.set : T.missing, lang)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {i.key === "n8n" || i.key === "cron" ? (
                    <p className="mt-3 text-sm">
                      {i.key === "n8n" ? tr(T.lastN8n, lang) : tr(T.lastRun, lang)}:{" "}
                      {(i.key === "n8n" ? health.lastN8nAt : health.lastProcessedAt)
                        ? fmtCentreDateTime(
                            (i.key === "n8n" ? health.lastN8nAt : health.lastProcessedAt)!,
                            lang,
                          )
                        : tr(T.never, lang)}
                      <span className="block text-xs text-ink-muted">{tr(T.noTest, lang)}</span>
                    </p>
                  ) : (
                    i.last && (
                      <p className="mt-3 text-sm">
                        <span className="text-ink-muted">
                          {tr(T.lastTest, lang)} · {fmtCentreDateTime(i.last.createdAt, lang)}:
                        </span>{" "}
                        <span dir="ltr" className={i.last.ok ? "text-emerald-900" : "text-red-800"}>
                          {i.last.message}
                        </span>
                      </p>
                    )
                  )}

                  {mayTest && i.testable && (
                    <div className="mt-auto pt-4">
                      <ActionForm
                        action={testIntegrationAction.bind(null, i.key)}
                        submitLabel={tr(T.test, lang)}
                        pendingLabel={tr(T.testing, lang)}
                        variant="outline"
                        inline
                      />
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
