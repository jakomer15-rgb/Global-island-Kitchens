import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  fmtDateTime,
  label,
  leadStatusTone,
  PageHeader,
  Panel,
  TemperatureBadge,
} from "@/components/admin/ui";
import { CUID } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { estimateCost, getChat } from "@/server/chat/admin";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";

export const metadata: Metadata = { title: "Conversation" };

const languageName: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  hi: "Hindi",
  ur: "Urdu",
  other: "Other",
};
const requirementLabels: [string, string][] = [
  ["productCategory", "Product"],
  ["dimensions", "Dimensions"],
  ["designPreferences", "Design"],
  ["materialPreferences", "Materials and colours"],
  ["location", "Location"],
  ["budget", "Budget"],
  ["timeline", "Timeline"],
];

export default async function ChatPage({ params }: PageProps<"/admin/ai-sales/chats/[id]">) {
  const actor = await requireActor("lead.read");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  const chat = await getChat(db, actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const r = (chat.requirements ?? {}) as Record<string, string | null>;
  const canFiles = can(actor, "file.read");

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/ai-sales" className="underline underline-offset-4">
          ← AI sales
        </Link>
      </p>
      <PageHeader
        title={chat.lead ? `Conversation · ${chat.lead.customer.name}` : "Conversation (anonymous)"}
        description={
          <>
            Started {fmtDateTime(chat.startedAt)} · last message {fmtDateTime(chat.lastMessageAt)} ·{" "}
            {chat.messageCount} messages
            {chat.language ? ` · ${languageName[chat.language] ?? chat.language}` : ""} · page in{" "}
            {chat.locale === "ar" ? "Arabic" : "English"}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Transcript" className="xl:col-span-2">
          <p className="mb-4 text-xs text-ink-muted">
            Phone numbers and emails typed into messages were removed before saving. Details sent through the
            chat’s contact form are on the lead.
          </p>
          <ol className="space-y-3">
            {chat.messages.map((m) =>
              m.role === "event" ? (
                <li key={m.id} className="text-center text-xs text-ink-muted">
                  — {m.content} ({fmtDateTime(m.createdAt)}) —
                </li>
              ) : (
                <li key={m.id} className={m.role === "user" ? "flex justify-end" : "flex"}>
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[85%] bg-espresso px-3.5 py-2.5 text-sm text-ivory"
                        : "max-w-[85%] border border-line bg-ivory px-3.5 py-2.5 text-sm"
                    }
                  >
                    <p className="mb-1 text-[0.7rem] opacity-70">
                      {m.role === "user" ? "Visitor" : "Assistant"} · {fmtDateTime(m.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap" dir="auto">
                      {m.content}
                    </p>
                  </div>
                </li>
              ),
            )}
          </ol>
        </Panel>

        <div className="space-y-6">
          <Panel title="Lead">
            {chat.lead ? (
              <div className="space-y-1 text-sm">
                <p>
                  <Link href={`/admin/leads/${chat.lead.id}`} className="font-mono font-medium underline">
                    {chat.lead.reference}
                  </Link>{" "}
                  <Badge tone={leadStatusTone[chat.lead.status]}>{label(chat.lead.status)}</Badge>{" "}
                  <TemperatureBadge value={chat.lead.temperature} />
                </p>
                <p className="font-medium">{chat.lead.customer.name}</p>
                {chat.lead.customer.phone && (
                  <a href={`tel:${chat.lead.customer.phone}`} className="block underline" dir="ltr">
                    {chat.lead.customer.phone}
                  </a>
                )}
                {chat.lead.customer.email && (
                  <a href={`mailto:${chat.lead.customer.email}`} className="block break-all underline">
                    {chat.lead.customer.email}
                  </a>
                )}
                <p className="text-xs text-ink-muted">
                  Assigned to {chat.lead.assignedTo?.name ?? "nobody yet"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                The visitor didn’t leave contact details, so there is no lead and no way to contact them.
              </p>
            )}
          </Panel>

          <Panel title="The assistant’s reading">
            {chat.analysedAt ? (
              <>
                <p className="flex items-center gap-2 text-sm">
                  <TemperatureBadge value={chat.temperature} />
                  <span className="text-xs text-ink-muted">{chat.temperatureNote}</span>
                </p>
                {chat.summary && <p className="mt-3 text-sm">{chat.summary}</p>}
                <dl className="mt-3 grid gap-2 text-sm">
                  {requirementLabels.map(([key, title]) => (
                    <div key={key} className="grid grid-cols-[9rem_1fr] gap-2">
                      <dt className="text-ink-muted">{title}</dt>
                      <dd>{r[key] ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-ink-muted">
                  Read {fmtDateTime(chat.analysedAt)} by the AI assistant: check with the customer.
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                Not read yet. The assistant reads a conversation every second visitor message.
              </p>
            )}
          </Panel>

          {chat.files.length > 0 && (
            <Panel title="Reference photos">
              <ul className="space-y-1 text-sm">
                {chat.files.map((f) => (
                  <li key={f.id}>
                    {canFiles ? (
                      <a href={`/admin/files/${f.id}`} className="underline">
                        {f.originalName}
                      </a>
                    ) : (
                      f.originalName
                    )}{" "}
                    <span className="text-ink-muted">({Math.ceil(f.sizeBytes / 1024)} KB)</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="AI usage">
            <p className="text-sm">
              ≈ US$ {estimateCost([chat]).toFixed(3)} · {chat.model ?? "no model yet"}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {chat.inputTokens.toLocaleString("en")} input, {chat.cacheReadTokens.toLocaleString("en")}{" "}
              cached, {chat.outputTokens.toLocaleString("en")} output tokens.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
