import type { Metadata } from "next";
import Link from "next/link";
import {
  adminInput,
  Badge,
  Empty,
  FilterField,
  fmtDateTime,
  PageHeader,
  Pagination,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import {
  platformNames,
  postTypeNames,
  socialPlatforms,
  socialStatuses,
  socialStatusNames,
  type SocialPlatformKey,
  type SocialStatusKey,
} from "@/lib/social";
import { CUID } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { listPosts, listSocialCampaigns, type PostFilters } from "@/server/social/posts";
import { statusTone } from "../shared";

export const metadata: Metadata = { title: "All posts" };

const pick = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function SocialPostsPage({ searchParams }: PageProps<"/admin/social/posts">) {
  const actor = await requireActor("social.manage");
  const sp = await searchParams;
  const filters: PostFilters = {
    q: pick(sp.q)?.slice(0, 100),
    status: socialStatuses.includes(pick(sp.status) as SocialStatusKey)
      ? (pick(sp.status) as SocialStatusKey)
      : undefined,
    platform: socialPlatforms.includes(pick(sp.platform) as SocialPlatformKey)
      ? (pick(sp.platform) as SocialPlatformKey)
      : undefined,
    campaignId: CUID.test(pick(sp.campaign) ?? "") ? pick(sp.campaign) : undefined,
    sort: (["planned", "newest", "published"] as const).find((s) => s === pick(sp.sort)) ?? "planned",
    page: Number(pick(sp.page) ?? 1) || 1,
  };
  const [result, campaigns] = await Promise.all([
    listPosts(db, actor, filters),
    listSocialCampaigns(db, actor),
  ]);
  const params = {
    q: filters.q,
    status: filters.status,
    platform: filters.platform,
    campaign: filters.campaignId,
    sort: filters.sort,
  };

  return (
    <>
      <PageHeader
        title="All posts"
        description="Search and review every social media post. Open a post to edit it, send it for approval, approve, schedule or publish it."
        actions={
          <Link
            href="/admin/social/new"
            className="inline-flex min-h-10 items-center bg-charcoal px-4 text-sm font-medium text-ivory"
          >
            New post
          </Link>
        }
      />
      <form
        method="get"
        className="my-6 grid gap-3 border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <FilterField label="Search">
          <input name="q" defaultValue={filters.q} placeholder="Title or caption" className={adminInput} />
        </FilterField>
        <FilterField label="Status">
          <select name="status" defaultValue={filters.status ?? ""} className={adminInput}>
            <option value="">Any</option>
            {socialStatuses.map((s) => (
              <option key={s} value={s}>
                {socialStatusNames[s]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Platform">
          <select name="platform" defaultValue={filters.platform ?? ""} className={adminInput}>
            <option value="">Any</option>
            {socialPlatforms.map((p) => (
              <option key={p} value={p}>
                {platformNames[p]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Campaign">
          <select name="campaign" defaultValue={filters.campaignId ?? ""} className={adminInput}>
            <option value="">Any</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Sort by">
          <select name="sort" defaultValue={filters.sort} className={adminInput}>
            <option value="planned">Planned day</option>
            <option value="newest">Newest first</option>
            <option value="published">Recently published</option>
          </select>
        </FilterField>
        <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-5">
          <button type="submit" className="min-h-10 bg-charcoal px-4 text-sm font-medium text-ivory">
            Filter
          </button>
          <Link
            href="/admin/social/posts"
            className="min-h-10 px-2 py-2 text-sm underline underline-offset-4"
          >
            Clear
          </Link>
        </div>
      </form>

      {result.items.length === 0 ? (
        <Empty>No posts match. Write one, or let the AI plan a week or month.</Empty>
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-muted">{result.total} post(s)</p>
          <Table label="Social media posts">
            <thead>
              <tr>
                <Th>Post</Th>
                <Th>Platforms</Th>
                <Th>Planned</Th>
                <Th>Status</Th>
                <Th>Published</Th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((p) => (
                <tr key={p.id} className="hover:bg-sand/40">
                  <Td>
                    <Link
                      href={`/admin/social/${p.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {p.title}
                    </Link>
                    <span className="block text-xs text-ink-muted">
                      {postTypeNames[p.type]}
                      {p.campaign ? ` · ${p.campaign.name}` : ""}
                      {p.createdBy ? ` · ${p.createdBy.name}` : ""}
                    </span>
                  </Td>
                  <Td>{p.platforms.map((x) => platformNames[x]).join(", ")}</Td>
                  <Td className="whitespace-nowrap">
                    {p.plannedAt ? fmtDateTime(p.plannedAt) : <span className="text-ink-muted">No day</span>}
                  </Td>
                  <Td>
                    <Badge tone={statusTone[p.status]}>{socialStatusNames[p.status]}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {p.publishedAt ? fmtDateTime(p.publishedAt) : <span className="text-ink-muted">—</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={result.page} pages={result.pages} params={params} />
        </>
      )}
    </>
  );
}
