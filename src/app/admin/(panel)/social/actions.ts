"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { ActionState } from "@/lib/admin/action-state";
import { bahrainDateTime } from "@/lib/social";
import { CUID, formObject, runAction } from "@/server/admin/action";
import { AiError } from "@/server/ai/provider";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { RuleError } from "@/server/errors";
import { processOutbox } from "@/server/outbox/worker";
import { rateLimit } from "@/server/rate-limit";
import { planContentWithAi, planInput, writePostWithAi } from "@/server/social/ai";
import {
  createPost,
  createSocialCampaign,
  decidePost,
  deletePost,
  markPostedByHand,
  postInput,
  publishPostNow,
  refreshEngagementNow,
  reopenPost,
  schedulePost,
  setPostImage,
  socialCampaignInput,
  submitPost,
  unschedulePost,
  updatePost,
} from "@/server/social/posts";

const FIELD_CODES = ["title", "imageFileId", "plannedDay", "campaignId", "platforms", "permalink", "endsOn"];

/** Validation and field rule errors shown on the form; AI provider problems as plain messages. */
async function act(work: () => Promise<unknown>, success: string): Promise<ActionState> {
  try {
    await work();
    return { ok: true, message: success };
  } catch (error) {
    if (error instanceof RuleError && FIELD_CODES.includes(error.code))
      return { error: "Please check the highlighted fields.", fieldErrors: { [error.code]: error.message } };
    if (error instanceof AiError)
      return {
        error:
          error.code === "unusable"
            ? "The assistant did not return a usable draft. Try again, or add more detail to the brief."
            : "The AI provider could not be reached. Try again later.",
      };
    return runAction(() => Promise.reject(error));
  }
}

function zodErrors(issues: { path: PropertyKey[]; message: string }[]): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const i of issues) fieldErrors[String(i.path[0])] ??= i.message;
  return { error: "Please check the highlighted fields.", fieldErrors };
}

function readPost(formData: FormData) {
  const raw = formObject(formData);
  return postInput.safeParse({
    ...raw,
    platforms: formData.getAll("platforms").map(String),
    brief: raw.brief || undefined,
    captionEn: raw.captionEn || undefined,
    captionAr: raw.captionAr || undefined,
    script: raw.script || undefined,
    imageBrief: raw.imageBrief || undefined,
    imageFileId: raw.imageFileId || undefined,
    plannedDay: raw.plannedDay || undefined,
    plannedTime: raw.plannedTime || undefined,
    campaignId: raw.campaignId || undefined,
  });
}

const refresh = (id?: string) => {
  revalidatePath("/admin/social");
  revalidatePath("/admin/social/posts");
  revalidatePath("/admin/automation/approvals");
  if (id) revalidatePath(`/admin/social/${id}`);
};

export async function createPostAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor("social.manage");
  const parsed = readPost(formData);
  if (!parsed.success) return zodErrors(parsed.error.issues);
  let id = "";
  const result = await act(async () => {
    id = (await createPost(db, actor, parsed.data)).id;
  }, "Saved.");
  if (result.ok) {
    refresh();
    redirect(`/admin/social/${id}`);
  }
  return result;
}

export async function updatePostAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor("social.manage");
  if (!CUID.test(id)) return { error: "Invalid post." };
  const parsed = readPost(formData);
  if (!parsed.success) return zodErrors(parsed.error.issues);
  const result = await act(() => updatePost(db, actor, id, parsed.data), "Saved.");
  refresh(id);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function aiWriteAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("social.manage");
  if (!CUID.test(id)) return { error: "Invalid post." };
  let message = "";
  const result = await act(async () => {
    const r = await writePostWithAi(db, actor, id);
    message = `Written. Check and edit it below.${r.suggested ? ` ${r.suggested} photo(s) suggested.` : ""}`;
  }, "");
  refresh(id);
  return result.ok ? { ok: true, message } : result;
}

export async function usePhotoAction(id: string, fileId: string, _: ActionState): Promise<ActionState> {
  void _;
  const actor = await requireActor("social.manage");
  if (!CUID.test(id) || !CUID.test(fileId)) return { error: "Invalid photo." };
  const result = await act(() => setPostImage(db, actor, id, fileId), "Photo chosen.");
  refresh(id);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function submitPostAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("social.manage");
  if (!CUID.test(id)) return { error: "Invalid post." };
  const result = await act(() => submitPost(db, actor, id), "Sent for approval.");
  refresh(id);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function reopenPostAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("social.manage");
  if (!CUID.test(id)) return { error: "Invalid post." };
  const result = await act(() => reopenPost(db, actor, id), "Back to draft.");
  refresh(id);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function deletePostAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("social.manage");
  if (!CUID.test(id)) return { error: "Invalid post." };
  const result = await act(() => deletePost(db, actor, id), "Deleted.");
  if (result.ok) {
    refresh();
    redirect("/admin/social/posts");
  }
  return result;
}

const publishSoon = () =>
  after(() => processOutbox(db).catch((e) => console.error("Outbox delivery failed", e)));

export async function decidePostAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor("social.publish");
  if (!CUID.test(id)) return { error: "Invalid post." };
  const approve = formData.get("decision") === "approve";
  const then = String(formData.get("then") ?? "keep");
  const note = String(formData.get("note") ?? "").trim() || undefined;
  if (!["keep", "schedule", "now"].includes(then)) return { error: "Choose what happens next." };
  let message = "";
  const result = await act(async () => {
    const r = await decidePost(db, actor, id, { approve, note, then: then as "keep" | "schedule" | "now" });
    message = !approve
      ? "Sent back to the author as a draft. Nothing was published."
      : r.status === "scheduled"
        ? "Approved and scheduled."
        : r.queued
          ? "Approved. Publishing now."
          : "Approved.";
    if (r.queued) publishSoon();
  }, "");
  refresh(id);
  return result.ok ? { ok: true, message } : result;
}

export async function scheduleAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor("social.publish");
  if (!CUID.test(id)) return { error: "Invalid post." };
  const at = bahrainDateTime(String(formData.get("day") ?? ""), String(formData.get("time") ?? ""));
  if (!at) return { error: "Choose a valid day and time." };
  const result = await act(() => schedulePost(db, actor, id, at), "Scheduled.");
  refresh(id);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function unscheduleAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("social.publish");
  if (!CUID.test(id)) return { error: "Invalid post." };
  const result = await act(() => unschedulePost(db, actor, id), "No longer scheduled; still approved.");
  refresh(id);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function publishNowAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("social.publish");
  if (!CUID.test(id)) return { error: "Invalid post." };
  let message = "";
  const result = await act(async () => {
    const queued = await publishPostNow(db, actor, id);
    message = queued
      ? "Publishing now. Refresh in a moment to see the result."
      : "It is already being published.";
    if (queued) publishSoon();
  }, "");
  refresh(id);
  return result.ok ? { ok: true, message } : result;
}

export async function markPostedAction(
  targetId: string,
  postId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("social.publish");
  if (!CUID.test(targetId) || !CUID.test(postId)) return { error: "Invalid platform." };
  const permalink = String(formData.get("permalink") ?? "").trim() || undefined;
  const result = await act(() => markPostedByHand(db, actor, targetId, permalink), "Marked as posted.");
  refresh(postId);
  return result;
}

export async function planAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor("social.manage");
  const raw = formObject(formData);
  const parsed = planInput.safeParse({
    view: raw.view,
    anchorDay: raw.anchorDay,
    postsPerWeek: Number(raw.postsPerWeek),
    platforms: formData.getAll("platforms").map(String),
    language: raw.language,
    focus: raw.focus || undefined,
    campaignId: raw.campaignId || undefined,
  });
  if (!parsed.success) return zodErrors(parsed.error.issues);
  let message = "";
  const result = await act(async () => {
    const r = await planContentWithAi(db, actor, parsed.data);
    message = `${r.created} draft post(s) added to the calendar. Open each one to write it and send it for approval.`;
  }, "");
  refresh();
  return result.ok ? { ok: true, message } : result;
}

export async function createSocialCampaignAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor("social.manage");
  const raw = formObject(formData);
  const parsed = socialCampaignInput.safeParse({
    name: raw.name,
    objective: raw.objective || undefined,
    startsOn: raw.startsOn || undefined,
    endsOn: raw.endsOn || undefined,
  });
  if (!parsed.success) return zodErrors(parsed.error.issues);
  const result = await act(() => createSocialCampaign(db, actor, parsed.data), "Campaign added.");
  revalidatePath("/admin/social/campaigns");
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function refreshEngagementAction(_: ActionState): Promise<ActionState> {
  const actor = await requireActor("social.manage");
  if (!(await rateLimit(db, `social-metrics:${actor.id}`, 6, 60 * 60)))
    return { error: "Figures were refreshed several times in the last hour. Please try later." };
  let message = "";
  const result = await act(async () => {
    const r = await refreshEngagementNow(db, actor);
    message = `${r.updated} post(s) updated${r.failed ? `, ${r.failed} could not be read` : ""}.`;
  }, "");
  revalidatePath("/admin/social/performance");
  return result.ok ? { ok: true, message } : result;
}
