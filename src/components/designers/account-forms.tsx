"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { designerSignInAction, designerSignOutAction, registerDesignerAction } from "@/app/actions/designer";
import { Button } from "@/components/ui/button";
import { portal } from "@/content/portal";
import { professions } from "@/lib/designer";
import { localizedPath } from "@/lib/seo";
import { errorText, Honeypot, PAlert, PField, PInput, PSelect, tr, type PortalLocale } from "./ui";

export function RegisterForm({ locale }: { locale: PortalLocale }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [startedAt] = useState(() => Date.now());
  const [website, setWebsite] = useState("");
  const [values, setValues] = useState({
    name: "",
    company: "",
    profession: "interior_designer",
    phone: "",
    email: "",
    password: "",
    privacyAccepted: false,
  });
  const set = (key: keyof typeof values, value: string | boolean) =>
    setValues((v) => ({ ...v, [key]: value }));
  const e = (key: string) => errorText(fields[key], locale);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setFields({});
    start(async () => {
      const result = await registerDesignerAction({ ...values, website, startedAt, locale });
      if (result.ok) return setDone(true);
      setFields(result.fieldErrors ?? {});
      setError(result.error);
    });
  }

  if (done) return <PAlert tone="info">{tr(portal.register.done, locale)}</PAlert>;

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-6">
      <Honeypot value={website} onChange={setWebsite} />
      {error && <PAlert tone="error">{errorText(error, locale)}</PAlert>}
      <PField label={tr(portal.fields.name, locale)} error={e("name")}>
        {(a) => (
          <PInput
            id={a.id}
            aria-describedby={a.describedBy}
            aria-invalid={a.invalid}
            autoComplete="name"
            required
            value={values.name}
            onChange={(ev) => set("name", ev.target.value)}
          />
        )}
      </PField>
      <div className="grid gap-6 sm:grid-cols-2">
        <PField
          label={`${tr(portal.fields.company, locale)} (${tr(portal.fields.optional, locale)})`}
          error={e("company")}
        >
          {(a) => (
            <PInput
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              autoComplete="organization"
              value={values.company}
              onChange={(ev) => set("company", ev.target.value)}
            />
          )}
        </PField>
        <PField label={tr(portal.fields.profession, locale)} error={e("profession")}>
          {(a) => (
            <PSelect
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              value={values.profession}
              onChange={(ev) => set("profession", ev.target.value)}
            >
              {professions.map((p) => (
                <option key={p} value={p}>
                  {tr(portal.professions[p], locale)}
                </option>
              ))}
            </PSelect>
          )}
        </PField>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <PField
          label={tr(portal.fields.phone, locale)}
          hint={tr(portal.fields.phoneHint, locale)}
          error={e("phone")}
        >
          {(a) => (
            <PInput
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              required
              value={values.phone}
              onChange={(ev) => set("phone", ev.target.value)}
            />
          )}
        </PField>
        <PField label={tr(portal.fields.email, locale)} error={e("email")}>
          {(a) => (
            <PInput
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              type="email"
              autoComplete="email"
              dir="ltr"
              required
              value={values.email}
              onChange={(ev) => set("email", ev.target.value)}
            />
          )}
        </PField>
      </div>
      <PField
        label={tr(portal.fields.password, locale)}
        hint={tr(portal.fields.passwordHint, locale)}
        error={e("password")}
      >
        {(a) => (
          <PInput
            id={a.id}
            aria-describedby={a.describedBy}
            aria-invalid={a.invalid}
            type="password"
            autoComplete="new-password"
            dir="ltr"
            required
            minLength={12}
            maxLength={128}
            value={values.password}
            onChange={(ev) => set("password", ev.target.value)}
          />
        )}
      </PField>
      <div>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-walnut"
            checked={values.privacyAccepted}
            aria-invalid={Boolean(fields.privacyAccepted) || undefined}
            onChange={(ev) => set("privacyAccepted", ev.target.checked)}
          />
          <span>{tr(portal.fields.privacy, locale)}</span>
        </label>
        {fields.privacyAccepted && <p className="text-sm text-red-800">{errorText("privacy", locale)}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? tr(portal.register.sending, locale) : tr(portal.register.submit, locale)}
        </Button>
        <p className="text-sm">
          {tr(portal.register.haveAccount, locale)}{" "}
          <Link href={localizedPath("/designers/sign-in", locale)} className="underline underline-offset-4">
            {tr(portal.signIn.submit, locale)}
          </Link>
        </p>
      </div>
    </form>
  );
}

export function SignInForm({ locale }: { locale: PortalLocale }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [values, setValues] = useState({ email: "", password: "" });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    start(async () => {
      // On success the action redirects to the portal and never returns.
      const result = await designerSignInAction(values, locale);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <PAlert tone="error">
          {error === "tooMany" ? tr(portal.signIn.tooMany, locale) : tr(portal.signIn.wrong, locale)}
        </PAlert>
      )}
      <PField label={tr(portal.fields.email, locale)}>
        {(a) => (
          <PInput
            id={a.id}
            type="email"
            autoComplete="username"
            dir="ltr"
            required
            value={values.email}
            onChange={(ev) => setValues((v) => ({ ...v, email: ev.target.value }))}
          />
        )}
      </PField>
      <PField label={tr(portal.fields.password, locale)}>
        {(a) => (
          <PInput
            id={a.id}
            type="password"
            autoComplete="current-password"
            dir="ltr"
            required
            value={values.password}
            onChange={(ev) => setValues((v) => ({ ...v, password: ev.target.value }))}
          />
        )}
      </PField>
      <div className="flex flex-wrap items-center gap-6">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? tr(portal.signIn.signingIn, locale) : tr(portal.signIn.submit, locale)}
        </Button>
        <p className="text-sm">
          {tr(portal.signIn.noAccount, locale)}{" "}
          <Link href={localizedPath("/designers/register", locale)} className="underline underline-offset-4">
            {tr(portal.registerCta, locale)}
          </Link>
        </p>
      </div>
    </form>
  );
}

export function SignOutButton({ locale }: { locale: PortalLocale }) {
  return (
    <form action={designerSignOutAction.bind(null, locale)}>
      <Button type="submit" variant="outline">
        {tr(portal.home.signOut, locale)}
      </Button>
    </form>
  );
}
