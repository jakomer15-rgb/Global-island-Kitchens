"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { submitConsultationAction } from "@/app/actions/enquiries";
import { Button } from "@/components/ui/button";
import {
  bahrainToday,
  consultationSchema,
  consultationTypes,
  MAX_DAYS_AHEAD,
  timeSlots,
  type ConsultationInput,
} from "@/lib/forms/consultation";
import { quoteCategories } from "@/lib/forms/quote";
import { ChoiceCard, ChoiceGroup, Field, FormAlert, Select, SpamTraps, TextArea, TextInput } from "./fields";
import { ConsentFields, errorKey, SuccessPanel, useStartedAt } from "./shared";

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ConsultationForm() {
  const t = useTranslations("Forms");
  const locale = useLocale() as "en" | "ar";
  const [done, setDone] = useState<{ reference: string | null } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const schema = useMemo(() => consultationSchema(), []);
  const today = bahrainToday();
  const defaults: ConsultationInput = {
    locale,
    type: "showroom",
    preferredDate: "",
    preferredSlot: "morning",
    area: "",
    category: undefined,
    notes: "",
    name: "",
    phone: "",
    email: "",
    consentEmail: false,
    consentWhatsapp: false,
    privacyAccepted: false as true,
    website: "",
    startedAt: 0,
  };
  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConsultationInput>({ resolver: zodResolver(schema), defaultValues: defaults });
  useStartedAt(setValue as (n: "startedAt", v: number) => void);
  const type = useWatch({ control, name: "type" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await submitConsultationAction(values);
    if (result.ok) return setDone({ reference: result.reference });
    for (const [path, code] of Object.entries(result.fieldErrors ?? {}))
      setError(path as keyof ConsultationInput, { message: code });
    setFormError(result.error);
  });

  if (done) {
    return (
      <SuccessPanel
        reference={done.reference}
        onReset={() => (reset({ ...defaults, startedAt: Date.now() }), setDone(null))}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-8">
      <SpamTraps register={register as never} />
      {formError && <FormAlert tone="error">{t(`errors.${formError}` as "errors.server")}</FormAlert>}

      <ChoiceGroup legend={t("consultation.type")} error={errorKey(errors, "type")}>
        {consultationTypes.map((value) => (
          <ChoiceCard
            key={value}
            type="radio"
            value={value}
            label={t(`consultation.types.${value}`)}
            hint={t(`consultation.types.${value}Hint`)}
            {...register("type")}
          />
        ))}
      </ChoiceGroup>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={t("consultation.date")} error={errorKey(errors, "preferredDate")}>
          {(a) => (
            <TextInput
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              type="date"
              min={today}
              max={addDays(today, MAX_DAYS_AHEAD)}
              {...register("preferredDate")}
            />
          )}
        </Field>
        <Field label={t("consultation.slot")} error={errorKey(errors, "preferredSlot")}>
          {(a) => (
            <Select
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              {...register("preferredSlot")}
            >
              {timeSlots.map((s) => (
                <option key={s} value={s}>
                  {t(`consultation.slots.${s}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {type === "site_visit" && (
        <Field
          label={t("consultation.areaSite")}
          hint={t("fields.areaHint")}
          error={errorKey(errors, "area")}
        >
          {(a) => (
            <TextInput
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              {...register("area")}
            />
          )}
        </Field>
      )}

      <Field label={t("consultation.category")} error={errorKey(errors, "category")}>
        {(a) => (
          <Select
            id={a.id}
            aria-describedby={a.describedBy}
            {...register("category", { setValueAs: (v) => v || undefined })}
          >
            <option value="">{t("consultation.categoryNone")}</option>
            {quoteCategories.map((c) => (
              <option key={c} value={c}>
                {t(`quote.categories.${c}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label={t("consultation.notes")} error={errorKey(errors, "notes")}>
        {(a) => (
          <TextArea
            id={a.id}
            aria-describedby={a.describedBy}
            aria-invalid={a.invalid}
            {...register("notes")}
          />
        )}
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={t("fields.name")} error={errorKey(errors, "name")} className="sm:col-span-2">
          {(a) => (
            <TextInput
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              autoComplete="name"
              {...register("name")}
            />
          )}
        </Field>
        <Field label={t("fields.phone")} hint={t("fields.phoneHint")} error={errorKey(errors, "phone")}>
          {(a) => (
            <TextInput
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              {...register("phone")}
            />
          )}
        </Field>
        <Field
          label={t("fields.email")}
          hint={t("fields.emailHint")}
          optional
          error={errorKey(errors, "email")}
        >
          {(a) => (
            <TextInput
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              type="email"
              autoComplete="email"
              dir="ltr"
              {...register("email")}
            />
          )}
        </Field>
      </div>

      <ConsentFields register={register} errors={errors} />
      <FormAlert tone="info">{t("consultation.note")}</FormAlert>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? t("sending") : t("consultation.submit")}
      </Button>
    </form>
  );
}
