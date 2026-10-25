"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { submitContactAction } from "@/app/actions/enquiries";
import { Button } from "@/components/ui/button";
import { contactSchema, type ContactInput } from "@/lib/forms/contact";
import { Field, FormAlert, SpamTraps, TextArea, TextInput } from "./fields";
import { ConsentFields, errorKey, SuccessPanel, useStartedAt } from "./shared";

export function ContactForm() {
  const t = useTranslations("Forms");
  const locale = useLocale() as "en" | "ar";
  const [done, setDone] = useState<{ reference: string | null } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const defaults: ContactInput = {
    locale,
    name: "",
    phone: "",
    email: "",
    message: "",
    consentEmail: false,
    consentWhatsapp: false,
    privacyAccepted: false as true,
    website: "",
    startedAt: 0,
  };
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: defaults,
    shouldFocusError: true,
  });
  useStartedAt(setValue as (n: "startedAt", v: number) => void);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await submitContactAction(values);
    if (result.ok) return setDone({ reference: result.reference });
    for (const [path, code] of Object.entries(result.fieldErrors ?? {}))
      setError(path as keyof ContactInput, { message: code });
    setFormError(result.error);
  });

  if (done) {
    return (
      <SuccessPanel
        reference={done.reference}
        onReset={() => {
          reset({ ...defaults, startedAt: Date.now() });
          setDone(null);
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-6">
      <SpamTraps register={register as never} />
      {formError && <FormAlert tone="error">{t(`errors.${formError}` as "errors.server")}</FormAlert>}
      <Field label={t("fields.name")} error={errorKey(errors, "name")}>
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
      <p className="text-sm text-ink-muted">{t("contact.phoneOrEmail")}</p>
      <div className="grid gap-6 sm:grid-cols-2">
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
        <Field label={t("fields.email")} error={errorKey(errors, "email")}>
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
      <Field label={t("contact.message")} error={errorKey(errors, "message")}>
        {(a) => (
          <TextArea
            id={a.id}
            aria-describedby={a.describedBy}
            aria-invalid={a.invalid}
            rows={6}
            {...register("message")}
          />
        )}
      </Field>
      <ConsentFields register={register} errors={errors} />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? t("sending") : t("contact.submit")}
      </Button>
    </form>
  );
}
