"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import type { FieldErrors, UseFormRegisterReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Checkbox } from "./fields";

/** Error key for a field from react-hook-form errors (keys come from the shared zod schemas). */
export function errorKey(errors: FieldErrors, path: string): string | undefined {
  const parts = path.split(".");
  let node: unknown = errors;
  for (const p of parts) node = (node as Record<string, unknown> | undefined)?.[p];
  const message = (node as { message?: unknown } | undefined)?.message;
  return typeof message === "string" && message ? message : undefined;
}

type ConsentField = "consentEmail" | "consentWhatsapp" | "privacyAccepted";

/** Optional marketing consent (unticked) and the required privacy acknowledgement. */
export function ConsentFields({
  register,
  errors,
  showEmail = true,
  showWhatsapp = true,
}: {
  // Any form whose values include the consent fields (react-hook-form's register narrowed to them).
  register: (name: ConsentField) => UseFormRegisterReturn;
  errors: FieldErrors;
  showEmail?: boolean;
  showWhatsapp?: boolean;
}) {
  const t = useTranslations("Forms.fields");
  const reg = register;
  return (
    <div className="space-y-4">
      {(showEmail || showWhatsapp) && (
        <fieldset>
          <legend className="text-sm font-medium">{t("consentTitle")}</legend>
          <div className="mt-1">
            {showEmail && <Checkbox label={t("consentEmail")} {...reg("consentEmail")} />}
            {showWhatsapp && <Checkbox label={t("consentWhatsapp")} {...reg("consentWhatsapp")} />}
          </div>
          <p className="text-xs text-ink-muted">{t("consentNote")}</p>
        </fieldset>
      )}
      <Checkbox
        label={t.rich("privacy", {
          link: (chunks) => (
            <Link href="/privacy-policy" target="_blank" className="underline underline-offset-4">
              {chunks}
            </Link>
          ),
        })}
        error={errorKey(errors, "privacyAccepted")}
        {...reg("privacyAccepted")}
      />
    </div>
  );
}

/** Confirmation shown after a successful submission, focused so screen readers announce it. */
export function SuccessPanel({ reference, onReset }: { reference: string | null; onReset: () => void }) {
  const t = useTranslations("Forms.success");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="border border-walnut/40 bg-sand p-8 focus:outline-none"
    >
      <CheckCircle2 aria-hidden className="size-8 text-walnut" strokeWidth={1.5} />
      <h2 className="mt-4 font-display text-display-md">{t("title")}</h2>
      {reference && (
        <p className="mt-3 text-lg">
          {t.rich("reference", { reference, ref: (chunks) => <strong dir="ltr">{chunks}</strong> })}
        </p>
      )}
      <p className="mt-3 text-ink-muted">{reference ? t("body") : t("noReference")}</p>
      <Button type="button" variant="outline" className="mt-6" onClick={onReset}>
        {t("another")}
      </Button>
    </div>
  );
}

/** Sets the form-opened time after mount (used by the spam check). */
export function useStartedAt(setValue: (name: "startedAt", value: number) => void) {
  useEffect(() => setValue("startedAt", Date.now()), [setValue]);
}
