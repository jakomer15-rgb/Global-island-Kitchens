import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import type { ActionState } from "@/lib/admin/action-state";
import {
  bahrainDay,
  bahrainTime,
  languageNames,
  platformNames,
  postTypeNames,
  socialPlatforms,
  socialPostTypes,
} from "@/lib/social";

export type PostValues = Partial<{
  title: string;
  brief: string | null;
  type: string;
  platforms: string[];
  language: string;
  captionEn: string | null;
  captionAr: string | null;
  hashtags: string[];
  script: string | null;
  imageBrief: string | null;
  imageFileId: string | null;
  plannedAt: Date | null;
  campaignId: string | null;
}>;

/** Add or edit a social media post (drafts only). */
export function PostForm({
  action,
  values = {},
  images,
  campaigns,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values?: PostValues;
  images: { id: string; label: string }[];
  campaigns: { id: string; name: string }[];
  submitLabel: string;
}) {
  const platforms = new Set(values.platforms ?? ["instagram", "facebook"]);
  return (
    <ActionForm action={action} submitLabel={submitLabel}>
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminInput
          label="Title"
          name="title"
          required
          maxLength={160}
          defaultValue={values.title ?? ""}
          hint="For the team, e.g. “Handleless kitchen, Riffa villa”. Not published."
        />
        <AdminSelect
          label="Type"
          name="type"
          defaultValue={values.type ?? "image"}
          options={socialPostTypes.map((t) => ({ value: t, label: postTypeNames[t] }))}
        />
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Platforms</legend>
        <div className="flex flex-wrap gap-x-6">
          {socialPlatforms.map((p) => (
            <AdminCheckbox
              key={p}
              name="platforms"
              value={p}
              defaultChecked={platforms.has(p)}
              label={platformNames[p]}
            />
          ))}
        </div>
        <p className="text-xs text-ink-muted">
          Facebook and Instagram photo posts publish automatically once Meta is connected. Reels, LinkedIn and
          TikTok are posted by hand and then marked as posted.
        </p>
      </fieldset>
      <AdminTextarea
        label="Brief"
        name="brief"
        rows={3}
        maxLength={2000}
        defaultValue={values.brief ?? ""}
        hint="What the post is about and the angle (used by the AI and the approver)."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminSelect
          label="Captions"
          name="language"
          defaultValue={values.language ?? "both"}
          options={Object.entries(languageNames).map(([value, label]) => ({ value, label }))}
        />
        <AdminInput
          label="Planned day"
          name="plannedDay"
          type="date"
          defaultValue={values.plannedAt ? bahrainDay(values.plannedAt) : ""}
        />
        <AdminInput
          label="Time (Bahrain)"
          name="plannedTime"
          type="time"
          defaultValue={values.plannedAt ? bahrainTime(values.plannedAt) : "19:00"}
        />
      </div>
      <AdminTextarea
        label="Caption (English)"
        name="captionEn"
        rows={6}
        maxLength={2200}
        dir="ltr"
        defaultValue={values.captionEn ?? ""}
      />
      <AdminTextarea
        label="Caption (Arabic)"
        name="captionAr"
        rows={6}
        maxLength={2200}
        dir="rtl"
        lang="ar"
        defaultValue={values.captionAr ?? ""}
      />
      <AdminInput
        label="Hashtags"
        name="hashtags"
        maxLength={2000}
        dir="auto"
        defaultValue={(values.hashtags ?? []).map((h) => `#${h}`).join(" ")}
        hint="Separated by spaces; up to 30. Added after the captions."
      />
      <AdminSelect
        label="Photo"
        name="imageFileId"
        defaultValue={values.imageFileId ?? ""}
        hint="Published website images only; project photos only with confirmed permission. Instagram needs a JPEG."
        options={[
          { value: "", label: "No photo yet" },
          ...images.map((i) => ({ value: i.id, label: i.label })),
        ]}
      />
      <AdminTextarea
        label="Image brief"
        name="imageBrief"
        rows={3}
        maxLength={2000}
        defaultValue={values.imageBrief ?? ""}
        hint="For a designer or Canva: what the promotional image should show."
      />
      <AdminTextarea
        label="Reel or video script"
        name="script"
        rows={5}
        maxLength={5000}
        dir="auto"
        defaultValue={values.script ?? ""}
      />
      <AdminSelect
        label="Campaign"
        name="campaignId"
        defaultValue={values.campaignId ?? ""}
        options={[{ value: "", label: "None" }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]}
      />
    </ActionForm>
  );
}
