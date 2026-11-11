import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { Empty, fmtDateTime, PageHeader, Panel, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { platformNames } from "@/lib/social";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { metaReady } from "@/server/social/meta";
import { socialPerformance } from "@/server/social/posts";
import { refreshEngagementAction } from "../actions";

export const metadata: Metadata = { title: "Social media performance" };

const periods = [7, 30, 90] as const;
const show = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-GB"));

export default async function PerformancePage({ searchParams }: PageProps<"/admin/social/performance">) {
  const actor = await requireActor("social.manage");
  const { days: d } = await searchParams;
  const days = periods.find((p) => String(p) === d) ?? 30;
  const perf = await socialPerformance(db, actor, days);
  const connected = metaReady(env());

  return (
    <>
      <PageHeader
        title="Performance"
        description="Posts published and the likes, comments and shares Meta reports for them. Figures are read from Facebook and Instagram once a day (and when you refresh); posts made by hand on other platforms are counted but have no figures."
        actions={
          connected ? (
            <ActionForm
              action={refreshEngagementAction}
              submitLabel="Refresh figures"
              pendingLabel="Reading…"
              variant="outline"
              inline
            />
          ) : undefined
        }
      />
      <nav aria-label="Period" className="mb-6 flex gap-2 text-sm">
        {periods.map((p) => (
          <Link
            key={p}
            href={`/admin/social/performance?days=${p}`}
            aria-current={p === days ? "page" : undefined}
            className={`border px-3 py-2 ${p === days ? "border-charcoal bg-charcoal text-ivory" : "border-line bg-white hover:bg-sand"}`}
          >
            Last {p} days
          </Link>
        ))}
      </nav>
      {!connected && (
        <p className="mb-6 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Meta (Facebook and Instagram) isn&apos;t connected yet, so there are no engagement figures. See
          Automation Centre → Integrations.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {perf.perPlatform.map((p) => (
          <StatCard
            key={p.platform}
            label={platformNames[p.platform]}
            value={p.published}
            hint={
              p.measured
                ? `published · ${show(p.likes)} likes · ${show(p.comments)} comments${p.platform === "facebook" ? ` · ${show(p.shares)} shares` : ""}`
                : "published · no figures"
            }
          />
        ))}
      </div>
      <Panel title={`Top posts (${days} days)`} className="mt-6">
        {perf.top.length === 0 ? (
          <Empty>No figures for this period yet.</Empty>
        ) : (
          <Table label="Top posts">
            <thead>
              <tr>
                <Th>Post</Th>
                <Th>Platform</Th>
                <Th>Likes</Th>
                <Th>Comments</Th>
                <Th>Shares</Th>
                <Th>Published</Th>
              </tr>
            </thead>
            <tbody>
              {perf.top.map((t) => (
                <tr key={t.id}>
                  <Td>
                    <Link
                      href={`/admin/social/${t.post.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {t.post.title}
                    </Link>
                  </Td>
                  <Td>{platformNames[t.platform]}</Td>
                  <Td className="tabular-nums">{show(t.likes)}</Td>
                  <Td className="tabular-nums">{show(t.comments)}</Td>
                  <Td className="tabular-nums">{show(t.shares)}</Td>
                  <Td className="whitespace-nowrap">{t.publishedAt ? fmtDateTime(t.publishedAt) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="mt-3 text-xs text-ink-muted">
          {perf.publishedPosts} post(s) published in this period.
          {perf.lastMeasured ? ` Figures last read ${fmtDateTime(perf.lastMeasured)}.` : ""}
        </p>
      </Panel>
    </>
  );
}
