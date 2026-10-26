import Link from "next/link";
import { approveDraftAction, rejectDraftAction } from "@/app/admin/(panel)/ai/actions";
import { ActionForm } from "@/components/admin/action-form";
import { AdminInput, AdminTextarea } from "@/components/admin/fields";
import { Badge, fmtDateTime, label } from "@/components/admin/ui";

export interface DraftView {
  id: string;
  kind: "lead_reply" | "lead_summary" | "blog_post";
  status: "pending_review" | "approved" | "rejected";
  output: unknown;
  model: string;
  createdAt: Date;
  reviewNote: string | null;
  lead: { id: string; reference: string } | null;
  blogPost: { id: string; slug: string } | null;
  requestedBy: { name: string };
  reviewedBy: { name: string } | null;
}

const kindLabel = { lead_reply: "Reply to a customer", lead_summary: "Lead summary", blog_post: "Blog post" };
const lineText = (v: unknown) => (Array.isArray(v) ? v.join("\n") : "");

/** One AI draft: editable while it waits for review; a plain record afterwards. */
export function DraftReview({
  draft,
  canReview,
  showLead = true,
}: {
  draft: DraftView;
  canReview: boolean;
  showLead?: boolean;
}) {
  const o = (draft.output ?? {}) as Record<string, unknown>;
  const text = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  const pending = draft.status === "pending_review";

  return (
    <article className="border border-line bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">
          {kindLabel[draft.kind]}
          {showLead && draft.lead && (
            <>
              {" · "}
              <Link href={`/admin/leads/${draft.lead.id}`} className="font-mono text-xs underline">
                {draft.lead.reference}
              </Link>
            </>
          )}
        </span>
        <Badge tone={pending ? "warn" : draft.status === "approved" ? "good" : "neutral"}>
          {pending ? "Needs review" : label(draft.status)}
        </Badge>
      </header>
      <p className="mt-1 text-xs text-ink-muted">
        Drafted by AI ({draft.model}) for {draft.requestedBy.name} · {fmtDateTime(draft.createdAt)}
        {draft.reviewedBy && ` · reviewed by ${draft.reviewedBy.name}`}
      </p>

      {pending && canReview ? (
        <div className="mt-4 space-y-6">
          <ActionForm action={approveDraftAction.bind(null, draft.id)} submitLabel="Approve">
            <p className="text-sm text-ink-muted">
              Check and edit the text. Approving{" "}
              {draft.kind === "blog_post"
                ? "creates an unpublished blog draft"
                : "files it as a note on the lead; nothing is sent to the customer"}
              .
            </p>
            {draft.kind === "lead_reply" && (
              <>
                <input type="hidden" name="language" value={text("language")} />
                <AdminTextarea
                  label="Reply"
                  name="reply"
                  rows={7}
                  defaultValue={text("reply")}
                  maxLength={1500}
                  required
                  dir="auto"
                />
                <AdminTextarea
                  label="Questions to ask (one per line)"
                  name="questions"
                  rows={3}
                  defaultValue={lineText(o.questions)}
                  dir="auto"
                />
              </>
            )}
            {draft.kind === "lead_summary" && (
              <>
                <AdminTextarea
                  label="Summary"
                  name="summary"
                  rows={4}
                  defaultValue={text("summary")}
                  maxLength={800}
                  required
                />
                <AdminTextarea
                  label="Still needed (one per line)"
                  name="missing"
                  rows={3}
                  defaultValue={lineText(o.missing)}
                />
                <AdminTextarea
                  label="Next steps (one per line)"
                  name="nextSteps"
                  rows={3}
                  defaultValue={lineText(o.nextSteps)}
                />
              </>
            )}
            {draft.kind === "blog_post" && (
              <>
                <AdminInput label="Web address" name="slug" defaultValue={text("slug")} dir="ltr" required />
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminInput
                    label="Title (English)"
                    name="titleEn"
                    defaultValue={text("titleEn")}
                    required
                  />
                  <AdminInput
                    label="Title (Arabic)"
                    name="titleAr"
                    defaultValue={text("titleAr")}
                    dir="rtl"
                    lang="ar"
                    required
                  />
                  <AdminTextarea
                    label="Summary (English)"
                    name="excerptEn"
                    rows={2}
                    defaultValue={text("excerptEn")}
                  />
                  <AdminTextarea
                    label="Summary (Arabic)"
                    name="excerptAr"
                    rows={2}
                    defaultValue={text("excerptAr")}
                    dir="rtl"
                    lang="ar"
                  />
                  <AdminTextarea
                    label="Text (English)"
                    name="bodyEn"
                    rows={12}
                    defaultValue={text("bodyEn")}
                    required
                  />
                  <AdminTextarea
                    label="Text (Arabic)"
                    name="bodyAr"
                    rows={12}
                    defaultValue={text("bodyAr")}
                    dir="rtl"
                    lang="ar"
                    required
                  />
                </div>
              </>
            )}
            <AdminInput label="Note (optional)" name="note" maxLength={300} />
          </ActionForm>
          <ActionForm action={rejectDraftAction.bind(null, draft.id)} submitLabel="Reject" variant="outline">
            <AdminInput label="Reason (optional)" name="note" maxLength={300} />
          </ActionForm>
        </div>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          {draft.kind === "lead_reply" && (
            <p className="whitespace-pre-wrap" dir="auto">
              {text("reply")}
            </p>
          )}
          {draft.kind === "lead_summary" && <p className="whitespace-pre-wrap">{text("summary")}</p>}
          {draft.kind === "blog_post" && (
            <p>
              {text("titleEn")}
              {draft.blogPost && (
                <>
                  {" · "}
                  <Link href={`/admin/blog/${draft.blogPost.id}`} className="underline">
                    open the blog draft
                  </Link>
                </>
              )}
            </p>
          )}
          {draft.reviewNote && <p className="text-xs text-ink-muted">Note: {draft.reviewNote}</p>}
          {pending && <p className="text-xs text-ink-muted">Waiting for someone with review permission.</p>}
        </div>
      )}
    </article>
  );
}
