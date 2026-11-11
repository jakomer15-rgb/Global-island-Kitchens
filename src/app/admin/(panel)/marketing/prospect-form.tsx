import { ActionForm } from "@/components/admin/action-form";
import { AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import type { ActionState } from "@/lib/admin/action-state";
import { gccCountries, prospectTypeNames, prospectTypes } from "@/lib/prospect-score";

type Values = Partial<{
  companyName: string;
  contactName: string | null;
  contactRole: string | null;
  type: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  country: string;
  area: string | null;
  sourceNote: string | null;
  opportunity: string | null;
  notes: string | null;
  assignedToId: string | null;
}>;

/** Add or edit a prospect. */
export function ProspectForm({
  action,
  values = {},
  staff,
  submitLabel,
  isNew,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values?: Values;
  staff: { id: string; name: string }[];
  submitLabel: string;
  isNew?: boolean;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel}>
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminInput
          label="Company or person"
          name="companyName"
          required
          maxLength={200}
          defaultValue={values.companyName ?? ""}
        />
        <AdminSelect
          label="Type"
          name="type"
          defaultValue={values.type ?? "interior_designer"}
          options={prospectTypes.map((t) => ({ value: t, label: prospectTypeNames[t] }))}
        />
        <AdminInput
          label="Contact name"
          name="contactName"
          maxLength={120}
          defaultValue={values.contactName ?? ""}
        />
        <AdminInput
          label="Contact's role"
          name="contactRole"
          maxLength={120}
          defaultValue={values.contactRole ?? ""}
        />
        <AdminInput
          label="Business email"
          name="email"
          type="email"
          dir="ltr"
          maxLength={254}
          defaultValue={values.email ?? ""}
          hint="A work address the business publishes (website, profile, business card)."
        />
        <AdminInput
          label="Phone"
          name="phone"
          dir="ltr"
          maxLength={30}
          defaultValue={values.phone ?? ""}
          hint="With country code; Bahrain numbers can omit +973."
        />
        <AdminInput
          label="Website"
          name="website"
          dir="ltr"
          maxLength={300}
          defaultValue={values.website ?? ""}
        />
        <AdminSelect
          label="Country"
          name="country"
          defaultValue={values.country ?? "BH"}
          options={Object.entries(gccCountries).map(([value, label]) => ({ value, label }))}
        />
        <AdminInput label="Area or city" name="area" maxLength={120} defaultValue={values.area ?? ""} />
        <AdminSelect
          label="Assigned to"
          name="assignedToId"
          defaultValue={values.assignedToId ?? ""}
          options={[
            { value: "", label: "Nobody yet" },
            ...staff.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
        {isNew && (
          <>
            <AdminSelect
              label="Found through"
              name="source"
              defaultValue="manual"
              options={[
                { value: "manual", label: "Our own research" },
                { value: "referral", label: "Referral" },
                { value: "event", label: "Event or exhibition" },
                { value: "other", label: "Other" },
              ]}
            />
            <AdminInput
              label="Where exactly (optional)"
              name="sourceNote"
              maxLength={300}
              defaultValue={values.sourceNote ?? ""}
            />
          </>
        )}
      </div>
      <AdminTextarea
        label="Opportunity"
        name="opportunity"
        rows={3}
        maxLength={2000}
        defaultValue={values.opportunity ?? ""}
        hint="Why this business may need GIK: e.g. “Developing 40 apartments in Juffair, fit-out next year”."
      />
      <AdminTextarea label="Notes" name="notes" rows={4} maxLength={4000} defaultValue={values.notes ?? ""} />
    </ActionForm>
  );
}
