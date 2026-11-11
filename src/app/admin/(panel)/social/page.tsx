import type { Metadata } from "next";
import Link from "next/link";
import { adminInput, Badge, FilterField, PageHeader, Panel, StatCard } from "@/components/admin/ui";
import {
  bahrainDay,
  bahrainTime,
  calendarDays,
  platformNames,
  shiftAnchor,
  socialPlatforms,
  socialStatuses,
  socialStatusNames,
  type SocialPlatformKey,
  type SocialStatusKey,
} from "@/lib/social";
import { CUID } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { calendarPosts, listSocialCampaigns } from "@/server/social/posts";
import { statusTone } from "./shared";

export const metadata: Metadata = { title: "Content calendar" };

const weekdays = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dayName = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function SocialCalendarPage({ searchParams }: PageProps<"/admin/social">) {
  const actor = await requireActor("social.manage");
  const sp = await searchParams;
  const view = pick(sp.view) === "week" ? "week" : "month";
  const today = bahrainDay(new Date());
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(pick(sp.day) ?? "") ? pick(sp.day)! : today;
  const status = socialStatuses.includes(pick(sp.status) as SocialStatusKey)
    ? (pick(sp.status) as SocialStatusKey)
    : undefined;
  const platform = socialPlatforms.includes(pick(sp.platform) as SocialPlatformKey)
    ? (pick(sp.platform) as SocialPlatformKey)
    : undefined;
  const campaignId = CUID.test(pick(sp.campaign) ?? "") ? pick(sp.campaign) : undefined;
  const { days, start, end } = calendarDays(view, anchor);
  const [{ dated, undated, counts }, campaigns] = await Promise.all([
    calendarPosts(db, actor, start, end, { status, platform, campaignId }),
    listSocialCampaigns(db, actor),
  ]);
  const byDay = new Map<string, typeof dated>();
  for (const p of dated) {
    const day = bahrainDay(p.plannedAt ?? p.publishedAt!);
    byDay.set(day, [...(byDay.get(day) ?? []), p]);
  }
  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams({
      view,
      day: anchor,
      ...(status ? { status } : {}),
      ...(platform ? { platform } : {}),
      ...(campaignId ? { campaign: campaignId } : {}),
      ...extra,
    });
    return `/admin/social?${q}`;
  };
  const month = anchor.slice(0, 7);
  const heading =
    view === "month"
      ? monthName.format(new Date(`${month}-01T00:00:00Z`))
      : `${dayName.format(new Date(`${days[0]}T00:00:00Z`))} – ${dayName.format(new Date(`${days[6]}T00:00:00Z`))}`;

  return (
    <>
      <PageHeader
        title="Content calendar"
        description="Every social media post by day: drafts, posts waiting for approval, scheduled and published ones. Nothing is published unless an approver approves it."
        actions={
          <>
            <Link
              href="/admin/social/new"
              className="inline-flex min-h-10 items-center bg-charcoal px-4 text-sm font-medium text-ivory"
            >
              New post
            </Link>
            <Link
              href="/admin/social/plan"
              className="inline-flex min-h-10 items-center border border-charcoal/25 bg-white px-4 text-sm hover:bg-sand"
            >
              Plan with AI
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {socialStatuses.map((s) => (
          <StatCard key={s} label={socialStatusNames[s]} value={counts[s] ?? 0} href={keep({ status: s })} />
        ))}
      </div>

      <form
        method="get"
        className="my-6 grid gap-3 border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <input type="hidden" name="day" value={anchor} />
        <FilterField label="View">
          <select name="view" defaultValue={view} className={adminInput}>
            <option value="month">Month</option>
            <option value="week">Week</option>
          </select>
        </FilterField>
        <FilterField label="Status">
          <select name="status" defaultValue={status ?? ""} className={adminInput}>
            <option value="">Any</option>
            {socialStatuses.map((s) => (
              <option key={s} value={s}>
                {socialStatusNames[s]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Platform">
          <select name="platform" defaultValue={platform ?? ""} className={adminInput}>
            <option value="">Any</option>
            {socialPlatforms.map((p) => (
              <option key={p} value={p}>
                {platformNames[p]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Campaign">
          <select name="campaign" defaultValue={campaignId ?? ""} className={adminInput}>
            <option value="">Any</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FilterField>
        <div className="flex items-end gap-3">
          <button type="submit" className="min-h-10 bg-charcoal px-4 text-sm font-medium text-ivory">
            Show
          </button>
          <Link href="/admin/social" className="min-h-10 px-2 py-2 text-sm underline underline-offset-4">
            Clear
          </Link>
        </div>
      </form>

      <nav aria-label="Calendar period" className="mb-3 flex flex-wrap items-center gap-3">
        <Link
          href={keep({ day: shiftAnchor(view, anchor, -1) })}
          className="border border-line bg-white px-3 py-2 text-sm hover:bg-sand"
        >
          ← Previous
        </Link>
        <Link
          href={keep({ day: today })}
          className="border border-line bg-white px-3 py-2 text-sm hover:bg-sand"
        >
          Today
        </Link>
        <Link
          href={keep({ day: shiftAnchor(view, anchor, 1) })}
          className="border border-line bg-white px-3 py-2 text-sm hover:bg-sand"
        >
          Next →
        </Link>
        <h2 className="font-display text-2xl">{heading}</h2>
      </nav>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
          <caption className="sr-only">Posts by day, {heading}</caption>
          <thead>
            <tr>
              {weekdays.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className="border border-line bg-sand/50 px-2 py-1 text-start font-medium"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: days.length / 7 }, (_, w) => (
              <tr key={w}>
                {days.slice(w * 7, w * 7 + 7).map((day) => {
                  const outside = view === "month" && !day.startsWith(month);
                  const posts = byDay.get(day) ?? [];
                  return (
                    <td
                      key={day}
                      className={`h-28 border border-line p-1.5 align-top ${outside ? "bg-sand/30 text-ink-muted" : "bg-white"} ${day === today ? "outline-2 -outline-offset-2 outline-walnut" : ""}`}
                    >
                      <p className="mb-1 flex items-center justify-between text-xs">
                        <span className={day === today ? "font-semibold" : ""}>
                          {dayName.format(new Date(`${day}T00:00:00Z`))}
                        </span>
                        <Link
                          href={`/admin/social/new?day=${day}`}
                          className="hover:text-ink px-1 text-ink-muted"
                          aria-label={`New post on ${day}`}
                        >
                          +
                        </Link>
                      </p>
                      <ul className="space-y-1">
                        {posts.map((p) => (
                          <li key={p.id}>
                            <Link
                              href={`/admin/social/${p.id}`}
                              className="block border border-line bg-ivory px-1.5 py-1 text-xs hover:border-walnut"
                            >
                              <span className="text-ink-muted tabular-nums">
                                {bahrainTime(p.plannedAt ?? p.publishedAt!)}
                              </span>{" "}
                              <span className="font-medium">{p.title}</span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-1">
                                <Badge tone={statusTone[p.status]}>{socialStatusNames[p.status]}</Badge>
                                <span className="text-[0.7rem] text-ink-muted">
                                  {p.platforms.map((x) => platformNames[x]).join(" · ")}
                                </span>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {undated.length > 0 && (
        <Panel title={`Drafts without a day (${undated.length})`} className="mt-6">
          <ul className="space-y-2 text-sm">
            {undated.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/social/${p.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {p.title}
                </Link>
                <Badge tone={statusTone[p.status]}>{socialStatusNames[p.status]}</Badge>
                <span className="text-xs text-ink-muted">
                  {p.platforms.map((x) => platformNames[x]).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
