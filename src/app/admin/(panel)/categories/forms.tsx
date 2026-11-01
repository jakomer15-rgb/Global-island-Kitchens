import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import { categoryPagePrefix } from "@/content/categories";
import type { CatalogItem, Category, CategorySection } from "@/generated/prisma/client";
import { saveCategoryAction, saveItemAction } from "./actions";

const ar = { dir: "rtl", lang: "ar" } as const;

type Images = { id: string; originalName: string }[];

function imageOptions(images: Images) {
  return [{ value: "", label: "No image" }, ...images.map((i) => ({ value: i.id, label: i.originalName }))];
}

const imageHint = "Upload in Website images (Category, product or machine).";

export function CategoryForm({
  category,
  section,
  images,
  fixedPath,
}: {
  category?: Category;
  section: CategorySection;
  images: Images;
  /** The page address of a built-in product line (its slug can't change). */
  fixedPath?: string;
}) {
  return (
    <ActionForm
      action={saveCategoryAction.bind(null, category ? { id: category.id } : { section })}
      submitLabel={category ? "Save category" : "Add category"}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <AdminInput
          label="Name (English)"
          name="nameEn"
          defaultValue={category?.nameEn}
          required
          maxLength={80}
        />
        <AdminInput
          label="Name (Arabic)"
          name="nameAr"
          defaultValue={category?.nameAr}
          required
          maxLength={80}
          {...ar}
        />
        <AdminTextarea
          label="Description (English)"
          name="descriptionEn"
          defaultValue={category?.descriptionEn ?? ""}
          maxLength={400}
          rows={3}
          hint="One or two sentences, shown on the category's tile and page."
        />
        <AdminTextarea
          label="Description (Arabic)"
          name="descriptionAr"
          defaultValue={category?.descriptionAr ?? ""}
          maxLength={400}
          rows={3}
          {...ar}
        />
        {fixedPath ? (
          <div>
            <input type="hidden" name="slug" value={category?.slug} />
            <p className="text-sm font-medium">Web address</p>
            <p className="mt-1 font-mono text-sm" dir="ltr">
              {fixedPath}
            </p>
            <p className="text-xs text-ink-muted">
              This product line has its own page, so its address is fixed.
            </p>
          </div>
        ) : (
          <AdminInput
            label="Web address (URL slug)"
            name="slug"
            defaultValue={category?.slug}
            required
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            dir="ltr"
            hint={
              section === "products"
                ? `Lowercase letters, numbers and hyphens. The page will be ${categoryPagePrefix}/your-text.`
                : "Lowercase letters, numbers and hyphens, e.g. villa-projects."
            }
          />
        )}
        <AdminSelect
          label="Image"
          name="imageFileId"
          defaultValue={category?.imageFileId ?? ""}
          options={imageOptions(images)}
          hint={imageHint}
        />
      </div>
      <AdminCheckbox
        name="published"
        defaultChecked={category?.published ?? true}
        label="Show on the website"
      />
    </ActionForm>
  );
}

export function ItemForm({
  item,
  categoryId,
  categories,
  images,
  noun,
}: {
  item?: CatalogItem;
  /** The category a new item goes into. */
  categoryId: string;
  /** Categories in the same section the item can be assigned to. */
  categories: { id: string; nameEn: string }[];
  images: Images;
  noun: string;
}) {
  return (
    <ActionForm
      action={saveItemAction.bind(null, item?.id ?? null)}
      submitLabel={item ? `Save ${noun}` : `Add ${noun}`}
      resetOnSuccess={!item}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <AdminInput
          label="Name (English)"
          name="nameEn"
          defaultValue={item?.nameEn}
          required
          maxLength={120}
        />
        <AdminInput
          label="Name (Arabic)"
          name="nameAr"
          defaultValue={item?.nameAr}
          required
          maxLength={120}
          {...ar}
        />
        <AdminTextarea
          label="Description (English)"
          name="descriptionEn"
          defaultValue={item?.descriptionEn ?? ""}
          maxLength={600}
          rows={3}
        />
        <AdminTextarea
          label="Description (Arabic)"
          name="descriptionAr"
          defaultValue={item?.descriptionAr ?? ""}
          maxLength={600}
          rows={3}
          {...ar}
        />
        <AdminSelect
          label="Category"
          name="categoryId"
          defaultValue={item?.categoryId ?? categoryId}
          options={categories.map((c) => ({ value: c.id, label: c.nameEn }))}
        />
        <AdminSelect
          label="Image"
          name="imageFileId"
          defaultValue={item?.imageFileId ?? ""}
          options={imageOptions(images)}
          hint={imageHint}
        />
      </div>
      <AdminCheckbox name="published" defaultChecked={item?.published ?? true} label="Show on the website" />
    </ActionForm>
  );
}
