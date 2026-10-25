import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import { label } from "@/components/admin/ui";
import type { Material } from "@/generated/prisma/client";
import { materialAvailability } from "@/server/admin/content";
import { saveMaterialAction } from "./actions";

export const boardLabels: Record<string, string> = {
  egger_laminate: "EGGER laminate",
  egger_melamine: "EGGER melamine (MFC)",
  painted_mdf: "Painted MDF",
};

export function MaterialForm({
  material,
  images,
}: {
  material?: Material;
  images: { id: string; originalName: string }[];
}) {
  const ar = { dir: "rtl", lang: "ar" } as const;
  return (
    <ActionForm
      action={saveMaterialAction.bind(null, material?.id ?? null)}
      submitLabel={material ? "Save material" : "Add material"}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminSelect
          label="Board"
          name="board"
          defaultValue={material?.board ?? "egger_laminate"}
          options={Object.entries(boardLabels).map(([value, l]) => ({ value, label: l }))}
          hint="Only EGGER laminate / melamine and painted MDF."
        />
        <AdminInput
          label="Décor code / colour reference"
          name="code"
          defaultValue={material?.code}
          required
          maxLength={40}
          dir="ltr"
          hint="e.g. H1145 ST10, or the paint reference."
        />
        <AdminSelect
          label="Availability"
          name="availability"
          defaultValue={material?.availability ?? "unverified"}
          options={materialAvailability.map((a) => ({ value: a, label: label(a) }))}
        />
        <AdminInput
          label="Name (English)"
          name="nameEn"
          defaultValue={material?.nameEn}
          required
          maxLength={100}
        />
        <AdminInput
          label="Name (Arabic)"
          name="nameAr"
          defaultValue={material?.nameAr ?? ""}
          maxLength={100}
          {...ar}
        />
        <AdminInput
          label="Texture"
          name="texture"
          defaultValue={material?.texture ?? ""}
          maxLength={60}
          hint="e.g. ST10, matt, gloss."
        />
        <AdminTextarea
          label="Description (English)"
          name="descriptionEn"
          defaultValue={material?.descriptionEn ?? ""}
          maxLength={500}
          rows={3}
        />
        <AdminTextarea
          label="Description (Arabic)"
          name="descriptionAr"
          defaultValue={material?.descriptionAr ?? ""}
          maxLength={500}
          rows={3}
          {...ar}
        />
        <div className="space-y-4">
          <AdminInput
            label="Colour family"
            name="colourFamily"
            defaultValue={material?.colourFamily ?? ""}
            maxLength={40}
            hint="e.g. oak, grey, white."
          />
          <AdminInput
            label="Swatch colour"
            name="swatchHex"
            defaultValue={material?.swatchHex ?? ""}
            placeholder="#8b6a4f"
            maxLength={7}
            dir="ltr"
            hint="Approximate, shown when there is no photo."
          />
        </div>
        <AdminSelect
          label="Photo"
          name="imageFileId"
          defaultValue={material?.imageFileId ?? ""}
          options={[
            { value: "", label: "No photo" },
            ...images.map((i) => ({ value: i.id, label: i.originalName })),
          ]}
          hint="Upload in Website images (Material décor)."
        />
        <AdminInput
          label="Order"
          name="sortOrder"
          type="number"
          min={0}
          max={9999}
          defaultValue={material?.sortOrder ?? 0}
        />
      </div>
      <fieldset className="border-t border-line pt-4">
        <legend className="sr-only">Publishing</legend>
        <AdminCheckbox
          name="verified"
          defaultChecked={Boolean(material?.verifiedAt)}
          label="I checked this décor against EGGER's current collection (or the paint reference) and we can supply it"
        />
        <AdminCheckbox name="published" defaultChecked={material?.published} label="Show on the website" />
      </fieldset>
    </ActionForm>
  );
}
