"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import { gccCountries, prospectTypes } from "@/lib/prospect-score";
import { CUID, parseForm, runAction } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { RuleError } from "@/server/errors";
import {
  audienceSchema,
  campaignInput,
  createCampaign,
  decideCampaign,
  editCampaignMessage,
  prepareCampaign,
  removeCampaignMessage,
  reopenCampaign,
  saveTemplate,
  submitCampaign,
  templateInput,
  writeTemplateWithAi,
} from "@/server/marketing/campaigns";
import {
  convertProspect,
  createProspect,
  importProspects,
  prospectStatuses,
  setProspectStatus,
  updateProspect,
} from "@/server/marketing/prospects";
import { processOutbox } from "@/server/outbox/worker";

const prospectSchema = z.object({
  companyName: z.string().trim().min(2, "Enter the company or person's name.").max(200),
  contactName: z.string().max(120).optional(),
  contactRole: z.string().max(120).optional(),
  type: z.enum(prospectTypes),
  website: z.string().max(300).optional(),
  email: z.string().max(254).optional(),
  phone: z.string().max(30).optional(),
  country: z.enum(Object.keys(gccCountries) as [string, ...string[]]),
  area: z.string().max(120).optional(),
  source: z.enum(["manual", "referral", "event", "other", "google_places"]).optional(),
  sourceNote: z.string().max(300).optional(),
  placeId: z.string().max(300).optional(),
  opportunity: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  assignedToId: z
    .string()
    .optional()
    .refine((v) => !v || CUID.test(v), "Invalid choice."),
});

/** RuleErrors about one field are shown on that field. */
async function withFieldErrors(work: () => Promise<unknown>, success: string): Promise<ActionState> {
  try {
    await work();
    return { ok: true, message: success };
  } catch (error) {
    if (
      error instanceof RuleError &&
      ["companyName", "email", "phone", "website", "country", "type"].includes(error.code)
    )
      return { error: "Please check the highlighted fields.", fieldErrors: { [error.code]: error.message } };
    return runAction(() => Promise.reject(error));
  }
}

export async function createProspectAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor("marketing.manage");
  const parsed = parseForm(prospectSchema, formData);
  if (!parsed.ok) return parsed.state;
  let id = "";
  const result = await withFieldErrors(async () => {
    id = (await createProspect(db, actor, parsed.data)).id;
  }, "Added.");
  if (result.ok) {
    revalidatePath("/admin/marketing");
    // From a Google search the list stays open so more results can be added.
    if (parsed.data.source !== "google_places") redirect(`/admin/marketing/${id}`);
  }
  return result;
}

export async function updateProspectAction(
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("marketing.manage");
  if (!CUID.test(id)) return { error: "Invalid prospect." };
  const parsed = parseForm(prospectSchema, formData);
  if (!parsed.ok) return parsed.state;
  const result = await withFieldErrors(() => updateProspect(db, actor, id, parsed.data), "Saved.");
  revalidatePath(`/admin/marketing/${id}`);
  return result;
}

export async function prospectStatusAction(
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("marketing.manage");
  if (!CUID.test(id)) return { error: "Invalid prospect." };
  const parsed = parseForm(
    z.object({
      status: z.enum(prospectStatuses as [string, ...string[]]),
      note: z.string().max(500).optional(),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;
  const result = await runAction(
    () => setProspectStatus(db, actor, id, parsed.data.status as never, parsed.data.note),
    "Status saved.",
  );
  revalidatePath(`/admin/marketing/${id}`);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function convertProspectAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("marketing.manage");
  if (!CUID.test(id)) return { error: "Invalid prospect." };
  let leadId = "";
  const result = await runAction(async () => {
    leadId = (await convertProspect(db, actor, id)).id;
  }, "Converted.");
  if (result.ok) {
    revalidatePath(`/admin/marketing/${id}`);
    redirect(`/admin/leads/${leadId}`);
  }
  return result;
}

export async function importProspectsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor("marketing.manage");
  const file = formData.get("file");
  let text = String(formData.get("csv") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > 900 * 1024) return { error: "The file is too large (up to 900 KB, about 1,000 rows)." };
    text = await file.text();
  }
  if (!text.trim()) return { error: "Choose a CSV file or paste the rows." };
  let message = "";
  const result = await runAction(async () => {
    const r = await importProspects(db, actor, text);
    message = `${r.created} added.${
      r.skipped.length
        ? ` ${r.skipped.length} skipped: ${r.skipped
            .slice(0, 15)
            .map((s) => `row ${s.row} (${s.reason})`)
            .join("; ")}${r.skipped.length > 15 ? "; …" : ""}`
        : ""
    }`;
  });
  revalidatePath("/admin/marketing");
  return result.ok ? { ok: true, message } : result;
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

const optional = (v: FormDataEntryValue | null) => (v ? String(v) : undefined);

export async function createCampaignAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor("marketing.manage");
  const minScore = optional(formData.get("minScore"));
  const audience = audienceSchema.safeParse({
    type: optional(formData.get("type")),
    country: optional(formData.get("country")),
    priority: optional(formData.get("priority")),
    status: optional(formData.get("status")),
    minScore: minScore ? Number(minScore) : undefined,
  });
  if (!audience.success) return { error: "Check the audience." };
  const parsed = campaignInput.safeParse({
    name: formData.get("name"),
    brief: formData.get("brief"),
    language: formData.get("language"),
    audience: audience.data,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Please check the highlighted fields.", fieldErrors };
  }
  let id = "";
  const result = await runAction(async () => {
    id = (await createCampaign(db, actor, parsed.data)).id;
  });
  if (result.ok) redirect(`/admin/marketing/campaigns/${id}`);
  return result;
}

const refreshCampaign = (id: string) => {
  revalidatePath(`/admin/marketing/campaigns/${id}`);
  revalidatePath("/admin/marketing/campaigns");
  revalidatePath("/admin/automation/approvals");
};

export async function saveTemplateAction(
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("marketing.manage");
  if (!CUID.test(id)) return { error: "Invalid campaign." };
  const parsed = parseForm(templateInput, formData);
  if (!parsed.ok) return parsed.state;
  const result = await runAction(() => saveTemplate(db, actor, id, parsed.data), "Saved.");
  refreshCampaign(id);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function aiTemplateAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("marketing.manage");
  if (!CUID.test(id)) return { error: "Invalid campaign." };
  const result = await runAction(
    () => writeTemplateWithAi(db, actor, id),
    "Written. Check and edit it below.",
  );
  refreshCampaign(id);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function prepareCampaignAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("marketing.manage");
  if (!CUID.test(id)) return { error: "Invalid campaign." };
  let message = "";
  const result = await runAction(async () => {
    const r = await prepareCampaign(db, actor, id);
    message = `${r.prepared} email(s) prepared.${r.leftOut ? ` ${r.leftOut} more matched; at most 100 per campaign (highest scores first).` : ""}`;
  });
  refreshCampaign(id);
  return result.ok ? { ok: true, message } : result;
}

export async function editMessageAction(
  id: string,
  campaignId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("marketing.manage");
  if (!CUID.test(id) || !CUID.test(campaignId)) return { error: "Invalid email." };
  const parsed = parseForm(
    z.object({ subject: templateInput.shape.subjectTemplate, body: templateInput.shape.bodyTemplate }),
    formData,
  );
  if (!parsed.ok) return parsed.state;
  const result = await runAction(() => editCampaignMessage(db, actor, id, parsed.data), "Saved.");
  refreshCampaign(campaignId);
  return result;
}

export async function removeMessageAction(
  id: string,
  campaignId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
  _: ActionState,
): Promise<ActionState> {
  const actor = await requireActor("marketing.manage");
  if (!CUID.test(id) || !CUID.test(campaignId)) return { error: "Invalid email." };
  const result = await runAction(() => removeCampaignMessage(db, actor, id), "Removed.");
  refreshCampaign(campaignId);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function submitCampaignAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("marketing.manage");
  if (!CUID.test(id)) return { error: "Invalid campaign." };
  const result = await runAction(() => submitCampaign(db, actor, id), "Sent for approval.");
  refreshCampaign(id);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function reopenCampaignAction(id: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("marketing.manage");
  if (!CUID.test(id)) return { error: "Invalid campaign." };
  const result = await runAction(() => reopenCampaign(db, actor, id), "Back to draft.");
  refreshCampaign(id);
  return result;
}

export async function decideCampaignAction(
  id: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("outreach.approve");
  if (!CUID.test(id)) return { error: "Invalid campaign." };
  const approve = formData.get("decision") === "approve";
  let message = "";
  const result = await runAction(async () => {
    const r = await decideCampaign(db, actor, id, { approve, note: optional(formData.get("note")) });
    message = approve
      ? `Approved: ${r.queued} email(s) queued, sent 20 at a time.`
      : "Rejected. Nothing was sent.";
  });
  if (result.ok && approve)
    after(() => processOutbox(db).catch((e) => console.error("Outbox delivery failed", e)));
  refreshCampaign(id);
  return result.ok ? { ok: true, message } : result;
}
