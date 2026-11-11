import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDateTime, PageHeader, Panel } from "@/components/admin/ui";
import { CUID } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { ResultView } from "../../result-view";

export const metadata: Metadata = { title: "Answer" };

export default async function AnswerPage({ params }: PageProps<"/admin/analytics/ask/[id]">) {
  await requireActor("analytics.read");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  const q = await db.analyticsQuestion.findUnique({
    where: { id },
    include: { askedBy: { select: { name: true } } },
  });
  if (!q) notFound();
  const results = (Array.isArray(q.results) ? q.results : []) as Record<string, never>[];

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/analytics/ask" className="underline underline-offset-4">
          ← Ask another question
        </Link>
      </p>
      <PageHeader
        title="Answer"
        description={`Asked by ${q.askedBy?.name ?? "—"} on ${fmtDateTime(q.createdAt)}. Figures as counted then.`}
      />
      <Panel title="Question">
        <p className="text-sm" dir="auto">
          {q.question}
        </p>
      </Panel>
      <Panel title="Answer" className="mt-6">
        <p className="text-sm whitespace-pre-wrap" dir="auto">
          {q.answer}
        </p>
        <p className="mt-3 text-xs text-ink-muted">
          Written by the AI from the figures below only. Check any number against them.
        </p>
      </Panel>
      <Panel title="Figures used" className="mt-6">
        {results.length === 0 ? (
          <p className="text-sm text-ink-muted">No query matched this question.</p>
        ) : (
          <div className="space-y-8">
            {results.map((r, i) => (
              <ResultView key={i} result={r} />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
