import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import { Badge, Empty, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { chatCopy } from "@/content/chat";
import { aiConfigured } from "@/server/ai/provider";
import { requireActor } from "@/server/auth/session";
import { chatSettings } from "@/server/chat/reply";
import { knowledgeKinds, knowledgeText, listKnowledge, loadKnowledgeSources } from "@/server/chat/knowledge";
import { whatsappAlertsConfigured } from "@/server/chat/whatsapp-alert";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { saveSettingAction } from "../settings/actions";
import { parseSetting } from "@/lib/site-settings";
import { can } from "@/server/auth/staff";
import { documentKinds, listDocuments } from "@/server/knowledge/documents";

export const metadata: Metadata = { title: "AI agent" };

const modelOptions = [
  { value: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (recommended: good answers, moderate cost)" },
  { value: "claude-haiku-5-5", label: "Claude Haiku 5.5 (cheapest, simpler answers)" },
  { value: "claude-opus-5-5", label: "Claude Opus 5.5 (most capable, about twice the cost of Sonnet)" },
];

export default async function AiAgentPage() {
  const actor = await requireActor("chat.manage");
  const canFollowUp = can(actor, "outreach.approve");
  const [settings, entries, sources, documents, followUpRow] = await Promise.all([
    chatSettings(db),
    listKnowledge(db, actor),
    loadKnowledgeSources(db),
    listDocuments(db, actor),
    db.siteSetting.findUnique({ where: { key: "salesFollowUp" } }),
  ]);
  const followUp = parseSetting("salesFollowUp", followUpRow?.value);
  const keySet = aiConfigured();
  const e = env();
  const emailReady = Boolean(e.RESEND_API_KEY && e.EMAIL_FROM);
  const serverNotify = Boolean(e.NOTIFY_EMAILS?.trim());
  const whatsappReady = whatsappAlertsConfigured(e);
  const live = settings.enabled && keySet;

  return (
    <>
      <PageHeader
        title="AI agent"
        description="GIK Smart Assistant, the sales chat on every page of the website: switch it on or off, set its instructions, and keep its knowledge up to date."
      />
      <div className="space-y-6">
        <p
          className={
            live
              ? "border-s-2 border-emerald-700 bg-emerald-50 px-4 py-3 text-sm"
              : "border-s-2 border-amber-600 bg-amber-50 px-4 py-3 text-sm"
          }
        >
          {live
            ? "The chat is on: visitors see the chat button on every page."
            : !keySet
              ? "The chat is off: the server has no Anthropic API key yet (ANTHROPIC_API_KEY in Vercel's environment variables, see docs/DEPLOYMENT.md)."
              : "The chat is off. Tick “Show the chat on the website” below to switch it on."}
        </p>

        <Panel title="Chat settings">
          <ActionForm action={saveSettingAction.bind(null, "chatAgent")} submitLabel="Save chat settings">
            <p className="text-sm text-ink-muted">
              What visitors type in the chat is sent to Anthropic (the AI provider) to write the answer. Phone
              numbers and email addresses are removed first. The assistant never states prices, dates or
              guarantees and always says it is an AI.
            </p>
            <AdminCheckbox
              name="enabled"
              defaultChecked={settings.enabled}
              label="Show the chat on the website"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminSelect
                label="AI model"
                name="model"
                defaultValue={settings.model}
                options={modelOptions}
              />
              <AdminInput
                label="Daily message limit"
                name="dailyMessageLimit"
                type="number"
                min={20}
                max={20000}
                defaultValue={settings.dailyMessageLimit}
                hint="Most messages answered per day across the whole site. Above it, visitors are shown the team's contact details. Also set a monthly spending limit in the Anthropic console."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminTextarea
                label="Email the sales team at"
                name="notifyEmails"
                rows={3}
                dir="ltr"
                defaultValue={settings.notifyEmails.join("\n")}
                hint={
                  <>
                    One address per line. Each chat lead is emailed here with the customer&apos;s details,
                    requirements, rating and the chat summary.{" "}
                    {!emailReady
                      ? "Email sending isn’t set up on the server yet (RESEND_API_KEY and EMAIL_FROM)."
                      : settings.notifyEmails.length === 0 && serverNotify
                        ? "Empty: the server’s NOTIFY_EMAILS addresses are used."
                        : ""}
                  </>
                }
              />
              <AdminTextarea
                label="WhatsApp alerts to (prepared)"
                name="notifyWhatsApp"
                rows={3}
                dir="ltr"
                defaultValue={settings.notifyWhatsApp.join("\n")}
                hint={
                  whatsappReady
                    ? "Sales team WhatsApp numbers with the country code, one per line, e.g. 97334597636."
                    : "Sales team WhatsApp numbers with the country code. Alerts start once the WhatsApp Business account and an approved message template are set up on the server; until then nothing is sent."
                }
              />
            </div>
            <AdminTextarea
              label="Extra instructions and personality"
              name="instructions"
              rows={6}
              maxLength={4000}
              defaultValue={settings.instructions ?? ""}
              hint="Optional, in plain English. e.g. “Mention our free design consultation at the showroom.” or “Keep a formal tone.” They can't override the built-in rules (no prices, no invented facts, EGGER and painted MDF only)."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminTextarea
                label="Welcome message (English)"
                name="welcomeEn"
                rows={6}
                maxLength={800}
                defaultValue={settings.welcomeEn ?? ""}
                placeholder={chatCopy.welcome.en}
                hint="Leave empty to use the standard welcome shown here in grey."
              />
              <AdminTextarea
                label="Welcome message (Arabic)"
                name="welcomeAr"
                rows={6}
                maxLength={800}
                dir="rtl"
                lang="ar"
                defaultValue={settings.welcomeAr ?? ""}
                placeholder={chatCopy.welcome.ar}
              />
            </div>
          </ActionForm>
        </Panel>

        <Panel title={`Knowledge base (${entries.filter((e) => e.published).length} in use)`}>
          <div id="knowledge" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-sm text-ink-muted">
                Questions and answers, policies and company information the assistant may use. If an answer
                isn’t here or in the information below, the assistant says the sales team will confirm.
              </p>
              <Link
                href="/admin/ai-agent/knowledge/new"
                className="text-sm font-medium underline underline-offset-4"
              >
                Add entry
              </Link>
            </div>
            {entries.length === 0 ? (
              <Empty>No entries yet.</Empty>
            ) : (
              <Table label="Knowledge base">
                <thead>
                  <tr>
                    <Th>Question or topic</Th>
                    <Th>Type</Th>
                    <Th>Used</Th>
                    <Th>Last edited</Th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <Td className="max-w-lg">
                        <Link
                          href={`/admin/ai-agent/knowledge/${e.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {e.titleEn}
                        </Link>
                        <span className="mt-1 line-clamp-1 text-xs text-ink-muted">{e.bodyEn}</span>
                      </Td>
                      <Td>{knowledgeKinds[e.kind]}</Td>
                      <Td>{e.published ? <Badge tone="good">Yes</Badge> : <Badge>No</Badge>}</Td>
                      <Td className="text-xs text-ink-muted">{e.updatedBy?.name ?? "Initial import"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Panel>

        <Panel
          title={`Documents (${documents.filter((d) => d.status === "published" && d.kind !== "pricing").length} searched by the chat)`}
        >
          <div id="documents" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-sm text-ink-muted">
                Brochures, catalogues, product sheets and policies. For each visitor message the chat searches
                the published ones and answers from the matching passages; if nothing matches, it says the
                team will confirm. Pricing documents are never given to the chat.
              </p>
              <Link
                href="/admin/ai-agent/documents/new"
                className="text-sm font-medium underline underline-offset-4"
              >
                Upload a document
              </Link>
            </div>
            {documents.length === 0 ? (
              <Empty>No documents yet.</Empty>
            ) : (
              <Table label="Documents">
                <thead>
                  <tr>
                    <Th>Title</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>Last edited</Th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id}>
                      <Td className="max-w-lg">
                        <Link
                          href={`/admin/ai-agent/documents/${d.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {d.title}
                        </Link>
                        <span className="block text-xs text-ink-muted">{d.fileName}</span>
                      </Td>
                      <Td>{documentKinds[d.kind]}</Td>
                      <Td>
                        {d.status === "published" ? (
                          <Badge tone="good">Published · {d._count.chunks} passages</Badge>
                        ) : (
                          <Badge tone="warn">Draft: check and publish</Badge>
                        )}
                      </Td>
                      <Td className="text-xs text-ink-muted">{d.updatedBy?.name ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Panel>

        {canFollowUp && (
          <Panel title="Follow-ups for customers who stopped replying">
            <ActionForm action={saveSettingAction.bind(null, "salesFollowUp")} submitLabel="Save">
              <p className="text-sm text-ink-muted">
                When on, the daily job asks the AI to draft a follow-up email for open leads with no contact
                for the number of days below, if the customer has an email address and agreed to email. Every
                draft waits on the lead (and in Automation Centre → Approvals) until someone approves it;
                nothing is sent automatically.
              </p>
              <AdminCheckbox
                name="autoDraft"
                defaultChecked={followUp.autoDraft}
                label="Draft follow-ups automatically"
              />
              <AdminInput
                label="After how many days without contact"
                name="afterDays"
                type="number"
                min={2}
                max={60}
                defaultValue={followUp.afterDays}
              />
              {(!emailReady || !keySet) && (
                <p className="text-xs text-amber-900">
                  Needs{" "}
                  {[!keySet && "the Claude API key", !emailReady && "email sending (Resend)"]
                    .filter(Boolean)
                    .join(" and ")}{" "}
                  on the server, and the AI assistants switched on in Settings. Until then no drafts are made.
                </p>
              )}
            </ActionForm>
          </Panel>
        )}

        <Panel title="Also used by the assistant (edited elsewhere)">
          <ul className="list-disc space-y-1 ps-5 text-sm">
            <li>
              Phone numbers, email, WhatsApp, showroom and office addresses and opening hours:{" "}
              <Link href="/admin/settings" className="underline underline-offset-4">
                Settings
              </Link>
            </li>
            <li>
              Product categories and products (published ones):{" "}
              <Link href="/admin/categories" className="underline underline-offset-4">
                Manage categories
              </Link>
            </li>
            <li>
              Finishes (published and checked ones):{" "}
              <Link href="/admin/materials" className="underline underline-offset-4">
                Materials
              </Link>
            </li>
            <li>
              The materials rule (EGGER laminate/melamine and painted MDF only) and the company profile facts.
            </li>
          </ul>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium">Show everything the assistant knows</summary>
            <pre className="mt-3 max-h-[32rem] overflow-auto border border-line bg-white p-4 text-xs whitespace-pre-wrap">
              {knowledgeText(sources)}
            </pre>
          </details>
        </Panel>
      </div>
    </>
  );
}
