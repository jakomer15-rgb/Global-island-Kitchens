import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { Wordmark } from "@/components/site/wordmark";
import { company } from "@/config/company";
import { quotationDoc as c } from "@/content/quotation";
import { formatDimensions } from "@/lib/dimensions";
import { formatBhd, formatRate, quantityToText } from "@/lib/money";
import { parseSetting } from "@/lib/site-settings";
import { CUID } from "@/server/admin/action";
import { verifyDocumentToken } from "@/server/quotations/document-token";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Quotation" };
export const dynamic = "force-dynamic";

const arabicFonts = {
  "--font-display": 'var(--font-amiri), "Times New Roman", serif',
  "--font-sans": 'var(--font-plex-arabic), "Segoe UI", Tahoma, sans-serif',
} as CSSProperties;

/**
 * The quotation as the customer sees it; headless Chrome prints this page to PDF
 * (src/server/quotations/pdf.ts). Plain HTML and CSS sized for A4. Rendered on demand, never cached.
 */
export default async function QuotationDocument({
  params,
  searchParams,
}: PageProps<"/documents/quotations/[id]">) {
  const { id } = await params;
  const { rev, token } = await searchParams;
  // Only reachable with a short-lived token for this revision (issued to the PDF renderer).
  if (!CUID.test(id) || typeof rev !== "string" || !CUID.test(rev) || typeof token !== "string") notFound();
  if (!verifyDocumentToken(token, rev)) notFound();

  const quotation = await db.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      revisions: {
        where: { id: rev },
        orderBy: { revision: "desc" },
        take: 1,
        include: {
          lines: {
            orderBy: { sortOrder: "asc" },
            include: { material: { select: { code: true, nameEn: true, nameAr: true, board: true } } },
          },
        },
      },
    },
  });
  const revision = quotation?.revisions[0];
  if (!quotation || !revision) notFound();

  const [contactRow, locationsRow] = await Promise.all([
    db.siteSetting.findUnique({ where: { key: "contact" } }),
    db.siteSetting.findUnique({ where: { key: "locations" } }),
  ]);
  const contact = parseSetting("contact", contactRow?.value);
  const locations = parseSetting("locations", locationsRow?.value);

  const locale = quotation.locale;
  const ar = locale === "ar";
  const t = (v: { en: string; ar: string }) => v[locale];
  const money = (fils: bigint) => formatBhd(Number(fils), locale);
  const date = (d: Date) =>
    new Intl.DateTimeFormat(ar ? "ar-BH-u-nu-latn" : "en-GB", {
      dateStyle: "long",
      timeZone: "Asia/Bahrain",
    }).format(d);
  const issued = revision.sentAt ?? new Date();
  const mainPhone = contact.phones[0].display;

  return (
    <div
      lang={locale}
      dir={ar ? "rtl" : "ltr"}
      style={ar ? arabicFonts : undefined}
      className="mx-auto min-h-svh max-w-[210mm] bg-white font-sans text-[10.5pt] leading-relaxed text-charcoal print:max-w-none"
    >
      <style>{`@page { size: A4; margin: 16mm 14mm; } @media print { body { background: white; } }`}</style>
      <div className="relative p-8 print:p-0">
        {!revision.lockedAt && (
          <p className="mb-6 border border-dashed border-walnut px-3 py-2 text-center text-sm text-walnut">
            {t(c.draft)}
          </p>
        )}

        <header className="flex items-start justify-between gap-8 border-b border-charcoal pb-6">
          <div>
            <Wordmark />
            <p className="mt-3 text-[9pt] text-ink-muted">
              {company.legalName}
              <br />
              {(ar ? locations.headOfficeAr : locations.headOfficeEn).join(ar ? "، " : ", ")}
              <br />
              <span dir="ltr">{contact.phones.map((p) => p.display).join(" · ")}</span> ·{" "}
              <span dir="ltr">{contact.email}</span>
              {revision.vatNumber && (
                <>
                  <br />
                  {t(c.vatNumber)}: <span dir="ltr">{revision.vatNumber}</span>
                </>
              )}
            </p>
          </div>
          <div className="text-end">
            <h1 className="font-display text-[26pt] leading-none">{t(c.title)}</h1>
            <dl className="mt-4 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-1 text-[9.5pt]">
              <dt className="text-ink-muted">{t(c.number)}</dt>
              <dd dir="ltr" className="text-end font-medium">
                {quotation.number}
              </dd>
              <dt className="text-ink-muted">{t(c.revision)}</dt>
              <dd className="text-end">{revision.revision}</dd>
              <dt className="text-ink-muted">{t(c.date)}</dt>
              <dd className="text-end">{date(issued)}</dd>
              {revision.validUntil && (
                <>
                  <dt className="text-ink-muted">{t(c.validUntil)}</dt>
                  <dd className="text-end">{date(revision.validUntil)}</dd>
                </>
              )}
            </dl>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-8 py-6">
          <div>
            <h2 className="text-[9pt] tracking-wide text-walnut uppercase">{t(c.customer)}</h2>
            <p className="mt-1 font-medium">{quotation.customer.name}</p>
            {quotation.customer.company && <p>{quotation.customer.company}</p>}
            {quotation.customer.phone && (
              <p>
                <span dir="ltr">{quotation.customer.phone}</span>
              </p>
            )}
            {quotation.customer.email && (
              <p>
                <span dir="ltr">{quotation.customer.email}</span>
              </p>
            )}
          </div>
          <div>
            <h2 className="text-[9pt] tracking-wide text-walnut uppercase">{t(c.project)}</h2>
            <p className="mt-1">{quotation.title}</p>
          </div>
        </section>

        <table className="w-full border-collapse text-[9.5pt]">
          <thead>
            <tr className="border-y border-charcoal text-start">
              <th className="py-2 pe-2 text-start font-medium">{t(c.columns.item!)}</th>
              <th className="py-2 pe-2 text-start font-medium">{t(c.columns.description!)}</th>
              <th className="py-2 pe-2 text-end font-medium">{t(c.columns.quantity!)}</th>
              <th className="py-2 pe-2 text-end font-medium">{t(c.columns.unitPrice!)}</th>
              <th className="py-2 text-end font-medium">{t(c.columns.total!)}</th>
            </tr>
          </thead>
          <tbody>
            {revision.lines.map((line, i) => {
              const size = formatDimensions(line, locale);
              return (
                <tr key={line.id} className="break-inside-avoid border-b border-line align-top">
                  <td className="py-2 pe-2 tabular-nums">{i + 1}</td>
                  <td className="py-2 pe-2">
                    <span className="whitespace-pre-line">{line.description}</span>
                    {line.material && (
                      <span className="block text-[8.5pt] text-ink-muted">
                        {t(c.material)}:{" "}
                        {(ar ? line.material.nameAr : line.material.nameEn) ?? line.material.nameEn}{" "}
                        <span dir="ltr">({line.material.code})</span>
                      </span>
                    )}
                    {size && (
                      <span className="block text-[8.5pt] text-ink-muted">
                        {t(c.dimensions)}: {size}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pe-2 text-end whitespace-nowrap tabular-nums">
                    {quantityToText(line.quantityMilli)} {t(c.units[line.unit]!)}
                  </td>
                  <td className="py-2 pe-2 text-end whitespace-nowrap tabular-nums">
                    {money(line.unitPriceFils)}
                  </td>
                  <td className="py-2 text-end whitespace-nowrap tabular-nums">
                    {money(line.lineTotalFils)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="grid w-[75mm] grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-[10pt] tabular-nums">
            <dt>{t(c.subtotal)}</dt>
            <dd className="text-end">{money(revision.subtotalFils)}</dd>
            {revision.discountFils > 0n && (
              <>
                <dt>{t(c.discount)}</dt>
                <dd className="text-end">− {money(revision.discountFils)}</dd>
              </>
            )}
            {revision.vatRateBasisPoints > 0 && (
              <>
                <dt>
                  {t(c.vat)} ({formatRate(revision.vatRateBasisPoints)})
                </dt>
                <dd className="text-end">{money(revision.vatFils)}</dd>
              </>
            )}
            <div className="col-span-2 mt-1 grid grid-cols-subgrid border-t border-charcoal pt-1">
              <dt className="font-medium">{t(c.total)}</dt>
              <dd className="text-end font-display text-[14pt]">{money(revision.totalFils)}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-2 text-end text-[8.5pt] text-ink-muted">{t(c.currencyNote)}</p>

        {revision.notes && (
          <section className="mt-8 break-inside-avoid">
            <h2 className="text-[9pt] tracking-wide text-walnut uppercase">{t(c.notes)}</h2>
            <p className="mt-1 whitespace-pre-line">{revision.notes}</p>
          </section>
        )}
        {revision.terms && (
          <section className="mt-6 break-inside-avoid">
            <h2 className="text-[9pt] tracking-wide text-walnut uppercase">{t(c.terms)}</h2>
            <p className="mt-1 text-[9pt] whitespace-pre-line">{revision.terms}</p>
          </section>
        )}

        <p className="mt-10 border-t border-line pt-4 text-[9pt]">
          {t(c.accept).split("{phone}")[0]}
          <span dir="ltr">{mainPhone}</span>
          {t(c.accept).split("{phone}")[1]}
        </p>
      </div>
    </div>
  );
}
