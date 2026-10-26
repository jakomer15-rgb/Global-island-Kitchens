"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendDesignerMessageAction, submitDesignerProjectAction } from "@/app/actions/designer";
import { FileUploader, type UploadItem } from "@/components/forms/file-uploader";
import { Button } from "@/components/ui/button";
import { portal } from "@/content/portal";
import { MAX_WALLS, quoteCategories, units } from "@/lib/forms/quote";
import { localizedPath } from "@/lib/seo";
import { errorText, Honeypot, PAlert, PField, PInput, PSelect, PTextarea, tr, type PortalLocale } from "./ui";

interface MaterialOption {
  id: string;
  label: string;
}

const blankWall = { label: "", width: "", height: "", depth: "" };

export function ProjectForm({ locale, materials }: { locale: PortalLocale; materials: MaterialOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [startedAt] = useState(() => Date.now());
  const [website, setWebsite] = useState("");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [values, setValues] = useState({
    title: "",
    category: "" as string,
    clientLabel: "",
    area: "",
    targetDate: "",
    message: "",
    finishNotes: "",
    unit: "cm" as (typeof units)[number],
    noMeasurements: false,
  });
  const [walls, setWalls] = useState([{ ...blankWall }]);
  const [boards, setBoards] = useState<string[]>([]);
  const [materialIds, setMaterialIds] = useState<string[]>([]);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const e = (key: string) => errorText(fields[key], locale);
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  const updateWall = (index: number, key: keyof typeof blankWall, value: string) =>
    setWalls((list) => list.map((w, i) => (i === index ? { ...w, [key]: value } : w)));

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setFields({});
    if (uploads.some((u) => u.status === "uploading")) return;
    start(async () => {
      const result = await submitDesignerProjectAction({
        ...values,
        walls: walls.map((w) => ({ label: w.label, width: w.width, height: w.height, depth: w.depth })),
        boards,
        materialIds,
        files: uploads.filter((u) => u.status === "ready").map((u) => ({ id: u.id!, ticket: u.ticket! })),
        website,
        startedAt,
        locale,
      });
      if (result.ok && result.id) {
        router.push(`${localizedPath("/designers/portal/projects", locale)}/${result.id}?sent=1`);
        return;
      }
      if (!result.ok) {
        setFields(result.fieldErrors ?? {});
        setError(result.error);
      }
    });
  }

  const p = portal.project;
  const boardOptions = [
    ["egger", p.boardEgger],
    ["mdf", p.boardMdf],
    ["aluminium", p.boardAluminium],
    ["unsure", p.boardUnsure],
  ] as const;

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-8">
      <Honeypot value={website} onChange={setWebsite} />
      {error && <PAlert tone="error">{errorText(error, locale)}</PAlert>}

      <div className="grid gap-6 sm:grid-cols-2">
        <PField label={tr(p.title, locale)} error={e("title")}>
          {(a) => (
            <PInput
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              required
              value={values.title}
              onChange={(ev) => set("title", ev.target.value)}
            />
          )}
        </PField>
        <PField label={tr(p.category, locale)} error={e("category")}>
          {(a) => (
            <PSelect
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              required
              value={values.category}
              onChange={(ev) => set("category", ev.target.value)}
            >
              <option value="" />
              {quoteCategories.map((c) => (
                <option key={c} value={c}>
                  {tr(p.categories[c], locale)}
                </option>
              ))}
            </PSelect>
          )}
        </PField>
        <PField
          label={tr(p.clientLabel, locale)}
          hint={tr(p.clientLabelHint, locale)}
          error={e("clientLabel")}
        >
          {(a) => (
            <PInput
              id={a.id}
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid}
              value={values.clientLabel}
              onChange={(ev) => set("clientLabel", ev.target.value)}
            />
          )}
        </PField>
        <div className="grid gap-6">
          <PField label={tr(p.area, locale)} error={e("area")}>
            {(a) => (
              <PInput
                id={a.id}
                aria-describedby={a.describedBy}
                aria-invalid={a.invalid}
                value={values.area}
                onChange={(ev) => set("area", ev.target.value)}
              />
            )}
          </PField>
          <PField label={tr(p.targetDate, locale)} error={e("targetDate")}>
            {(a) => (
              <PInput
                id={a.id}
                aria-describedby={a.describedBy}
                aria-invalid={a.invalid}
                type="date"
                dir="ltr"
                value={values.targetDate}
                onChange={(ev) => set("targetDate", ev.target.value)}
              />
            )}
          </PField>
        </div>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-lg font-medium">{tr(p.measurements, locale)}</legend>
        <div className="max-w-40">
          <PField label={tr(p.unit, locale)}>
            {(a) => (
              <PSelect
                id={a.id}
                value={values.unit}
                onChange={(ev) => set("unit", ev.target.value as typeof values.unit)}
              >
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </PSelect>
            )}
          </PField>
        </div>
        {!values.noMeasurements &&
          walls.map((wall, i) => (
            <div key={i} className="grid gap-4 border border-line bg-white p-4 sm:grid-cols-4">
              <PField label={`${tr(p.wall, locale)} ${i + 1}`} className="sm:col-span-4">
                {(a) => (
                  <PInput
                    id={a.id}
                    value={wall.label}
                    maxLength={60}
                    onChange={(ev) => updateWall(i, "label", ev.target.value)}
                  />
                )}
              </PField>
              {(["width", "height", "depth"] as const).map((key) => (
                <PField
                  key={key}
                  label={tr(p[key], locale)}
                  error={e(`walls.${i}.${key}`) ?? (key === "width" ? e(`walls.${i}.width`) : undefined)}
                >
                  {(a) => (
                    <PInput
                      id={a.id}
                      aria-describedby={a.describedBy}
                      aria-invalid={a.invalid}
                      inputMode="decimal"
                      dir="ltr"
                      value={wall[key]}
                      onChange={(ev) => updateWall(i, key, ev.target.value)}
                    />
                  )}
                </PField>
              ))}
              {walls.length > 1 && (
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWalls((l) => l.filter((_, j) => j !== i))}
                  >
                    {tr(p.removeWall, locale)}
                  </Button>
                </div>
              )}
            </div>
          ))}
        {!values.noMeasurements && walls.length < MAX_WALLS && (
          <Button type="button" variant="outline" onClick={() => setWalls((l) => [...l, { ...blankWall }])}>
            {tr(p.addWall, locale)}
          </Button>
        )}
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-walnut"
            checked={values.noMeasurements}
            onChange={(ev) => set("noMeasurements", ev.target.checked)}
          />
          {tr(p.noMeasurements, locale)}
        </label>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-medium">{tr(p.boards, locale)}</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {boardOptions.map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-center gap-3 border border-charcoal/20 bg-white p-4 has-[:checked]:border-walnut has-[:checked]:bg-sand"
            >
              <input
                type="checkbox"
                className="size-4 accent-walnut"
                checked={boards.includes(value)}
                onChange={() => setBoards((l) => toggle(l, value))}
              />
              {tr(label, locale)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-medium">{tr(p.materials, locale)}</legend>
        {materials.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">{tr(p.materialsNone, locale)}</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {materials.map((m) => (
              <label
                key={m.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 border border-charcoal/20 bg-white p-4 has-[:checked]:border-walnut has-[:checked]:bg-sand"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-walnut"
                  checked={materialIds.includes(m.id)}
                  onChange={() => setMaterialIds((l) => toggle(l, m.id))}
                />
                <span dir="auto">{m.label}</span>
              </label>
            ))}
          </div>
        )}
        {fields.materialIds && <p className="mt-2 text-sm text-red-800">{e("materialIds")}</p>}
        <PField label={tr(p.finishNotes, locale)} className="mt-4" error={e("finishNotes")}>
          {(a) => (
            <PTextarea
              id={a.id}
              rows={3}
              value={values.finishNotes}
              onChange={(ev) => set("finishNotes", ev.target.value)}
            />
          )}
        </PField>
      </fieldset>

      <div>
        <h2 className="mb-3 text-lg font-medium">{tr(p.files, locale)}</h2>
        <FileUploader items={uploads} onChange={setUploads} />
        {fields.files && <p className="mt-2 text-sm text-red-800">{e("files")}</p>}
      </div>

      <PField label={tr(p.message, locale)} error={e("message")}>
        {(a) => (
          <PTextarea
            id={a.id}
            rows={5}
            value={values.message}
            onChange={(ev) => set("message", ev.target.value)}
          />
        )}
      </PField>

      <Button type="submit" size="lg" disabled={pending || uploads.some((u) => u.status === "uploading")}>
        {pending ? tr(p.sending, locale) : tr(p.submit, locale)}
      </Button>
    </form>
  );
}

export function MessageForm({ locale, projectId }: { locale: PortalLocale; projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState(null);
    start(async () => {
      const result = await sendDesignerMessageAction(projectId, { body });
      if (result.ok) {
        setBody("");
        setState({ ok: true, text: tr(portal.project.messageSent, locale) });
        // Refresh so the new message appears in the thread.
        router.refresh();
      } else {
        setState({ ok: false, text: errorText(result.fieldErrors?.body ?? result.error, locale) ?? "" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {state && <PAlert tone={state.ok ? "info" : "error"}>{state.text}</PAlert>}
      <PField label={tr(portal.project.writeMessage, locale)}>
        {(a) => (
          <PTextarea
            id={a.id}
            rows={4}
            required
            maxLength={2000}
            value={body}
            onChange={(ev) => setBody(ev.target.value)}
          />
        )}
      </PField>
      <Button type="submit" disabled={pending || !body.trim()}>
        {tr(portal.project.sendMessage, locale)}
      </Button>
    </form>
  );
}
