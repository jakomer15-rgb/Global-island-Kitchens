import Link from "next/link";
import { Table, Td, Th } from "@/components/admin/ui";

/** Shows one query result (the figures the AI was given) as plain tables, with links to leads and quotations. */

const titles: Record<string, string> = {
  summary: "Main figures",
  leads_by_source: "Leads by source",
  leads_by_product: "Leads by product",
  new_customers: "New customers",
  campaign_results: "Campaign results",
  social_performance: "Social media",
  pipeline_now: "Open leads by stage (now)",
  follow_ups_due: "Follow-ups due",
  quotations_awaiting: "Quotations awaiting the customer",
};

const words = (k: string) =>
  k
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

type Value = string | number | boolean | null | Value[] | { [k: string]: Value };

function cell(key: string, v: Value, row: Record<string, Value>) {
  if (key === "lead" && typeof row.leadId === "string")
    return (
      <Link href={`/admin/leads/${row.leadId}`} className="underline underline-offset-4">
        {String(v)}
      </Link>
    );
  if (key === "quotation" && typeof row.quotationId === "string")
    return (
      <Link href={`/admin/quotations/${row.quotationId}`} className="underline underline-offset-4">
        {String(v)}
      </Link>
    );
  if ((key === "due" || key === "sent") && typeof v === "string")
    return new Date(v).toLocaleString("en-GB", {
      timeZone: "Asia/Bahrain",
      dateStyle: "medium",
      timeStyle: "short",
    });
  if (typeof v === "number") return Number.isInteger(v) ? v : Math.round(v * 10) / 10;
  if (typeof v === "boolean") return v ? "yes" : "no";
  return v === null ? "—" : String(v);
}

function Rows({ label, rows }: { label: string; rows: Record<string, Value>[] }) {
  if (!rows.length) return <p className="text-sm text-ink-muted">{label}: none.</p>;
  const keys = Object.keys(rows[0]!).filter((k) => !k.endsWith("Id"));
  return (
    <Table label={label}>
      <thead>
        <tr>
          {keys.map((k) => (
            <Th key={k}>{words(k)}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {keys.map((k) => (
              <Td key={k} className="tabular-nums">
                {cell(k, r[k] as Value, r)}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function Figures({ data }: { data: Record<string, Value> }) {
  const scalars = Object.entries(data).filter(([, v]) => v === null || typeof v !== "object");
  return (
    <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      {scalars.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-line/60 py-1">
          <dt className="text-ink-muted">{words(k)}</dt>
          <dd className="tabular-nums">{cell(k, v, data)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ResultView({ result }: { result: Record<string, Value> }) {
  const { query, period, ...rest } = result;
  const p = period as { label?: string; from?: string; to?: string } | undefined;
  const nested = Object.entries(rest).filter(([, v]) => v && typeof v === "object");
  const flat = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v === null || typeof v !== "object"),
  );
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">
        {titles[String(query)] ?? String(query)}
        {p ? ` · ${p.label} (${p.from}${p.to !== p.from ? ` to ${p.to}` : ""})` : ""}
      </h3>
      {Object.keys(flat).length > 0 && <Figures data={flat as Record<string, Value>} />}
      {nested.map(([k, v]) =>
        Array.isArray(v) ? (
          <Rows key={k} label={words(k)} rows={v as Record<string, Value>[]} />
        ) : (
          <div key={k}>
            <p className="mb-1 text-xs font-medium text-ink-muted">{words(k)}</p>
            <Figures data={v as Record<string, Value>} />
          </div>
        ),
      )}
    </section>
  );
}
