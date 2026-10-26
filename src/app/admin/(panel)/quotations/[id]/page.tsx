import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { AdminSelect, AdminTextarea } from "@/components/admin/fields";
import { QuotationEditor, type EditorValues } from "@/components/admin/quotation-editor";
import { Badge, fmtDate, fmtDateTime, label, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { formatDimensions } from "@/lib/dimensions";
import { filsToInput, formatBhd, formatRate, quantityToText } from "@/lib/money";
import { parseSetting } from "@/lib/site-settings";
import { CUID } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { getQuotation } from "@/server/quotations/quotations";
import {
  approvalAction,
  convertAction,
  deleteDraftAction,
  markSentAction,
  newRevisionAction,
  rejectionAction,
  saveDraftAction,
  storePdfAction,
} from "../actions";
import { quotationTone } from "../tones";

export const metadata: Metadata = { title: "Quotation" };

const money = (fils: bigint) => formatBhd(Number(fils));
const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function QuotationPage({ params }: PageProps<"/admin/quotations/[id]">) {
  const actor = await requireActor("quotation.read");
  const { id } = await params;
  if (!CUID.test(id)) notFound();
  const q = await getQuotation(db, actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const latest = q.revisions[0]!;
  const canManage = can(actor, "quotation.manage");
  const canApprove = can(actor, "quotation.approve");
  const editing = q.status === "draft" && !latest.lockedAt && canManage;
  const everSent = q.revisions.some((r) => r.lockedAt);

  let editor: {
    initial: EditorValues;
    materials: { id: string; label: string }[];
    vat: number;
    terms: { en: string; ar: string };
  } | null = null;
  if (editing) {
    const [materials, settingRow] = await Promise.all([
      db.material.findMany({
        where: { availability: { not: "discontinued" } },
        select: { id: true, code: true, nameEn: true, board: true },
        orderBy: [{ board: "asc" }, { code: "asc" }],
      }),
      db.siteSetting.findUnique({ where: { key: "quotation" } }),
    ]);
    const settings = parseSetting("quotation", settingRow?.value);
    editor = {
      vat: settings.vatEnabled ? settings.vatRateBasisPoints : 0,
      terms: { en: settings.termsEn ?? "", ar: settings.termsAr ?? "" },
      materials: materials.map((m) => ({ id: m.id, label: `${m.code} · ${m.nameEn}` })),
      initial: {
        title: q.title,
        locale: q.locale,
        validUntil: dateInput(latest.validUntil),
        discount: latest.discountFils > 0n ? filsToInput(Number(latest.discountFils)) : "",
        notes: latest.notes ?? "",
        terms: latest.terms ?? "",
        lines: latest.lines.map((l) => ({
          key: l.id,
          kind: l.kind,
          description: l.description,
          materialId: l.materialId ?? "",
          widthMm: l.widthMm?.toString() ?? "",
          heightMm: l.heightMm?.toString() ?? "",
          depthMm: l.depthMm?.toString() ?? "",
          unit: l.unit,
          quantity: quantityToText(l.quantityMilli),
          unitPrice: filsToInput(Number(l.unitPriceFils)),
        })),
      },
    };
  }

  const pdfHref = (revId: string) => `/admin/quotations/${q.id}/pdf?rev=${revId}`;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/quotations" className="underline underline-offset-4">
          ← All quotations
        </Link>
      </p>
      <PageHeader
        title={`${q.number} · ${q.customer.name}`}
        description={`${q.title} · revision ${latest.revision} · ${q.locale === "ar" ? "Arabic" : "English"} document`}
        actions={<Badge tone={quotationTone[q.status]}>{label(q.status)}</Badge>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {editor ? (
            <Panel title={`Revision ${latest.revision} (draft)`}>
              <QuotationEditor
                initial={editor.initial}
                materials={editor.materials}
                vatRateBasisPoints={editor.vat}
                defaultTerms={editor.terms}
                action={saveDraftAction.bind(null, q.id)}
              />
            </Panel>
          ) : (
            <Panel title={`Revision ${latest.revision}${latest.lockedAt ? " (sent, locked)" : " (draft)"}`}>
              <Table label={`Revision ${latest.revision} items`}>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Description</Th>
                    <Th>Qty</Th>
                    <Th>Unit price</Th>
                    <Th>Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {latest.lines.map((l, i) => (
                    <tr key={l.id} className="align-top">
                      <Td>{i + 1}</Td>
                      <Td>
                        <span className="whitespace-pre-line">{l.description}</span>
                        {l.material && (
                          <span className="block text-xs text-ink-muted">
                            {l.material.code} · {l.material.nameEn}
                          </span>
                        )}
                        {formatDimensions(l) && (
                          <span className="block text-xs text-ink-muted">{formatDimensions(l)}</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        {quantityToText(l.quantityMilli)} {label(l.unit)}
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums">{money(l.unitPriceFils)}</Td>
                      <Td className="whitespace-nowrap tabular-nums">{money(l.lineTotalFils)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <dl className="ms-auto mt-4 grid max-w-xs grid-cols-[1fr_auto] gap-y-1 text-sm tabular-nums">
                <dt>Subtotal</dt>
                <dd className="text-end">{money(latest.subtotalFils)}</dd>
                <dt>Discount</dt>
                <dd className="text-end">{money(latest.discountFils)}</dd>
                <dt>
                  {latest.vatRateBasisPoints ? `VAT (${formatRate(latest.vatRateBasisPoints)})` : "VAT (off)"}
                </dt>
                <dd className="text-end">{money(latest.vatFils)}</dd>
                <dt className="border-t border-line pt-1 font-medium">Total</dt>
                <dd className="border-t border-line pt-1 text-end font-medium">{money(latest.totalFils)}</dd>
              </dl>
            </Panel>
          )}

          <Panel title="Revisions">
            <ul className="divide-y divide-line text-sm">
              {q.revisions.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <span>
                    <span className="font-medium">Revision {r.revision}</span> · {money(r.totalFils)}
                    <span className="block text-xs text-ink-muted">
                      {r.sentAt
                        ? `Sent ${fmtDateTime(r.sentAt)} by ${r.sentBy?.name ?? "—"}${r.validUntil ? ` · valid until ${fmtDate(r.validUntil)}` : ""}`
                        : "Draft"}
                    </span>
                    {r.approvedAt && (
                      <span className="block text-xs text-emerald-800">
                        Approved by {label(r.approvalMethod ?? "")} {fmtDateTime(r.approvedAt)}:{" "}
                        {r.approvalNote}
                        {r.approvalRecordedBy && ` (recorded by ${r.approvalRecordedBy.name})`}
                      </span>
                    )}
                    {r.order && (
                      <span className="block text-xs">
                        Order {r.order.number}
                        {r.order.project && (
                          <>
                            {" "}
                            ·{" "}
                            <Link href={`/admin/projects/${r.order.project.id}`} className="underline">
                              project {r.order.project.reference}
                            </Link>
                          </>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    <a
                      href={pdfHref(r.id)}
                      target="_blank"
                      rel="noopener"
                      className="underline underline-offset-4"
                    >
                      {r.lockedAt ? (r.pdfFileId ? "PDF" : "PDF (render)") : "Preview PDF"}
                    </a>
                    {r.lockedAt && !r.pdfFileId && canManage && (
                      <ActionForm
                        action={storePdfAction.bind(null, q.id, r.id)}
                        submitLabel="Store PDF"
                        variant="outline"
                      />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <p className="font-medium">
              <Link href={`/admin/customers/${q.customer.id}`} className="underline-offset-4 hover:underline">
                {q.customer.name}
              </Link>
            </p>
            {q.customer.phone && (
              <p dir="ltr" className="text-sm">
                {q.customer.phone}
              </p>
            )}
            {q.customer.email && <p className="text-sm break-all">{q.customer.email}</p>}
            {q.lead && (
              <p className="mt-2 text-sm">
                Lead{" "}
                <Link href={`/admin/leads/${q.lead.id}`} className="font-mono text-xs underline">
                  {q.lead.reference}
                </Link>
              </p>
            )}
            {q.status === "rejected" && q.rejectedReason && (
              <p className="mt-2 text-sm text-red-800">Declined: {q.rejectedReason}</p>
            )}
          </Panel>

          {editing && (
            <Panel title="Send">
              <p className="mb-3 text-sm text-ink-muted">
                Save the draft, check the preview PDF, send it to the customer (e.g. on WhatsApp), then mark
                it as sent. Sending locks this revision.
              </p>
              <ActionForm
                action={markSentAction.bind(null, q.id)}
                submitLabel="Mark as sent"
                confirm="Lock this revision as sent to the customer? It can't be edited afterwards."
              />
              {!everSent && (
                <ActionForm
                  action={deleteDraftAction.bind(null, q.id)}
                  submitLabel="Delete draft"
                  variant="outline"
                  className="mt-4"
                  confirm="Delete this draft quotation?"
                />
              )}
            </Panel>
          )}

          {q.status === "sent" && canApprove && (
            <Panel title="Customer's answer">
              <ActionForm action={approvalAction.bind(null, q.id)} submitLabel="Record approval">
                <AdminSelect
                  label="Approved by"
                  name="method"
                  options={[
                    { value: "whatsapp", label: "WhatsApp" },
                    { value: "phone", label: "Phone call" },
                  ]}
                />
                <AdminTextarea
                  label="Who approved, and details"
                  name="note"
                  rows={2}
                  required
                  maxLength={500}
                  hint="e.g. “Mrs A. replied ‘approved’ on WhatsApp at 14:10.”"
                />
              </ActionForm>
              <ActionForm
                action={rejectionAction.bind(null, q.id)}
                submitLabel="Record as declined"
                variant="outline"
                className="mt-6"
              >
                <AdminTextarea label="Reason" name="reason" rows={2} required maxLength={500} />
              </ActionForm>
            </Panel>
          )}

          {(q.status === "sent" || q.status === "rejected") && canManage && (
            <Panel title="Change the quotation">
              <p className="mb-3 text-sm text-ink-muted">
                Copies revision {latest.revision} into a new draft.
              </p>
              <ActionForm
                action={newRevisionAction.bind(null, q.id)}
                submitLabel="Start a new revision"
                variant="outline"
              />
            </Panel>
          )}

          {q.status === "approved" && canApprove && can(actor, "project.manage") && (
            <Panel title="Order and project">
              <p className="mb-3 text-sm text-ink-muted">
                Creates the order for {money(latest.totalFils)} and moves the project into production.
              </p>
              <ActionForm
                action={convertAction.bind(null, q.id)}
                submitLabel="Convert to order and project"
                confirm="Create the order and project from the approved revision?"
              />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
