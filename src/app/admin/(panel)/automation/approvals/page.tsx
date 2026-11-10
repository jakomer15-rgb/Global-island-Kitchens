import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Empty, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { centreText, fmtCentreDateTime, tr, trOr } from "@/content/automation-centre";
import { requireActor } from "@/server/auth/session";
import { approvalQueue } from "@/server/automation/overview";
import { db } from "@/server/db";
import { getCentreLang } from "../lang";

export const metadata: Metadata = { title: "Approvals · Automation Centre" };

export default async function ApprovalsPage() {
  const actor = await requireActor("automation.read");
  const lang = await getCentreLang();
  const queue = await approvalQueue(db, actor);
  const T = centreText.approvals;

  return (
    <>
      <PageHeader
        title={tr(centreText.nav.approvals, lang)}
        description={tr(T.description, lang)}
        actions={
          <ul className="flex flex-wrap gap-2 text-sm">
            {(["ai_draft", "designer"] as const).map((k) =>
              queue.counts[k] === null ? null : (
                <li key={k}>
                  <Badge tone={queue.counts[k] ? "warn" : "neutral"}>
                    {tr(T.kinds[k], lang)} · {queue.counts[k]}
                  </Badge>
                </li>
              ),
            )}
          </ul>
        }
      />
      {queue.items.length === 0 ? (
        <Empty>{tr(T.empty, lang)}</Empty>
      ) : (
        <Table label={tr(centreText.nav.approvals, lang)}>
          <thead>
            <tr>
              <Th className="text-start">{tr(T.kind, lang)}</Th>
              <Th className="text-start">{tr(T.item, lang)}</Th>
              <Th className="text-start">{tr(T.waiting, lang)}</Th>
              <Th>
                <span className="sr-only">{tr(T.review, lang)}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {queue.items.map((item) => (
              <tr key={`${item.kind}-${item.id}`} className="hover:bg-sand/40">
                <Td className="text-start">
                  <Badge tone="warn">{tr(T.kinds[item.kind], lang)}</Badge>
                </Td>
                <Td className="text-start">
                  <span className="font-medium">
                    {item.kind === "ai_draft" ? trOr(T.draftKinds, item.title, lang) : item.title}
                  </span>
                  {item.detail && (
                    <span className="block text-xs text-ink-muted" dir="auto">
                      {item.detail}
                    </span>
                  )}
                </Td>
                <Td className="text-start whitespace-nowrap">{fmtCentreDateTime(item.createdAt, lang)}</Td>
                <Td className="text-end">
                  <Link href={item.href} className="underline underline-offset-4">
                    {tr(T.review, lang)}
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="mt-4 text-sm text-ink-muted">{tr(T.later, lang)}</p>
    </>
  );
}
