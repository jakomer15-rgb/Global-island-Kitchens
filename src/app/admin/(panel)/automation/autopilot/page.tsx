import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import { Badge, Empty, PageHeader, Panel } from "@/components/admin/ui";
import { centreText, fmtCentreDateTime, tr } from "@/content/automation-centre";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { autopilotOverview } from "@/server/autopilot/admin";
import { db } from "@/server/db";
import { getCentreLang } from "../lang";
import {
  approveTemplateAction,
  saveAutopilotOptionsAction,
  stopAutopilotAction,
  turnOnAutopilotAction,
  writeTemplateAction,
} from "./actions";

export const metadata: Metadata = { title: "Autopilot · Automation Centre" };

function Needs({ items, lang }: { items: string[]; lang: "en" | "ar" }) {
  const T = centreText.autopilot;
  return items.length ? (
    <p className="text-xs text-amber-900">
      {tr(T.needs, lang)}: <span dir="ltr">{items.join(" · ")}</span>
    </p>
  ) : (
    <Badge tone="good">{tr(T.ready, lang)}</Badge>
  );
}

export default async function AutopilotPage() {
  const actor = await requireActor("automation.read");
  const lang = await getCentreLang();
  const o = await autopilotOverview(db, actor);
  const s = o.settings;
  const manage = can(actor, "workflows.manage");
  const T = centreText.autopilot;
  const t = s.prospectTemplate;

  return (
    <>
      <PageHeader title={tr(T.title, lang)} description={tr(T.description, lang)} />

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="font-display text-2xl">
            <Badge tone={s.enabled ? "good" : "neutral"}>
              {tr(s.enabled ? T.statusOn : T.statusOff, lang)}
            </Badge>
          </p>
          {manage &&
            (s.enabled ? (
              <div className="max-w-md space-y-1">
                <ActionForm
                  action={stopAutopilotAction}
                  submitLabel={tr(T.stop, lang)}
                  pendingLabel={tr(T.stopping, lang)}
                  confirm={tr(T.stopHint, lang)}
                />
                <p className="text-xs text-ink-muted">{tr(T.stopHint, lang)}</p>
              </div>
            ) : (
              <ActionForm
                action={turnOnAutopilotAction}
                submitLabel={tr(T.turnOn, lang)}
                pendingLabel={tr(T.turningOn, lang)}
              />
            ))}
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
          {[
            [T.sentByAi, o.last7.sentByAi],
            [T.prospectEmailsSent, o.last7.prospectSent],
            [T.postsScheduled, o.last7.postsScheduled],
            [T.heldForPerson, o.last7.held],
          ].map(([label, value]) => (
            <div key={tr(label as typeof T.sentByAi, "en")} className="border border-line p-3">
              <dt className="text-ink-muted">
                {tr(label as typeof T.sentByAi, lang)} · {tr(T.last7, lang)}
              </dt>
              <dd className="font-display text-2xl tabular-nums">{String(value)}</dd>
            </div>
          ))}
        </dl>
        {!manage && <p className="mt-3 text-sm text-ink-muted">{tr(T.noPermission, lang)}</p>}
      </Panel>

      {manage && (
        <Panel className="mt-6">
          <ActionForm action={saveAutopilotOptionsAction} submitLabel={tr(T.save, lang)}>
            <section className="space-y-2">
              <h2 className="font-display text-xl">{tr(T.repliesTitle, lang)}</h2>
              <p className="text-sm">{tr(T.repliesText, lang)}</p>
              <Needs items={o.needs.replies} lang={lang} />
              <div className="flex flex-wrap items-end gap-4">
                <AdminCheckbox name="replies" defaultChecked={s.replies} label={tr(T.on, lang)} />
                <AdminInput
                  label={tr(T.perDay, lang)}
                  name="customerEmailsPerDay"
                  type="number"
                  min={1}
                  max={100}
                  required
                  defaultValue={s.customerEmailsPerDay}
                  className="w-48"
                />
                <AdminInput
                  label={tr(T.followUpsPerLead, lang)}
                  name="followUpsPerLead"
                  type="number"
                  min={0}
                  max={5}
                  required
                  defaultValue={s.followUpsPerLead}
                  className="w-56"
                />
              </div>
            </section>

            <section className="space-y-2 border-t border-line pt-4">
              <h2 className="font-display text-xl">{tr(T.prospectsTitle, lang)}</h2>
              <p className="text-sm">{tr(T.prospectsText, lang)}</p>
              <p className="text-sm">
                {tr(T.prospectsWithEmail, lang)}:{" "}
                <strong className="tabular-nums">{o.prospectsWithEmail}</strong>
              </p>
              {s.prospectPausedReason && (
                <p className="border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
                  {tr(T.paused, lang)}: {s.prospectPausedReason}
                </p>
              )}
              <Needs items={o.needs.prospects} lang={lang} />
              <div className="flex flex-wrap items-end gap-4">
                <AdminCheckbox
                  name="prospectEmails"
                  defaultChecked={s.prospectEmails}
                  disabled={!t?.approvedAt}
                  label={tr(T.on, lang)}
                />
                <AdminInput
                  label={tr(T.perDay, lang)}
                  name="prospectEmailsPerDay"
                  type="number"
                  min={1}
                  max={50}
                  required
                  defaultValue={s.prospectEmailsPerDay}
                  className="w-48"
                />
              </div>
            </section>

            <section className="space-y-2 border-t border-line pt-4">
              <h2 className="font-display text-xl">{tr(T.socialTitle, lang)}</h2>
              <p className="text-sm">{tr(T.socialText, lang)}</p>
              <Needs items={o.needs.social} lang={lang} />
              <div className="flex flex-wrap items-end gap-4">
                <AdminCheckbox name="social" defaultChecked={s.social} label={tr(T.on, lang)} />
                <AdminInput
                  label={tr(T.postsPerWeek, lang)}
                  name="postsPerWeek"
                  type="number"
                  min={1}
                  max={7}
                  required
                  defaultValue={s.postsPerWeek}
                  className="w-40"
                />
                <fieldset className="flex items-end gap-4">
                  <legend className="text-sm">{tr(T.platforms, lang)}</legend>
                  <AdminCheckbox
                    name="socialPlatforms"
                    value="facebook"
                    defaultChecked={s.socialPlatforms.includes("facebook")}
                    label="Facebook"
                  />
                  <AdminCheckbox
                    name="socialPlatforms"
                    value="instagram"
                    defaultChecked={s.socialPlatforms.includes("instagram")}
                    label="Instagram"
                  />
                </fieldset>
                <AdminSelect
                  label={tr(T.captions, lang)}
                  name="socialLanguage"
                  defaultValue={s.socialLanguage}
                  options={[
                    { value: "both", label: tr(T.langBoth, lang) },
                    { value: "en", label: tr(T.langEn, lang) },
                    { value: "ar", label: tr(T.langAr, lang) },
                  ]}
                />
              </div>
            </section>

            <section className="space-y-2 border-t border-line pt-4">
              <h2 className="font-display text-xl">{tr(T.summaryTitle, lang)}</h2>
              <p className="text-sm">{tr(T.summaryText, lang)}</p>
              <AdminCheckbox name="dailySummary" defaultChecked={s.dailySummary} label={tr(T.on, lang)} />
            </section>
          </ActionForm>
        </Panel>
      )}

      {manage && (
        <Panel className="mt-6" title={tr(T.template, lang)}>
          <p className="mb-2 text-sm">
            {t?.approvedAt ? (
              <Badge tone="good">
                {tr(T.approvedBy, lang)} {t.approvedByName ?? "—"} ·{" "}
                {fmtCentreDateTime(new Date(t.approvedAt), lang)}
              </Badge>
            ) : (
              <Badge tone="warn">{tr(T.notApproved, lang)}</Badge>
            )}
          </p>
          <ActionForm action={approveTemplateAction} submitLabel={tr(T.approveTemplate, lang)}>
            <p className="text-xs text-ink-muted">{tr(T.templateHint, lang)}</p>
            <AdminSelect
              label={tr(centreText.language, lang)}
              name="language"
              defaultValue={t?.language ?? "en"}
              options={[
                { value: "en", label: tr(T.langEn, lang) },
                { value: "ar", label: tr(T.langAr, lang) },
              ]}
            />
            <AdminInput
              label={tr(T.subject, lang)}
              name="subject"
              required
              maxLength={200}
              defaultValue={t?.subject ?? ""}
              key={`s-${t?.subject ?? ""}`}
            />
            <AdminTextarea
              label={tr(T.body, lang)}
              name="body"
              rows={9}
              required
              maxLength={3000}
              defaultValue={t?.body ?? ""}
              key={`b-${t?.body ?? ""}`}
            />
          </ActionForm>
          <div className="mt-4 border-t border-line pt-4">
            <ActionForm
              action={writeTemplateAction}
              submitLabel={tr(T.aiWrite, lang)}
              pendingLabel={tr(T.aiWriting, lang)}
              variant="outline"
            >
              <AdminTextarea label={tr(T.aiBrief, lang)} name="brief" rows={2} maxLength={1000} />
              <AdminSelect
                label={tr(centreText.language, lang)}
                name="language"
                defaultValue={t?.language ?? "en"}
                options={[
                  { value: "en", label: tr(T.langEn, lang) },
                  { value: "ar", label: tr(T.langAr, lang) },
                ]}
              />
            </ActionForm>
          </div>
        </Panel>
      )}

      <Panel className="mt-6" title={tr(T.heldTitle, lang)}>
        {o.held.length === 0 ? (
          <Empty>{tr(T.heldNone, lang)}</Empty>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {o.held.map((h) => (
              <li key={`${h.kind}-${h.id}`} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{h.title}</span>
                  <span className="block text-xs text-ink-muted">
                    {fmtCentreDateTime(h.at, lang)} · <span dir="ltr">{h.reason}</span>
                  </span>
                </span>
                <Link href={h.href} className="underline underline-offset-4">
                  {tr(T.open, lang)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
