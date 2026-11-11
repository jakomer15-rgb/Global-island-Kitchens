import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { AdminInput } from "@/components/admin/fields";
import { Badge, fmtDateTime, PageHeader, Panel } from "@/components/admin/ui";
import {
  bahrainDay,
  bahrainTime,
  composeCaption,
  engagementTotal,
  languageNames,
  missingForApproval,
  platformNames,
  postTypeNames,
  socialStatusNames,
} from "@/lib/social";
import { CUID } from "@/server/admin/action";
import { mediaUrl } from "@/server/admin/media";
import { aiAvailable } from "@/server/ai/drafts";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { getPost, listSocialCampaigns, usableImages } from "@/server/social/posts";
import {
  aiWriteAction,
  decidePostAction,
  deletePostAction,
  markPostedAction,
  publishNowAction,
  reopenPostAction,
  scheduleAction,
  submitPostAction,
  unscheduleAction,
  updatePostAction,
  usePhotoAction,
} from "../actions";
import { PostForm } from "../post-form";
import { statusTone, targetStatusNames, targetTone } from "../shared";

export const metadata: Metadata = { title: "Social media post" };

const dailyJobNote =
  "Scheduled posts are published by the scheduled job. On the current hosting plan it runs once a day, so a post can go out up to a day after its time; for an exact time, use Publish now at that time (every few minutes comes with Stage 8).";

export default async function SocialPostPage({ params }: PageProps<"/admin/social/[id]">) {
  const actor = await requireActor("social.manage");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  let post;
  try {
    post = await getPost(db, actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const draft = post.status === "draft";
  const [images, campaigns, aiOn] = await Promise.all([
    usableImages(db),
    listSocialCampaigns(db, actor),
    draft && can(actor, "ai.use") ? aiAvailable(db, "contentAssistant") : Promise.resolve(false),
  ]);
  const approver = can(actor, "social.publish");
  const missing = missingForApproval(post);
  const caption = composeCaption(post);
  const imageLabel = images.find((i) => i.id === post.imageFileId)?.label ?? post.image?.originalName;
  const suggestions = post.suggestedImageIds
    .map((sid) => images.find((i) => i.id === sid))
    .filter((i): i is (typeof images)[number] => Boolean(i));
  const anyPublished = post.targets.some((t) => t.status === "published");
  const autoTargets = post.targets.filter((t) => t.status === "pending" || t.status === "failed");

  return (
    <>
      <p className="mb-2 text-sm">
        <Link
          href={post.plannedAt ? `/admin/social?day=${bahrainDay(post.plannedAt)}` : "/admin/social"}
          className="underline underline-offset-4"
        >
          ← Content calendar
        </Link>
      </p>
      <PageHeader
        title={post.title}
        description={
          <>
            {postTypeNames[post.type]} · {post.platforms.map((p) => platformNames[p]).join(", ")} ·{" "}
            {post.plannedAt ? `${fmtDateTime(post.plannedAt)} (Bahrain)` : "no day planned"}
            {post.campaign ? ` · ${post.campaign.name}` : ""}{" "}
            <Badge tone={statusTone[post.status]}>{socialStatusNames[post.status]}</Badge>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {draft ? (
            <Panel title="The post">
              {post.decisionNote && (
                <p className="mb-4 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Not approved{post.decidedBy ? ` by ${post.decidedBy.name}` : ""}: {post.decisionNote}
                </p>
              )}
              {aiOn && (
                <ActionForm
                  action={aiWriteAction.bind(null, post.id)}
                  submitLabel="Write it with AI"
                  pendingLabel="Writing…"
                  variant="outline"
                  className="mb-4"
                />
              )}
              <PostForm
                action={updatePostAction.bind(null, post.id)}
                values={post}
                images={images}
                campaigns={campaigns}
                submitLabel="Save"
              />
            </Panel>
          ) : (
            <Panel title="The post (as approved)">
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-muted">Captions</dt>
                  <dd>{languageNames[post.language]}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Photo</dt>
                  <dd>{imageLabel ?? "None"}</dd>
                </div>
              </dl>
              <h3 className="mt-4 text-sm font-medium">Published text</h3>
              <pre
                className="mt-1 border border-line bg-ivory p-3 font-sans text-sm whitespace-pre-wrap"
                dir="auto"
              >
                {caption || "—"}
              </pre>
              {post.script && (
                <>
                  <h3 className="mt-4 text-sm font-medium">Reel or video script</h3>
                  <pre
                    className="mt-1 border border-line bg-ivory p-3 font-sans text-sm whitespace-pre-wrap"
                    dir="auto"
                  >
                    {post.script}
                  </pre>
                </>
              )}
              {post.imageBrief && (
                <>
                  <h3 className="mt-4 text-sm font-medium">Image brief</h3>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{post.imageBrief}</p>
                </>
              )}
              {post.brief && <p className="mt-4 text-xs text-ink-muted">Brief: {post.brief}</p>}
            </Panel>
          )}

          {post.imageFileId && (
            <Panel title="Photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- served through /media redirects */}
              <img
                src={mediaUrl(post.imageFileId)}
                alt={imageLabel ?? ""}
                className="max-h-80 bg-sand object-contain"
              />
              <p className="mt-2 text-xs text-ink-muted">
                {imageLabel}
                {post.image?.mimeType !== "image/jpeg" && post.platforms.includes("instagram")
                  ? " · Instagram needs a JPEG: choose a JPEG photo for Instagram."
                  : ""}
              </p>
            </Panel>
          )}

          {draft && suggestions.length > 0 && (
            <Panel title="Suggested project photos">
              <ul className="grid gap-4 sm:grid-cols-3">
                {suggestions.map((s) => (
                  <li key={s.id} className="text-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served through /media redirects */}
                    <img
                      src={mediaUrl(s.id)}
                      alt={s.project?.alt ?? ""}
                      className="aspect-[4/3] w-full bg-sand object-cover"
                    />
                    <p className="mt-1 text-xs">{s.label}</p>
                    {s.id !== post.imageFileId ? (
                      <ActionForm
                        action={usePhotoAction.bind(null, post.id, s.id)}
                        submitLabel="Use this photo"
                        variant="outline"
                        className="mt-1"
                      />
                    ) : (
                      <Badge tone="good">Chosen</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Approval">
            {post.status === "draft" && (
              <>
                {missing.length > 0 ? (
                  <ul className="mb-3 list-disc ps-5 text-sm text-ink-muted">
                    {missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-3 text-sm">Ready. Send it for approval when it&apos;s right.</p>
                )}
                <ActionForm action={submitPostAction.bind(null, post.id)} submitLabel="Send for approval" />
              </>
            )}
            {post.status === "pending_approval" && (
              <>
                <p className="mb-3 text-sm">
                  Waiting for approval
                  {approver
                    ? ": check the text and photo, then decide."
                    : " by the owner or general manager."}
                </p>
                {approver && (
                  <div className="space-y-4">
                    <ActionForm
                      action={decidePostAction.bind(null, post.id)}
                      submitLabel="Approve"
                      pendingLabel="Approving…"
                    >
                      <input type="hidden" name="decision" value="approve" />
                      <fieldset className="space-y-1 text-sm">
                        <legend className="font-medium">Then</legend>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="then"
                            value="keep"
                            defaultChecked
                            className="accent-walnut"
                          />
                          Keep it approved (publish later)
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="then"
                            value="schedule"
                            className="accent-walnut"
                            disabled={!post.plannedAt}
                          />
                          Schedule for its planned time
                          {post.plannedAt ? ` (${fmtDateTime(post.plannedAt)})` : " (no time planned)"}
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="radio" name="then" value="now" className="accent-walnut" />
                          Publish now
                        </label>
                      </fieldset>
                      <AdminInput label="Note (optional)" name="note" maxLength={500} />
                    </ActionForm>
                    <ActionForm
                      action={decidePostAction.bind(null, post.id)}
                      submitLabel="Reject"
                      variant="outline"
                    >
                      <input type="hidden" name="decision" value="reject" />
                      <AdminInput label="What to change" name="note" maxLength={500} />
                    </ActionForm>
                  </div>
                )}
                <ActionForm
                  action={reopenPostAction.bind(null, post.id)}
                  submitLabel="Back to draft"
                  variant="outline"
                  className="mt-3"
                />
              </>
            )}
            {["approved", "scheduled", "failed", "published"].includes(post.status) && (
              <p className="mb-3 text-sm">
                Approved{post.decidedBy ? ` by ${post.decidedBy.name}` : ""}
                {post.approvedAt ? ` on ${fmtDateTime(post.approvedAt)}` : ""}.
                {post.status === "published" && post.publishedAt
                  ? ` Published ${fmtDateTime(post.publishedAt)}.`
                  : ""}
              </p>
            )}
            {post.status === "scheduled" && post.plannedAt && (
              <p className="mb-3 text-sm">
                Scheduled for <strong>{fmtDateTime(post.plannedAt)}</strong> (Bahrain).
              </p>
            )}
            {post.status === "failed" && post.lastError && (
              <p className="mb-3 border border-red-200 bg-red-50 p-2 text-xs text-red-900">
                {post.lastError}
              </p>
            )}
            {approver && ["approved", "scheduled", "failed"].includes(post.status) && (
              <div className="space-y-4">
                {autoTargets.length > 0 && (
                  <ActionForm
                    action={publishNowAction.bind(null, post.id)}
                    submitLabel={post.status === "failed" ? "Try again now" : "Publish now"}
                    pendingLabel="Queuing…"
                    confirm={`Publish “${post.title}” to ${autoTargets.map((t) => platformNames[t.platform]).join(" and ")} now?`}
                  />
                )}
                {post.status !== "failed" && (
                  <ActionForm
                    action={scheduleAction.bind(null, post.id)}
                    submitLabel={post.status === "scheduled" ? "Change time" : "Schedule"}
                    variant="outline"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <AdminInput
                        label="Day"
                        name="day"
                        type="date"
                        required
                        defaultValue={post.plannedAt ? bahrainDay(post.plannedAt) : ""}
                      />
                      <AdminInput
                        label="Time (Bahrain)"
                        name="time"
                        type="time"
                        required
                        defaultValue={post.plannedAt ? bahrainTime(post.plannedAt) : "19:00"}
                      />
                    </div>
                  </ActionForm>
                )}
                {post.status === "scheduled" && (
                  <ActionForm
                    action={unscheduleAction.bind(null, post.id)}
                    submitLabel="Unschedule"
                    variant="outline"
                  />
                )}
                {(post.status === "scheduled" || post.status === "approved") && autoTargets.length > 0 && (
                  <p className="text-xs text-ink-muted">{dailyJobNote}</p>
                )}
                {!anyPublished && (
                  <ActionForm
                    action={reopenPostAction.bind(null, post.id)}
                    submitLabel="Back to draft to change it"
                    variant="outline"
                    confirm="Send it back to draft? It will need approval again."
                  />
                )}
              </div>
            )}
          </Panel>

          {post.targets.length > 0 && (
            <Panel title="Platforms">
              <ul className="space-y-4 text-sm">
                {post.targets.map((t) => (
                  <li key={t.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                    <p className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{platformNames[t.platform]}</span>
                      <Badge tone={targetTone[t.status]}>{targetStatusNames[t.status]}</Badge>
                    </p>
                    {t.publishedAt && <p className="text-xs text-ink-muted">{fmtDateTime(t.publishedAt)}</p>}
                    {t.permalink && (
                      <a
                        href={t.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline"
                      >
                        Open the post
                      </a>
                    )}
                    {t.error && <p className="mt-1 text-xs text-red-800">{t.error}</p>}
                    {t.metricsAt && (
                      <p className="mt-1 text-xs">
                        {t.likes ?? "—"} likes · {t.comments ?? "—"} comments
                        {t.platform === "facebook" ? ` · ${t.shares ?? "—"} shares` : ""} (
                        {engagementTotal(t)} in all, {fmtDateTime(t.metricsAt)})
                      </p>
                    )}
                    {approver && (t.status === "manual" || t.status === "failed") && (
                      <ActionForm
                        action={markPostedAction.bind(null, t.id, post.id)}
                        submitLabel="Mark as posted"
                        variant="outline"
                        className="mt-2"
                      >
                        <AdminInput
                          label="Link to the post (optional)"
                          name="permalink"
                          type="url"
                          dir="ltr"
                          maxLength={500}
                          placeholder="https://"
                        />
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Rules">
            <ul className="list-disc space-y-1 ps-5 text-xs text-ink-muted">
              <li>
                Nothing is published until an approver approves it; approved text and photo can&apos;t change.
              </li>
              <li>Only published website images; project photos only with confirmed permission.</li>
              <li>
                No prices, offers, dates, warranties, client names or reviews unless the team has approved
                them.
              </li>
              <li>EGGER laminate and melamine and painted MDF only.</li>
            </ul>
            {!anyPublished && post.status !== "published" && (
              <ActionForm
                action={deletePostAction.bind(null, post.id)}
                submitLabel="Delete post"
                variant="outline"
                className="mt-4"
                confirm="Delete this post? This can't be undone."
              />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
