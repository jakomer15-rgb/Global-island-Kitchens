import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { CUID } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { getKnowledge } from "@/server/chat/knowledge";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { deleteKnowledgeAction } from "../../actions";
import { KnowledgeForm } from "../../knowledge-form";

export const metadata: Metadata = { title: "Knowledge entry" };

export default async function KnowledgeEntryPage({ params }: PageProps<"/admin/ai-agent/knowledge/[id]">) {
  const actor = await requireActor("chat.manage");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  const entry = await getKnowledge(db, actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/ai-agent#knowledge" className="underline underline-offset-4">
          ← AI agent
        </Link>
      </p>
      <PageHeader title={entry.titleEn} />
      <Panel>
        <KnowledgeForm entry={entry} />
      </Panel>
      <Panel title="Delete" className="mt-6 max-w-xl">
        <p className="mb-3 text-sm text-ink-muted">
          Unticking “The assistant may use this entry” keeps it for later; deleting removes it for good.
        </p>
        <ActionForm
          action={deleteKnowledgeAction.bind(null, entry.id)}
          submitLabel="Delete entry"
          variant="outline"
          confirm="Delete this entry?"
        />
      </Panel>
    </>
  );
}
