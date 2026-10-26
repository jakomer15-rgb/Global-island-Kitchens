import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/action-form";
import { AdminInput, AdminTextarea } from "@/components/admin/fields";
import { DraftReview } from "@/components/admin/draft-review";
import { Empty, PageHeader, Panel } from "@/components/admin/ui";
import { aiAvailable, aiSettings, listDrafts } from "@/server/ai/drafts";
import { aiConfigured } from "@/server/ai/provider";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { db } from "@/server/db";
import { requestBlogDraftAction } from "./actions";

export const metadata: Metadata = { title: "AI drafts" };

export default async function AiPage() {
  const actor = await requireActor();
  if (!can(actor, "ai.use") && !can(actor, "ai.review")) await requireActor("ai.use");
  const [drafts, settings, contentOn] = await Promise.all([
    listDrafts(db, actor),
    aiSettings(db),
    aiAvailable(db, "contentAssistant"),
  ]);
  const configured = aiConfigured();
  const canReview = can(actor, "ai.review");
  const pending = drafts.filter((d) => d.status === "pending_review");
  const done = drafts.filter((d) => d.status !== "pending_review");

  return (
    <>
      <PageHeader
        title="AI drafts"
        description="Assistants only write drafts. Nothing is sent to a customer or published until a person reviews it here."
      />
      <div className="space-y-6">
        {!(configured && settings.enabled) && (
          <p className="border-s-2 border-amber-600 bg-amber-50 px-4 py-3 text-sm">
            AI assistants are off.{" "}
            {configured
              ? "Turn them on in Settings → AI assistants."
              : "The server has no AI provider key yet (ANTHROPIC_API_KEY, see docs/DEPLOYMENT.md), and the owner has not approved sending text to an AI provider."}
          </p>
        )}
        {can(actor, "ai.use") && can(actor, "content.manage") && contentOn && (
          <Panel title="Draft a blog post">
            <ActionForm action={requestBlogDraftAction} submitLabel="Ask the assistant">
              <p className="text-sm text-ink-muted">
                Writes an English and Arabic draft from the company facts only. Check every claim before
                approving; approving creates an unpublished post.
              </p>
              <AdminInput label="Topic" name="topic" required minLength={5} maxLength={300} />
              <AdminTextarea
                label="Notes for the assistant (optional)"
                name="notes"
                rows={4}
                maxLength={1500}
              />
            </ActionForm>
          </Panel>
        )}
        <Panel title={`Waiting for review (${pending.length})`}>
          {pending.length === 0 ? (
            <Empty>No drafts are waiting.</Empty>
          ) : (
            <div className="space-y-4">
              {pending.map((d) => (
                <DraftReview key={d.id} draft={d} canReview={canReview} />
              ))}
            </div>
          )}
        </Panel>
        {done.length > 0 && (
          <Panel title="Reviewed">
            <div className="space-y-4">
              {done.map((d) => (
                <DraftReview key={d.id} draft={d} canReview={false} />
              ))}
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
