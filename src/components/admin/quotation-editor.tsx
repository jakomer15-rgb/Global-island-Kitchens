"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { startTransition, useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState, type ActionState } from "@/lib/admin/action-state";
import { computeTotals, formatBhd, formatRate, lineTotal, parseBhd, parseQuantity } from "@/lib/money";
import { adminInput } from "./ui";

export interface EditorLine {
  key: string;
  kind: string;
  description: string;
  materialId: string;
  widthMm: string;
  heightMm: string;
  depthMm: string;
  unit: string;
  quantity: string;
  unitPrice: string;
}

export interface EditorValues {
  title: string;
  locale: "en" | "ar";
  validUntil: string;
  discount: string;
  notes: string;
  terms: string;
  lines: EditorLine[];
}

const kindLabels: Record<string, string> = {
  product: "Product",
  material: "Material",
  hardware: "Hardware",
  labour: "Labour",
  installation: "Installation",
  other: "Other",
};
const unitLabels: Record<string, string> = {
  unit: "Piece",
  set: "Set",
  linear_metre: "Linear metre",
  square_metre: "Square metre",
};

let counter = 0;
const newKey = () => `new-${Date.now()}-${counter++}`;
export const blankLine = (): EditorLine => ({
  key: newKey(),
  kind: "product",
  description: "",
  materialId: "",
  widthMm: "",
  heightMm: "",
  depthMm: "",
  unit: "unit",
  quantity: "1",
  unitPrice: "",
});

/**
 * Draft quotation editor: header fields and line items with live totals (calculated with the same
 * integer-fils rules the server uses; the server recalculates on save).
 */
export function QuotationEditor({
  initial,
  materials,
  vatRateBasisPoints,
  defaultTerms,
  action,
}: {
  initial: EditorValues;
  materials: { id: string; label: string }[];
  vatRateBasisPoints: number;
  /** Terms from Settings per language, swapped in when the language changes (unless edited). */
  defaultTerms: { en: string; ar: string };
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const id = useId();
  const [values, setValues] = useState(initial);
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const set = <K extends keyof EditorValues>(key: K, value: EditorValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setLine = (key: string, patch: Partial<EditorLine>) =>
    setValues((v) => ({ ...v, lines: v.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const move = (index: number, by: number) =>
    setValues((v) => {
      const lines = [...v.lines];
      const [line] = lines.splice(index, 1);
      lines.splice(index + by, 0, line!);
      return { ...v, lines };
    });

  const parsed = values.lines.map((l) => ({
    quantityMilli: parseQuantity(l.quantity) ?? 0,
    unitPriceFils: parseBhd(l.unitPrice) ?? 0,
  }));
  const discountFils = parseBhd(values.discount || "0") ?? 0;
  let totals: ReturnType<typeof computeTotals> | null = null;
  try {
    totals = computeTotals(parsed, discountFils, vatRateBasisPoints);
  } catch {
    totals = null;
  }
  const money = (fils: number) => formatBhd(fils, "en");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData();
        // The server's schema ignores the editor-only `key` of each line.
        data.set("payload", JSON.stringify(values));
        startTransition(() => formAction(data));
      }}
      className="space-y-6"
    >
      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label htmlFor={`${id}-title`} className="text-sm font-medium">
            Project / title
          </label>
          <input
            id={`${id}-title`}
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            required
            maxLength={200}
            className={adminInput}
          />
        </div>
        <div>
          <label htmlFor={`${id}-locale`} className="text-sm font-medium">
            Document language
          </label>
          <select
            id={`${id}-locale`}
            value={values.locale}
            onChange={(e) => {
              const locale = e.target.value as "en" | "ar";
              setValues((v) => ({
                ...v,
                locale,
                terms: v.terms.trim() === defaultTerms[v.locale].trim() ? defaultTerms[locale] : v.terms,
              }));
            }}
            className={adminInput}
          >
            <option value="en">English</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-valid`} className="text-sm font-medium">
            Valid until
          </label>
          <input
            id={`${id}-valid`}
            type="date"
            value={values.validUntil}
            onChange={(e) => set("validUntil", e.target.value)}
            className={adminInput}
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Items</legend>
        <ol className="mt-2 space-y-3">
          {values.lines.map((line, i) => {
            const amount = lineTotal(parsed[i]!.quantityMilli, parsed[i]!.unitPriceFils);
            const field = (name: string) => `${id}-${line.key}-${name}`;
            return (
              <li key={line.key} className="border border-line bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Item {i + 1}</span>
                  <span className="flex items-center gap-1">
                    <span className="me-3 text-sm tabular-nums">{money(amount)}</span>
                    <IconButton
                      label={`Move item ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp aria-hidden className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Move item ${i + 1} down`}
                      disabled={i === values.lines.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown aria-hidden className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Remove item ${i + 1}`}
                      onClick={() =>
                        setValues((v) => ({ ...v, lines: v.lines.filter((l) => l.key !== line.key) }))
                      }
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </IconButton>
                  </span>
                </div>
                <div className="mt-2 grid gap-3 md:grid-cols-6">
                  <Field id={field("desc")} label="Description" className="md:col-span-6">
                    <textarea
                      id={field("desc")}
                      value={line.description}
                      onChange={(e) => setLine(line.key, { description: e.target.value })}
                      rows={2}
                      maxLength={500}
                      className={adminInput}
                    />
                  </Field>
                  <Field id={field("kind")} label="Type" className="md:col-span-2">
                    <select
                      id={field("kind")}
                      value={line.kind}
                      onChange={(e) => setLine(line.key, { kind: e.target.value })}
                      className={adminInput}
                    >
                      {Object.entries(kindLabels).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id={field("material")} label="Material (library)" className="md:col-span-4">
                    <select
                      id={field("material")}
                      value={line.materialId}
                      onChange={(e) => setLine(line.key, { materialId: e.target.value })}
                      className={adminInput}
                    >
                      <option value="">None</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {(["widthMm", "heightMm", "depthMm"] as const).map((dim) => (
                    <Field
                      key={dim}
                      id={field(dim)}
                      label={`${dim.replace("Mm", "")} (mm)`.replace(/^./, (c) => c.toUpperCase())}
                    >
                      <input
                        id={field(dim)}
                        inputMode="numeric"
                        value={line[dim]}
                        onChange={(e) => setLine(line.key, { [dim]: e.target.value })}
                        className={adminInput}
                        dir="ltr"
                      />
                    </Field>
                  ))}
                  <Field id={field("unit")} label="Unit">
                    <select
                      id={field("unit")}
                      value={line.unit}
                      onChange={(e) => setLine(line.key, { unit: e.target.value })}
                      className={adminInput}
                    >
                      {Object.entries(unitLabels).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id={field("qty")} label="Quantity">
                    <input
                      id={field("qty")}
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                      className={adminInput}
                      dir="ltr"
                    />
                  </Field>
                  <Field id={field("price")} label="Unit price (BHD)">
                    <input
                      id={field("price")}
                      inputMode="decimal"
                      value={line.unitPrice}
                      onChange={(e) => setLine(line.key, { unitPrice: e.target.value })}
                      placeholder="0.000"
                      className={adminInput}
                      dir="ltr"
                    />
                  </Field>
                </div>
              </li>
            );
          })}
        </ol>
        <Button
          type="button"
          variant="outline"
          className="mt-3 min-h-10 px-4 py-2"
          onClick={() => setValues((v) => ({ ...v, lines: [...v.lines, blankLine()] }))}
        >
          <Plus aria-hidden /> Add item
        </Button>
      </fieldset>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-4">
          <Field id={`${id}-notes`} label="Notes (printed)">
            <textarea
              id={`${id}-notes`}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              maxLength={2000}
              className={adminInput}
            />
          </Field>
          <Field id={`${id}-terms`} label="Terms and conditions (printed)">
            <textarea
              id={`${id}-terms`}
              value={values.terms}
              onChange={(e) => set("terms", e.target.value)}
              rows={5}
              maxLength={4000}
              className={adminInput}
            />
          </Field>
        </div>
        <div className="space-y-3 border border-line bg-white p-4 text-sm">
          <Field id={`${id}-discount`} label="Discount (BHD)">
            <input
              id={`${id}-discount`}
              inputMode="decimal"
              value={values.discount}
              onChange={(e) => set("discount", e.target.value)}
              placeholder="0.000"
              className={adminInput}
              dir="ltr"
            />
          </Field>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 tabular-nums" aria-live="polite">
            <dt>Subtotal</dt>
            <dd className="text-end">{totals ? money(totals.subtotalFils) : "—"}</dd>
            <dt>Discount</dt>
            <dd className="text-end">{totals ? money(totals.discountFils) : "More than the subtotal"}</dd>
            <dt>{vatRateBasisPoints ? `VAT (${formatRate(vatRateBasisPoints)})` : "VAT (off)"}</dt>
            <dd className="text-end">{totals ? money(totals.vatFils) : "—"}</dd>
            <dt className="border-t border-line pt-1 font-medium">Total</dt>
            <dd className="border-t border-line pt-1 text-end font-medium">
              {totals ? money(totals.totalFils) : "—"}
            </dd>
          </dl>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} className="min-h-10 px-4 py-2">
          {pending ? "Saving…" : "Save draft"}
        </Button>
        {(state.message || state.error) && (
          <p
            role={state.error ? "alert" : "status"}
            className={state.error ? "text-sm text-red-800" : "text-sm text-emerald-800"}
          >
            {state.error ?? state.message}
          </p>
        )}
        {state.fieldErrors && (
          <ul className="w-full list-disc ps-5 text-sm text-red-800">
            {Object.entries(state.fieldErrors).map(([f, m]) => (
              <li key={f}>
                <span className="font-medium">{f.replace(/^./, (ch) => ch.toUpperCase())}:</span> {m}
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-9 items-center justify-center hover:bg-sand disabled:opacity-30"
    >
      {children}
    </button>
  );
}
