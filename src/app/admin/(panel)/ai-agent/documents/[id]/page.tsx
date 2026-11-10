import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import { Badge, fmtDateTime, PageHeader, Panel } from "@/components/admin/ui";
import { CUID } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { documentKinds, getDocument, MAX_DOCUMENT_CHARS } from "@/server/knowledge/documents";
import { deleteDocumentAction, publishDocumentAction, updateDocumentAction } from "../actions";

export const metadata: Metadata = { title: "Knowledge document" };

export default async function DocumentPage({ params }: PageProps<"/admin/ai-agent/documents/[id]">) {
  const actor = await requireActor("chat.manage");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  let doc;
  try {
    doc = await getDocument(db, actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const published = doc.status === "published";

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/ai-agent#documents" className="underline underline-offset-4">
          ← AI agent
        </Link>
      </p>
      <PageHeader
        title={doc.title}
        description={
          <>
            {doc.fileName} · uploaded {fmtDateTime(doc.createdAt)}
            {doc.createdBy ? ` by ${doc.createdBy.name}` : ""} · read by{" "}
            {doc.extractedWith === "text" ? "the server (text file)" : doc.extractedWith}{" "}
            {published ? (
              <Badge tone="good">Published · {doc._count.chunks} passages</Badge>
            ) : (
              <Badge>Draft: not used by the chat</Badge>
            )}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Check and correct the text" className="xl:col-span-2">
          {doc.truncated && (
            <p className="mb-4 border-s-2 border-amber-600 bg-amber-50 px-4 py-3 text-sm">
              The reading stopped at its length limit: the end of the document may be missing. Add the rest
              below or upload the remaining pages as a second document.
            </p>
          )}
          <p className="mb-4 text-sm text-ink-muted">
            This is the text the chat will search. Check it against the original: fix anything misread, and
            remove anything the chat must not say (for example prices, discounts, delivery times or guarantees
            the team hasn&apos;t approved).
          </p>
          <ActionForm action={updateDocumentAction.bind(null, doc.id)} submitLabel="Save text">
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminInput label="Title" name="title" defaultValue={doc.title} required maxLength={200} />
              <AdminSelect
                label="Type"
                name="kind"
                defaultValue={doc.kind}
                options={Object.entries(documentKinds).map(([value, label]) => ({ value, label }))}
              />
            </div>
            <AdminTextarea
              label="Text"
              name="text"
              rows={24}
              maxLength={MAX_DOCUMENT_CHARS}
              defaultValue={doc.text}
              dir="auto"
              required
            />
          </ActionForm>
        </Panel>
        <div className="space-y-6">
          <Panel title="Use in the chat">
            {doc.kind === "pricing" ? (
              <p className="text-sm">
                Pricing documents are kept for the team but never given to the chat: the assistant does not
                quote prices.
              </p>
            ) : (
              <p className="text-sm">
                {published
                  ? "The chat searches this document for every visitor message and uses matching passages to answer."
                  : "Publish it when the text is right. The chat then searches it for every visitor message."}
              </p>
            )}
            <ActionForm
              action={publishDocumentAction.bind(null, doc.id, !published)}
              submitLabel={published ? "Unpublish" : "Publish"}
              variant={published ? "outline" : "primary"}
              className="mt-4"
            />
          </Panel>
          <Panel title="Delete">
            <ActionForm
              action={deleteDocumentAction.bind(null, doc.id)}
              submitLabel="Delete document"
              variant="outline"
              confirm="Delete this document? The chat stops using it at once."
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
