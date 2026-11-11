import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { AdminInput, AdminTextarea } from "@/components/admin/fields";
import { Badge, fmtDateTime, PageHeader, Panel, type Tone } from "@/components/admin/ui";
import { gccCountries, prospectTypeNames, type ProspectTypeKey } from "@/lib/prospect-score";
import { aiAvailable } from "@/server/ai/drafts";
import { CUID } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { NotFoundError } from "@/server/errors";
import {
  audienceSchema,
  audienceSize,
  campaignStatusNames,
  composeProspectEmail,
  getCampaign,
} from "@/server/marketing/campaigns";
import { emailReady } from "@/server/outreach/messages";
import {
  aiTemplateAction,
  decideCampaignAction,
  editMessageAction,
  prepareCampaignAction,
  removeMessageAction,
  reopenCampaignAction,
  saveTemplateAction,
  submitCampaignAction,
} from "../../actions";

export const metadata: Metadata = { title: "Campaign" };

const messageTone: Record<string, Tone> = {
  draft: "neutral",
  queued: "info",
  sent: "good",
  failed: "bad",
  skipped: "neutral",
};

export default async function CampaignPage({ params }: PageProps<"/admin/marketing/campaigns/[id]">) {
  const actor = await requireActor("marketing.manage");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  let c;
  try {
    c = await getCampaign(db, actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const audience = audienceSchema.parse(c.audience);
  const draft = c.status === "draft";
  const [reach, aiOn] = await Promise.all([
    draft ? audienceSize(db, actor, audience) : Promise.resolve(null),
    can(actor, "ai.use") ? aiAvailable(db, "contentAssistant") : Promise.resolve(false),
  ]);
  const canApprove = can(actor, "outreach.approve");
  const mailReady = emailReady(env());
  const sample = c.messages[0];

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/marketing/campaigns" className="underline underline-offset-4">
          ← Campaigns
        </Link>
      </p>
      <PageHeader
        title={c.name}
        description={
          <>
            {c.language === "ar" ? "Arabic" : "English"} · to{" "}
            {[
              audience.type ? prospectTypeNames[audience.type as ProspectTypeKey] : "any type",
              audience.country
                ? gccCountries[audience.country as keyof typeof gccCountries]
                : "any GCC country",
              audience.priority ? `${audience.priority} priority` : null,
              audience.status ?? "new, contacted or interested",
            ]
              .filter(Boolean)
              .join(" · ")}{" "}
            <Badge tone={c.status === "sent" ? "good" : c.status === "pending_approval" ? "warn" : "neutral"}>
              {campaignStatusNames[c.status]}
            </Badge>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="1. The email">
            <p className="mb-3 text-sm text-ink-muted">Brief: {c.brief}</p>
            {draft ? (
              <>
                {aiOn && (
                  <ActionForm
                    action={aiTemplateAction.bind(null, c.id)}
                    submitLabel="Write it with AI"
                    pendingLabel="Writing…"
                    variant="outline"
                    className="mb-4"
                  />
                )}
                <ActionForm action={saveTemplateAction.bind(null, c.id)} submitLabel="Save email">
                  <AdminInput
                    label="Subject"
                    name="subjectTemplate"
                    required
                    maxLength={200}
                    defaultValue={c.subjectTemplate ?? ""}
                    dir="auto"
                  />
                  <AdminTextarea
                    label="Email"
                    name="bodyTemplate"
                    rows={10}
                    required
                    maxLength={5000}
                    dir="auto"
                    defaultValue={c.bodyTemplate ?? ""}
                    hint="{company}, {contact}, {area} and {type} are filled in for each business. The greeting, signature, why they're receiving it and an unsubscribe link are added automatically."
                  />
                </ActionForm>
              </>
            ) : (
              <p className="text-sm">Each email is listed below.</p>
            )}
          </Panel>

          <Panel title={`2. The emails (${c.messages.length})`}>
            {draft && (
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <ActionForm
                  action={prepareCampaignAction.bind(null, c.id)}
                  submitLabel={c.messages.length ? "Prepare again" : "Prepare the emails"}
                  pendingLabel="Preparing…"
                  variant="outline"
                  inline
                />
                <span className="text-sm text-ink-muted">
                  {reach} prospect(s) match now (at most 100 per campaign).
                </span>
              </div>
            )}
            {sample && (
              <details className="mb-4 text-sm">
                <summary className="cursor-pointer font-medium">How the first email will look</summary>
                <pre
                  className="mt-2 border border-line bg-white p-3 font-sans text-sm whitespace-pre-wrap"
                  dir="auto"
                >
                  {`Subject: ${sample.subject}\n\n${composeProspectEmail(sample.body, { id: sample.prospect.id, companyName: sample.prospect.companyName, contactName: sample.prospect.contactName }, c.language)}`}
                </pre>
              </details>
            )}
            <ul className="space-y-3">
              {c.messages.map((m) => (
                <li key={m.id} className="border border-line p-3 text-sm">
                  <p className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <Link href={`/admin/marketing/${m.prospect.id}`} className="font-medium underline">
                        {m.prospect.companyName}
                      </Link>{" "}
                      <span className="text-xs text-ink-muted">
                        {m.prospect.email} · score {m.prospect.score}
                      </span>
                    </span>
                    <Badge tone={messageTone[m.status]}>
                      {m.status}
                      {m.sentAt ? ` ${fmtDateTime(m.sentAt)}` : ""}
                    </Badge>
                  </p>
                  {draft ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs underline">Edit or remove</summary>
                      <ActionForm
                        action={editMessageAction.bind(null, m.id, c.id)}
                        submitLabel="Save"
                        className="mt-2"
                      >
                        <AdminInput
                          label="Subject"
                          name="subject"
                          defaultValue={m.subject}
                          maxLength={200}
                          required
                          dir="auto"
                        />
                        <AdminTextarea
                          label="Email"
                          name="body"
                          defaultValue={m.body}
                          rows={6}
                          maxLength={5000}
                          required
                          dir="auto"
                        />
                      </ActionForm>
                      <ActionForm
                        action={removeMessageAction.bind(null, m.id, c.id)}
                        submitLabel="Remove from campaign"
                        variant="outline"
                        className="mt-2"
                      />
                    </details>
                  ) : (
                    <p className="mt-1 text-xs text-ink-muted" dir="auto">
                      {m.subject}
                    </p>
                  )}
                  {m.error && <p className="mt-1 text-xs text-red-800">{m.error}</p>}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="3. Approval">
            {c.status === "draft" && (
              <>
                <p className="mb-3 text-sm">When every email is right, send the campaign for approval.</p>
                <ActionForm action={submitCampaignAction.bind(null, c.id)} submitLabel="Send for approval" />
              </>
            )}
            {c.status === "pending_approval" && (
              <>
                <p className="mb-3 text-sm">
                  Waiting for approval
                  {canApprove
                    ? ": check the emails, then approve or reject."
                    : " by the owner or general manager."}
                </p>
                {canApprove && (
                  <div className="space-y-3">
                    {!mailReady && (
                      <p className="text-xs text-amber-900">
                        Email sending isn&apos;t set up yet (Resend), so the campaign can&apos;t be approved.
                      </p>
                    )}
                    <ActionForm
                      action={decideCampaignAction.bind(null, c.id)}
                      submitLabel={`Approve and send ${c.messages.length} email(s)`}
                      pendingLabel="Approving…"
                      confirm={`Send ${c.messages.length} email(s) from ${c.name}? This can't be undone.`}
                    >
                      <input type="hidden" name="decision" value="approve" />
                    </ActionForm>
                    <ActionForm
                      action={decideCampaignAction.bind(null, c.id)}
                      submitLabel="Reject"
                      variant="outline"
                    >
                      <input type="hidden" name="decision" value="reject" />
                      <AdminInput label="Reason (optional)" name="note" maxLength={300} />
                    </ActionForm>
                  </div>
                )}
                <ActionForm
                  action={reopenCampaignAction.bind(null, c.id)}
                  submitLabel="Back to draft"
                  variant="outline"
                  className="mt-3"
                />
              </>
            )}
            {c.status === "rejected" && (
              <>
                <p className="mb-3 text-sm">
                  Rejected{c.decidedBy ? ` by ${c.decidedBy.name}` : ""}
                  {c.decisionNote ? `: ${c.decisionNote}` : "."}
                </p>
                <ActionForm
                  action={reopenCampaignAction.bind(null, c.id)}
                  submitLabel="Back to draft to change it"
                  variant="outline"
                />
              </>
            )}
            {(c.status === "approved" || c.status === "sent") && (
              <p className="text-sm">
                Approved{c.decidedBy ? ` by ${c.decidedBy.name}` : ""} on{" "}
                {c.decidedAt ? fmtDateTime(c.decidedAt) : "—"}.{" "}
                {c.status === "approved"
                  ? "Emails are sent 20 at a time (right after approval and at each run of the scheduled job)."
                  : "All emails have been handled."}
              </p>
            )}
          </Panel>
          <Panel title="Rules">
            <ul className="list-disc space-y-1 ps-5 text-xs text-ink-muted">
              <li>
                Business addresses only; every email says who sent it and why, with an unsubscribe link.
              </li>
              <li>Prospects who unsubscribe become do-not-contact and are never emailed again.</li>
              <li>No prices, discounts, dates or guarantees the team hasn&apos;t approved.</li>
              <li>
                WhatsApp introductions aren&apos;t sent: WhatsApp only allows messages to people who opted in.
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
