import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTextarea } from "@/components/admin/fields";
import { Empty, fmtDateTime, PageHeader, Panel } from "@/components/admin/ui";
import { aiAvailable } from "@/server/ai/drafts";
import { exampleQuestions, recentQuestions } from "@/server/analytics/ask";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { db } from "@/server/db";
import { askAction } from "../actions";

export const metadata: Metadata = { title: "Ask the analytics agent" };

export default async function AskPage() {
  const actor = await requireActor("analytics.read");
  const [aiOn, recent] = await Promise.all([
    can(actor, "ai.use") ? aiAvailable(db, "leadAssistant") : Promise.resolve(false),
    recentQuestions(db, actor),
  ]);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/analytics" className="underline underline-offset-4">
          ← Business analytics
        </Link>
      </p>
      <PageHeader
        title="Ask the analytics agent"
        description="Ask in plain words. The AI chooses which of the system's fixed reports to run, the server counts the figures from the database, and the AI answers from those figures only. Every answer shows the figures it used."
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel>
            {aiOn ? (
              <ActionForm action={askAction} submitLabel="Ask" pendingLabel="Counting and answering…">
                <AdminTextarea
                  label="Your question"
                  name="question"
                  rows={3}
                  required
                  maxLength={500}
                  dir="auto"
                  hint={`For example: ${exampleQuestions.join(" · ")}`}
                />
              </ActionForm>
            ) : (
              <p className="text-sm">
                The AI assistant is off (or you can&apos;t use it). An administrator can switch it on in
                Settings (AI drafting assistants, &quot;lead assistant&quot;) once the Claude key is set. The
                reports on{" "}
                <Link href="/admin/analytics" className="underline underline-offset-4">
                  Business analytics
                </Link>{" "}
                work without it.
              </p>
            )}
          </Panel>
        </div>
        <Panel title="What it can answer">
          <ul className="list-disc space-y-1 ps-5 text-xs text-ink-muted">
            <li>Enquiries, new customers, hot / warm / cold leads, response times and conversion.</li>
            <li>Lead sources and the products asked about.</li>
            <li>Quotations, orders, follow-ups due and quotations awaiting an answer.</li>
            <li>Social media and campaign results.</li>
            <li>
              Periods: today, yesterday, this or last week (from Saturday), this or last month, the last 7 or
              30 days.
            </li>
            <li>
              Questions about anything the system doesn&apos;t record are answered with &quot;I
              can&apos;t&quot;.
            </li>
          </ul>
        </Panel>
      </div>

      <Panel title="Recent questions" className="mt-6">
        {recent.length === 0 ? (
          <Empty>No questions yet.</Empty>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {recent.map((q) => (
              <li key={q.id} className="py-2">
                <Link
                  href={`/admin/analytics/ask/${q.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                  dir="auto"
                >
                  {q.question}
                </Link>
                <span className="block text-xs text-ink-muted">
                  {q.askedBy?.name ?? "—"} · {fmtDateTime(q.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
