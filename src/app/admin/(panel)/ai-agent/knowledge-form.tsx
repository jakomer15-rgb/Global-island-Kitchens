import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import type { KnowledgeEntry } from "@/generated/prisma/client";
import { knowledgeKinds } from "@/server/chat/knowledge";
import { saveKnowledgeAction } from "./actions";

export function KnowledgeForm({ entry }: { entry?: KnowledgeEntry }) {
  return (
    <ActionForm
      action={saveKnowledgeAction.bind(null, entry?.id ?? null)}
      submitLabel={entry ? "Save entry" : "Add entry"}
    >
      <p className="text-sm text-ink-muted">
        Write only what is true and approved: the assistant repeats it to visitors as fact. Leave prices,
        delivery times and guarantees out unless the company has decided them; without them the assistant says
        the sales team will confirm. English is enough: the assistant translates.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminSelect
          label="Type"
          name="kind"
          defaultValue={entry?.kind ?? "faq"}
          options={Object.entries(knowledgeKinds).map(([value, label]) => ({ value, label }))}
        />
        <AdminInput
          label="Order"
          name="sortOrder"
          type="number"
          min={0}
          max={9999}
          defaultValue={entry?.sortOrder ?? 0}
        />
        <AdminInput
          label="Question or topic (English)"
          name="titleEn"
          defaultValue={entry?.titleEn}
          required
          minLength={3}
          maxLength={200}
          className="sm:col-span-2"
          hint="e.g. “Do you offer soft-close hinges?” or “Payment terms”."
        />
        <AdminTextarea
          label="Answer or information (English)"
          name="bodyEn"
          defaultValue={entry?.bodyEn}
          required
          rows={6}
          maxLength={3000}
          className="sm:col-span-2"
        />
        <AdminInput
          label="Question or topic (Arabic, optional)"
          name="titleAr"
          defaultValue={entry?.titleAr ?? ""}
          maxLength={200}
          dir="rtl"
          lang="ar"
          className="sm:col-span-2"
        />
        <AdminTextarea
          label="Answer or information (Arabic, optional)"
          name="bodyAr"
          defaultValue={entry?.bodyAr ?? ""}
          rows={4}
          maxLength={3000}
          dir="rtl"
          lang="ar"
          className="sm:col-span-2"
          hint="Kept with the entry for reference. The assistant answers from the English text in the visitor's language."
        />
      </div>
      <AdminCheckbox
        name="published"
        defaultChecked={entry?.published ?? true}
        label="The assistant may use this entry"
      />
    </ActionForm>
  );
}
