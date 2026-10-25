"use client";

import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { submitQuoteAction } from "@/app/actions/enquiries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  boardOptions,
  customerTypes,
  MAX_WALLS,
  quoteCategories,
  quoteStepSchemas,
  units,
  type QuoteRequestInput,
} from "@/lib/forms/quote";
import { ChoiceCard, ChoiceGroup, Field, FormAlert, Select, SpamTraps, TextArea, TextInput } from "./fields";
import { FileUploader, type UploadItem } from "./file-uploader";
import { ConsentFields, errorKey, SuccessPanel, useStartedAt } from "./shared";

type Values = Omit<QuoteRequestInput, "files"> & { files: { id: string; ticket: string }[] };
type StepKey = "category" | "measurements" | "materials" | "files" | "contact" | "review";
const steps: StepKey[] = ["category", "measurements", "materials", "files", "contact", "review"];

/** Which step owns each top-level field (to jump back to an error the server reports). */
const fieldStep: Record<string, StepKey> = {
  category: "category",
  unit: "measurements",
  walls: "measurements",
  noMeasurements: "measurements",
  boards: "materials",
  finishNotes: "materials",
  files: "files",
};

const emptyWall = { label: "", width: "", height: "", depth: "" };

export function QuoteWizard() {
  const t = useTranslations("Forms");
  const locale = useLocale() as "en" | "ar";
  const [step, setStep] = useState(0);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [done, setDone] = useState<{ reference: string | null } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const defaults: Values = {
    locale,
    category: undefined as unknown as Values["category"],
    unit: "cm",
    walls: [emptyWall],
    noMeasurements: false,
    boards: [],
    finishNotes: "",
    files: [],
    name: "",
    phone: "",
    email: "",
    area: "",
    customerType: "homeowner",
    message: "",
    consentEmail: false,
    consentWhatsapp: false,
    privacyAccepted: false as true,
    website: "",
    startedAt: 0,
  };
  const form = useForm<Values>({ defaultValues: defaults });
  const { register, getValues, setError, clearErrors, setValue, setFocus, reset, formState } = form;
  const { errors, isSubmitting } = formState;
  const walls = useFieldArray({ control: form.control, name: "walls" });
  // Live values for the conditional fields and the review step.
  const values = useWatch({ control: form.control }) as Values;
  useStartedAt(setValue as (n: "startedAt", v: number) => void);

  // Product pages link here with ?category=<page key> to pre-select step 1. Read after mount (not with
  // useSearchParams) so the page renders the full form statically, without a layout shift.
  useEffect(() => {
    const category = new URLSearchParams(window.location.search).get("category");
    if (category && (quoteCategories as readonly string[]).includes(category)) {
      setValue("category", category as Values["category"]);
    }
  }, [setValue]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const key = steps[step]!;
  const uploading = uploads.some((u) => u.status === "uploading");
  const readyFiles = uploads.filter((u) => u.status === "ready");

  function validate(stepKey: StepKey): boolean {
    if (stepKey === "review") return true;
    const values = { ...getValues(), files: readyFiles.map((u) => ({ id: u.id!, ticket: u.ticket! })) };
    const result = quoteStepSchemas[stepKey].safeParse(values);
    clearErrors();
    if (result.success) return true;
    let first: string | null = null;
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      first ??= path;
      setError(path as FieldPath<Values>, { message: issue.message });
    }
    if (first) {
      try {
        setFocus(first as FieldPath<Values>);
      } catch {
        // Not every path is a focusable input (e.g. a group); the error text is still announced.
      }
    }
    return false;
  }

  function next() {
    if (key === "files" && uploading) return;
    if (validate(key)) setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  async function submit() {
    for (const s of steps) {
      if (!validate(s)) return setStep(steps.indexOf(s));
    }
    setFormError(null);
    const values = { ...getValues(), files: readyFiles.map((u) => ({ id: u.id!, ticket: u.ticket! })) };
    const result = await submitQuoteAction(values);
    if (result.ok) return setDone({ reference: result.reference });
    const fieldErrors = Object.entries(result.fieldErrors ?? {});
    for (const [path, code] of fieldErrors) setError(path as FieldPath<Values>, { message: code });
    const firstField = fieldErrors[0]?.[0].split(".")[0];
    setStep(steps.indexOf(firstField ? (fieldStep[firstField] ?? "contact") : key));
    setFormError(result.error);
  }

  if (done) {
    return (
      <SuccessPanel
        reference={done.reference}
        onReset={() => {
          reset({ ...defaults, startedAt: Date.now() });
          setUploads([]);
          setStep(0);
          setDone(null);
        }}
      />
    );
  }

  return (
    <form
      noValidate
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        if (key === "review") void submit();
        else next();
      }}
    >
      <SpamTraps register={register as never} />

      <ol
        className="mb-10 grid grid-cols-6 gap-1.5"
        aria-label={t("quote.stepOf", { current: step + 1, total: steps.length })}
      >
        {steps.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}>
            <span className={cn("block h-1", i <= step ? "bg-walnut" : "bg-charcoal/15")} />
            <span className="sr-only">{t(`quote.steps.${s}`)}</span>
          </li>
        ))}
      </ol>
      <p className="eyebrow text-walnut">{t("quote.stepOf", { current: step + 1, total: steps.length })}</p>
      <h2 ref={headingRef} tabIndex={-1} className="mt-3 font-display text-display-md focus:outline-none">
        {t(`quote.steps.${key}`)}
      </h2>

      {formError && (
        <div className="mt-6">
          <FormAlert tone="error">{t(`errors.${formError}` as "errors.server")}</FormAlert>
        </div>
      )}

      <div className="mt-8 space-y-8">
        {key === "category" && (
          <ChoiceGroup
            legend={<span className="sr-only">{t("quote.steps.category")}</span>}
            error={errorKey(errors, "category")}
          >
            {quoteCategories.map((c) => (
              <ChoiceCard
                key={c}
                type="radio"
                value={c}
                label={t(`quote.categories.${c}`)}
                {...register("category")}
              />
            ))}
          </ChoiceGroup>
        )}

        {key === "measurements" && (
          <>
            <p className="text-ink-muted">{t("quote.measurementsIntro")}</p>
            <Field label={t("quote.unit")} className="max-w-xs">
              {(a) => (
                <Select id={a.id} {...register("unit")}>
                  {units.map((u) => (
                    <option key={u} value={u}>
                      {t(`quote.units.${u}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {!values.noMeasurements &&
              walls.fields.map((field, i) => (
                <fieldset key={field.id} className="border-t border-line pt-6">
                  <legend className="flex w-full items-center justify-between font-medium">
                    {t("quote.wall", { n: i + 1 })}
                  </legend>
                  <div className="mt-4 grid gap-4 sm:grid-cols-4">
                    <Field
                      label={t("quote.wallLabel")}
                      className="sm:col-span-4"
                      error={errorKey(errors, `walls.${i}.label`)}
                    >
                      {(a) => (
                        <TextInput
                          id={a.id}
                          aria-describedby={a.describedBy}
                          placeholder={t("quote.wallLabelHint")}
                          {...register(`walls.${i}.label`)}
                        />
                      )}
                    </Field>
                    {(["width", "height", "depth"] as const).map((dim) => (
                      <Field
                        key={dim}
                        label={`${t(`quote.${dim}`)} (${values.unit})`}
                        error={errorKey(errors, `walls.${i}.${dim}`)}
                      >
                        {(a) => (
                          <TextInput
                            id={a.id}
                            aria-describedby={a.describedBy}
                            aria-invalid={a.invalid}
                            inputMode="decimal"
                            dir="ltr"
                            {...register(`walls.${i}.${dim}`)}
                          />
                        )}
                      </Field>
                    ))}
                    {walls.fields.length > 1 && (
                      <div className="flex items-end">
                        <Button type="button" variant="link" onClick={() => walls.remove(i)}>
                          {t("quote.removeWall")}
                        </Button>
                      </div>
                    )}
                  </div>
                </fieldset>
              ))}
            {!values.noMeasurements && walls.fields.length < MAX_WALLS && (
              <Button type="button" variant="outline" onClick={() => walls.append(emptyWall)}>
                <Plus aria-hidden /> {t("quote.addWall")}
              </Button>
            )}
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" className="size-4 accent-walnut" {...register("noMeasurements")} />
              {t("quote.noMeasurements")}
            </label>
          </>
        )}

        {key === "materials" && (
          <>
            <ChoiceGroup legend={t("quote.boardsIntro")} error={errorKey(errors, "boards")}>
              {boardOptions.map((b) => (
                <ChoiceCard
                  key={b}
                  type="checkbox"
                  value={b}
                  label={t(`quote.boards.${b}`)}
                  hint={t(`quote.boards.${b}Hint`)}
                  {...register("boards")}
                />
              ))}
            </ChoiceGroup>
            <Field label={t("quote.finishNotes")} error={errorKey(errors, "finishNotes")}>
              {(a) => (
                <TextArea id={a.id} aria-describedby={a.describedBy} rows={3} {...register("finishNotes")} />
              )}
            </Field>
          </>
        )}

        {key === "files" && (
          <>
            <p className="text-ink-muted">{t("quote.filesIntro")}</p>
            <FileUploader items={uploads} onChange={setUploads} />
            {errorKey(errors, "files") && (
              <FormAlert tone="error">
                {t(`errors.${errorKey(errors, "files")}` as "errors.server")}
              </FormAlert>
            )}
          </>
        )}

        {key === "contact" && (
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
            <Field
              label={t("fields.area")}
              hint={t("fields.areaHint")}
              optional
              error={errorKey(errors, "area")}
            >
              {(a) => <TextInput id={a.id} aria-describedby={a.describedBy} {...register("area")} />}
            </Field>
            <Field label={t("fields.customerType")} error={errorKey(errors, "customerType")}>
              {(a) => (
                <Select id={a.id} {...register("customerType")}>
                  {customerTypes.map((c) => (
                    <option key={c} value={c}>
                      {t(`fields.customerTypes.${c}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label={t("fields.message")}
              optional
              error={errorKey(errors, "message")}
              className="sm:col-span-2"
            >
              {(a) => <TextArea id={a.id} aria-describedby={a.describedBy} {...register("message")} />}
            </Field>
            <div className="sm:col-span-2">
              <ConsentFields register={register} errors={errors} />
            </div>
          </div>
        )}

        {key === "review" && (
          <>
            <p className="text-ink-muted">{t("quote.reviewIntro")}</p>
            <dl className="divide-y divide-line border-y border-line">
              {(
                [
                  ["category", values.category ? t(`quote.categories.${values.category}`) : "—"],
                  [
                    "measurements",
                    values.noMeasurements
                      ? t("quote.noMeasurementsYet")
                      : values.walls
                          .filter((w) => w.width !== "" && w.width !== undefined)
                          .map(
                            (w, i) =>
                              `${w.label || t("quote.wall", { n: i + 1 })}: ${[w.width, w.height, w.depth].filter((d) => d !== "" && d !== undefined).join(" × ")} ${values.unit}`,
                          )
                          .join(" · "),
                  ],
                  [
                    "materials",
                    [...values.boards.map((b) => t(`quote.boards.${b}`)), values.finishNotes]
                      .filter(Boolean)
                      .join(" · "),
                  ],
                  [
                    "files",
                    readyFiles.length ? readyFiles.map((f) => f.name).join(", ") : t("quote.noFiles"),
                  ],
                  [
                    "contact",
                    [values.name, values.phone, values.email, values.area].filter(Boolean).join(" · "),
                  ],
                ] as [StepKey, string][]
              ).map(([s, text]) => (
                <div key={s} className="grid gap-2 py-4 sm:grid-cols-[12rem_1fr_auto] sm:items-baseline">
                  <dt className="text-sm text-ink-muted">{t(`quote.steps.${s}`)}</dt>
                  <dd dir="auto">{text}</dd>
                  <dd>
                    <Button type="button" variant="link" onClick={() => setStep(steps.indexOf(s))}>
                      {t("edit")}
                    </Button>
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft aria-hidden className="rtl:rotate-180" /> {t("back")}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" disabled={isSubmitting || (key === "files" && uploading)}>
          {key === "review" ? (isSubmitting ? t("sending") : t("quote.submit")) : t("next")}
          {key !== "review" && <ArrowRight aria-hidden className="rtl:rotate-180" />}
        </Button>
      </div>
    </form>
  );
}
