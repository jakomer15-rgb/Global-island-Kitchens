import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import {
  adminInput,
  Badge,
  Empty,
  FilterBar,
  FilterField,
  fmtDateTime,
  label,
  leadStatusTone,
  PageHeader,
  Pagination,
  Panel,
  StatCard,
  Table,
  Td,
  TemperatureBadge,
  Th,
} from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { chatStats, listChats } from "@/server/chat/admin";
import { leadSources, leadStatuses } from "@/server/crm/leads";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "AI sales" };

const filtersSchema = z.object({
  days: z.coerce
    .number()
    .refine((d) => [7, 30, 90, 365].includes(d))
    .optional()
    .catch(undefined),
  temperature: z.enum(["hot", "warm", "cold"]).optional().catch(undefined),
  contact: z.enum(["yes", "no"]).optional().catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

/** The Bahraini dinar is pegged at 0.376 per US dollar. */
const BHD_PER_USD = 0.376;
const languageName: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  hi: "Hindi",
  ur: "Urdu",
  other: "Other",
};
const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

export default async function AiSalesPage({ searchParams }: PageProps<"/admin/ai-sales">) {
  const actor = await requireActor("lead.read");
  const raw = await searchParams;
  const filters = filtersSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const days = filters.days ?? 30;
  const [stats, chats] = await Promise.all([chatStats(db, actor, days), listChats(db, actor, filters)]);
  const canExport = can(actor, "customer.read");
  const leadsLink = (extra: Record<string, string>) =>
    `/admin/leads?${new URLSearchParams({ source: "website_chat", ...extra }).toString()}`;

  return (
    <>
      <PageHeader
        title="AI sales"
        description="What GIK Smart Assistant, the website's sales chat, is bringing in: conversations, the leads they became, and their HOT / WARM / COLD rating."
        actions={
          <form method="get" className="flex items-end gap-2">
            <label className="text-sm">
              <span className="mb-1 block text-ink-muted">Period</span>
              <select name="days" defaultValue={String(days)} className={adminInput}>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last 12 months</option>
              </select>
            </label>
            <button type="submit" className="min-h-10 bg-charcoal px-4 text-sm font-medium text-ivory">
              Show
            </button>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Conversations"
          value={stats.chats}
          hint={`${stats.visitorMessages} visitor messages`}
        />
        <StatCard
          label="Left their details"
          value={stats.withContact}
          hint={`${pct(stats.contactRate)} of conversations`}
          href="?contact=yes"
        />
        <StatCard
          label="New leads from the chat"
          value={stats.leads}
          hint={stats.assisted ? `+ ${stats.assisted} existing lead(s) chatted again` : undefined}
          href={leadsLink({})}
        />
        <StatCard
          label="Won"
          value={stats.won}
          hint={`Conversion ${pct(stats.conversion)} of decided chat leads`}
          href={leadsLink({ status: "won" })}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Leads by rating">
          <ul className="space-y-3 text-sm">
            {(["hot", "warm", "cold"] as const).map((t) => (
              <li key={t} className="flex items-center justify-between gap-3">
                <Link
                  href={leadsLink({ temperature: t })}
                  className="flex items-center gap-2 hover:underline"
                >
                  <TemperatureBadge value={t} />
                  <span className="text-ink-muted">
                    {t === "hot"
                      ? "Clear project, budget, buying soon"
                      : t === "warm"
                        ? "Interested, comparing"
                        : "Browsing"}
                  </span>
                </Link>
                <span className="font-display text-2xl tabular-nums">{stats.leadsByTemperature[t] ?? 0}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-muted">
            All conversations, including anonymous ones:{" "}
            {(["hot", "warm", "cold"] as const)
              .map((t) => `${t.toUpperCase()} ${stats.chatsByTemperature[t] ?? 0}`)
              .join(" · ")}
          </p>
        </Panel>
        <Panel title="Chat leads by status">
          <ul className="space-y-2 text-sm">
            {leadStatuses.map((s) => (
              <li key={s} className="flex items-center justify-between">
                <Link href={leadsLink({ status: s })} className="hover:underline">
                  <Badge tone={leadStatusTone[s]}>{label(s)}</Badge>
                </Link>
                <span className="tabular-nums">{stats.byLeadStatus[s] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="AI cost (estimate)">
          <p className="font-display text-4xl tabular-nums">
            {(stats.costUsd * BHD_PER_USD).toFixed(3)} <span className="text-base">BHD</span>
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            ≈ US$ {stats.costUsd.toFixed(2)} for chats started in this period, including the background
            reading of each conversation. Anthropic’s invoice is the exact figure.
          </p>
          <p className="mt-3 text-sm">
            <Link href="/admin/ai-agent" className="underline">
              Chat settings and knowledge base
            </Link>
          </p>
        </Panel>
      </div>

      {canExport && (
        <Panel title="Export leads to Excel" className="mt-6">
          <form method="get" action="/admin/ai-sales/export" className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-ink-muted">Source</span>
              <select name="source" defaultValue="website_chat" className={adminInput}>
                <option value="">All sources</option>
                {leadSources.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-ink-muted">Rating</span>
              <select name="temperature" defaultValue="" className={adminInput}>
                <option value="">Any</option>
                <option value="hot">HOT</option>
                <option value="warm">WARM</option>
                <option value="cold">COLD</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-ink-muted">Status</span>
              <select name="status" defaultValue="" className={adminInput}>
                <option value="">Any</option>
                {leadStatuses.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-ink-muted">From</span>
              <input type="date" name="from" className={adminInput} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-ink-muted">To</span>
              <input type="date" name="to" className={adminInput} />
            </label>
            <button type="submit" className="min-h-10 bg-charcoal px-4 text-sm font-medium text-ivory">
              Download CSV
            </button>
          </form>
          <p className="mt-3 text-xs text-ink-muted">
            Opens in Excel or Google Sheets. It contains customers’ phone numbers and emails: keep it within
            the team and delete it when done. Every export is recorded in the audit log.
          </p>
        </Panel>
      )}

      <h2 className="mt-10 mb-4 font-display text-2xl">Conversations</h2>
      <FilterBar>
        <FilterField label="Search">
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Words, reference, name"
            className={adminInput}
          />
        </FilterField>
        <FilterField label="Rating">
          <select name="temperature" defaultValue={filters.temperature ?? ""} className={adminInput}>
            <option value="">Any</option>
            <option value="hot">HOT</option>
            <option value="warm">WARM</option>
            <option value="cold">COLD</option>
          </select>
        </FilterField>
        <FilterField label="Contact details">
          <select name="contact" defaultValue={filters.contact ?? ""} className={adminInput}>
            <option value="">Any</option>
            <option value="yes">Left their details</option>
            <option value="no">Anonymous</option>
          </select>
        </FilterField>
        <input type="hidden" name="days" value={days} />
      </FilterBar>
      {chats.items.length === 0 ? (
        <Empty>No conversations match these filters.</Empty>
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-muted">{chats.total} conversation(s)</p>
          <Table label="Conversations">
            <thead>
              <tr>
                <Th>Last message</Th>
                <Th>Summary</Th>
                <Th>Wants</Th>
                <Th>Rating</Th>
                <Th>Lead</Th>
              </tr>
            </thead>
            <tbody>
              {chats.items.map((c) => {
                const r = (c.requirements ?? {}) as Record<string, string | null>;
                return (
                  <tr key={c.id} className="hover:bg-sand/40">
                    <Td className="whitespace-nowrap">
                      <Link
                        href={`/admin/ai-sales/chats/${c.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {fmtDateTime(c.lastMessageAt)}
                      </Link>
                      <span className="block text-xs text-ink-muted">
                        {c.messageCount} messages
                        {c.language ? ` · ${languageName[c.language] ?? c.language}` : ""}
                        {c._count.files ? ` · ${c._count.files} photo(s)` : ""}
                      </span>
                    </Td>
                    <Td className="max-w-md">
                      <span className="line-clamp-2">
                        {c.summary ?? <span className="text-ink-muted">Not read yet</span>}
                      </span>
                    </Td>
                    <Td className="max-w-xs text-xs">
                      {[r.productCategory, r.location, r.budget, r.timeline].filter(Boolean).join(" · ") ||
                        "—"}
                    </Td>
                    <Td>
                      <TemperatureBadge value={c.temperature} />
                    </Td>
                    <Td>
                      {c.lead ? (
                        <Link href={`/admin/leads/${c.lead.id}`} className="font-mono text-xs underline">
                          {c.lead.reference}
                        </Link>
                      ) : (
                        <span className="text-xs text-ink-muted">Anonymous</span>
                      )}
                      {c.lead && <span className="block text-xs">{c.lead.customer.name}</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination
            page={chats.page}
            pages={chats.pages}
            params={{ ...filters, days: String(days), page: undefined } as Record<string, string | undefined>}
          />
        </>
      )}
    </>
  );
}
