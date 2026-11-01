import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput, AdminSelect } from "@/components/admin/fields";
import { label } from "@/components/admin/ui";
import type { PortfolioProject } from "@/generated/prisma/client";
import { scopeTags, segments } from "@/server/admin/portfolio";
import { saveProjectAction } from "./actions";

const tagLabels: Record<(typeof scopeTags)[number], string> = {
  kitchens: "Kitchens",
  closets: "Wardrobes / closets",
  bedSets: "Bedroom sets",
  tvUnits: "TV units",
  vanities: "Vanities",
  doors: "Doors",
  cladding: "Wall cladding",
  fullJoinery: "Complete interior joinery",
  furnished: "Fully furnished",
  commercial: "Commercial fit-out",
};

export function ProjectForm({
  project,
  categories,
}: {
  project?: PortfolioProject;
  /** Categories in the "projects" section (Manage categories). */
  categories: { id: string; nameEn: string }[];
}) {
  const ar = { dir: "rtl", lang: "ar" } as const;
  return (
    <ActionForm
      action={saveProjectAction.bind(null, project?.id ?? null)}
      submitLabel={project ? "Save project" : "Add project"}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <AdminInput
          label="Web address"
          name="slug"
          defaultValue={project?.slug}
          required
          maxLength={80}
          dir="ltr"
          hint="The end of the link: /projects/your-text."
        />
        <AdminSelect
          label="Type"
          name="segment"
          defaultValue={project?.segment ?? "residential"}
          options={segments.map((s) => ({ value: s, label: label(s) }))}
        />
        <AdminSelect
          label="Category"
          name="categoryId"
          defaultValue={project?.categoryId ?? ""}
          options={[
            { value: "", label: "No category (grouped by type)" },
            ...categories.map((c) => ({ value: c.id, label: c.nameEn })),
          ]}
          hint="Project categories are added in Manage categories → Projects."
        />
        <AdminInput
          label="Name (English)"
          name="nameEn"
          defaultValue={project?.nameEn}
          required
          maxLength={120}
        />
        <AdminInput
          label="Name (Arabic)"
          name="nameAr"
          defaultValue={project?.nameAr}
          required
          maxLength={120}
          {...ar}
        />
        <AdminInput
          label="Location (English)"
          name="locationEn"
          defaultValue={project?.locationEn}
          required
          maxLength={120}
        />
        <AdminInput
          label="Location (Arabic)"
          name="locationAr"
          defaultValue={project?.locationAr}
          required
          maxLength={120}
          {...ar}
        />
        <AdminInput
          label="Size (English)"
          name="sizeEn"
          defaultValue={project?.sizeEn ?? ""}
          maxLength={200}
          hint="e.g. 10 flats."
        />
        <AdminInput
          label="Size (Arabic)"
          name="sizeAr"
          defaultValue={project?.sizeAr ?? ""}
          maxLength={200}
          {...ar}
        />
        <AdminInput
          label="Scope (English)"
          name="scopeEn"
          defaultValue={project?.scopeEn}
          required
          maxLength={300}
        />
        <AdminInput
          label="Scope (Arabic)"
          name="scopeAr"
          defaultValue={project?.scopeAr}
          required
          maxLength={300}
          {...ar}
        />
      </div>
      <fieldset>
        <legend className="text-sm font-medium">What we made (links the project to product pages)</legend>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3">
          {scopeTags.map((tag) => (
            <AdminCheckbox
              key={tag}
              name="scopeTags"
              value={tag}
              defaultChecked={project?.scopeTags.includes(tag)}
              label={tagLabels[tag]}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 border-t border-line pt-4 md:grid-cols-2">
        <AdminInput
          label="Client name"
          name="clientName"
          defaultValue={project?.clientName ?? ""}
          maxLength={120}
          hint="Only with the client's agreement to be named."
        />
        <AdminInput
          label="Order"
          name="sortOrder"
          type="number"
          min={0}
          max={9999}
          defaultValue={project?.sortOrder ?? 0}
        />
      </div>
      <fieldset>
        <legend className="sr-only">Permissions and publishing</legend>
        <AdminCheckbox
          name="clientNamePermission"
          defaultChecked={project?.clientNamePermission}
          label="The client agreed to their name being shown"
        />
        <AdminCheckbox name="featured" defaultChecked={project?.featured} label="Featured" />
        <AdminCheckbox
          name="published"
          defaultChecked={project?.published ?? true}
          label="Show on the website"
        />
      </fieldset>
    </ActionForm>
  );
}
