import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput, AdminTextarea } from "@/components/admin/fields";
import { fmtDateTime } from "@/components/admin/ui";
import type { Testimonial } from "@/generated/prisma/client";
import { saveTestimonialAction } from "./actions";

export function TestimonialForm({ testimonial }: { testimonial?: Testimonial }) {
  return (
    <ActionForm
      action={saveTestimonialAction.bind(null, testimonial?.id ?? null)}
      submitLabel={testimonial ? "Save testimonial" : "Add testimonial"}
    >
      <p className="text-sm text-ink-muted">
        Only real words from a real customer, unedited except for spelling, and only with their permission to
        publish them. No invented or “representative” testimonials.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminInput
          label="Name to show"
          name="displayName"
          defaultValue={testimonial?.displayName}
          required
          maxLength={80}
          hint="As the customer agreed, e.g. “Fatima A., Riffa”."
        />
        <AdminInput
          label="Source"
          name="source"
          defaultValue={testimonial?.source}
          required
          maxLength={200}
          hint="e.g. Email from the customer, 2 Nov 2026."
        />
        <AdminTextarea
          label="Text (English)"
          name="textEn"
          defaultValue={testimonial?.textEn ?? ""}
          maxLength={800}
        />
        <AdminTextarea
          label="Text (Arabic)"
          name="textAr"
          defaultValue={testimonial?.textAr ?? ""}
          maxLength={800}
          dir="rtl"
          lang="ar"
          hint="Shown on the Arabic site. Leave empty if the customer wrote only in English."
        />
        <AdminTextarea
          label="Consent"
          name="consentNote"
          defaultValue={testimonial?.consentNote ?? ""}
          maxLength={300}
          rows={2}
          hint="How and when they agreed, e.g. “Agreed by WhatsApp on 3 Nov 2026 to name and text being shown”."
        />
        <AdminInput
          label="Order"
          name="sortOrder"
          type="number"
          min={0}
          max={9999}
          defaultValue={testimonial?.sortOrder ?? 0}
        />
      </div>
      <fieldset className="border-t border-line pt-4">
        <legend className="sr-only">Publishing</legend>
        <AdminCheckbox
          name="consent"
          defaultChecked={Boolean(testimonial?.consentRecordedAt)}
          label={
            testimonial?.consentRecordedAt
              ? `The customer agreed to publication (recorded ${fmtDateTime(testimonial.consentRecordedAt)})`
              : "The customer agreed to publication as described above"
          }
        />
        <AdminCheckbox
          name="published"
          defaultChecked={testimonial?.status === "published"}
          label="Show on the homepage"
        />
      </fieldset>
    </ActionForm>
  );
}
