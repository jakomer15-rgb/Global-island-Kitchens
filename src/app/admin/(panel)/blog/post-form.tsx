import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import type { BlogPost } from "@/generated/prisma/client";
import { savePostAction } from "./actions";

const bodyHint = "Plain text. Leave a blank line between paragraphs; start a line with “## ” for a heading.";

export function PostForm({
  post,
  images,
}: {
  post?: BlogPost;
  images: { id: string; originalName: string }[];
}) {
  const ar = { dir: "rtl", lang: "ar" } as const;
  return (
    <ActionForm
      action={savePostAction.bind(null, post?.id ?? null)}
      submitLabel={post ? "Save post" : "Create draft"}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <AdminInput
          label="Web address"
          name="slug"
          defaultValue={post?.slug}
          required
          maxLength={80}
          dir="ltr"
          hint="The end of the link: /blog/your-text. Changing it breaks links already shared."
        />
        <AdminSelect
          label="Cover image"
          name="coverFileId"
          defaultValue={post?.coverFileId ?? ""}
          options={[
            { value: "", label: "No cover" },
            ...images.map((i) => ({ value: i.id, label: i.originalName })),
          ]}
          hint="Upload in Website images (Blog image)."
        />
        <AdminInput
          label="Title (English)"
          name="titleEn"
          defaultValue={post?.titleEn}
          required
          maxLength={120}
        />
        <AdminInput
          label="Title (Arabic)"
          name="titleAr"
          defaultValue={post?.titleAr ?? ""}
          maxLength={120}
          {...ar}
        />
        <AdminTextarea
          label="Summary (English)"
          name="excerptEn"
          defaultValue={post?.excerptEn ?? ""}
          maxLength={300}
          rows={2}
        />
        <AdminTextarea
          label="Summary (Arabic)"
          name="excerptAr"
          defaultValue={post?.excerptAr ?? ""}
          maxLength={300}
          rows={2}
          {...ar}
        />
        <AdminTextarea
          label="Text (English)"
          name="bodyEn"
          defaultValue={post?.bodyEn}
          required
          rows={16}
          hint={bodyHint}
        />
        <AdminTextarea
          label="Text (Arabic)"
          name="bodyAr"
          defaultValue={post?.bodyAr ?? ""}
          rows={16}
          hint={bodyHint}
          {...ar}
        />
      </div>
      <fieldset className="border-t border-line pt-4">
        <legend className="sr-only">Publishing</legend>
        <AdminCheckbox
          name="published"
          defaultChecked={post?.status === "published"}
          label="Published (needs the Arabic title and text)"
        />
      </fieldset>
    </ActionForm>
  );
}
