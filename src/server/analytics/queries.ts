import type { Prisma } from "@/generated/prisma/client";
import { median, periodKeys, period as periodOf, type Period, type PeriodKey } from "@/lib/analytics";
import { products } from "@/content/products";
import type { Db } from "@/server/db/client";

/**
 * The analytics agent's figures: a fixed catalogue of read-only database queries. Reports are built from
 * them, and the AI may only choose among them (it never writes SQL or sees anything else). Results carry
 * no customer names or contact details: leads appear by reference, quotations by number.
 */

const live: Prisma.LeadWhereInput = { archivedAt: null };
const range = (p: Period) => ({ gte: p.start, lt: p.end });
const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

const productNames: Record<string, string> = Object.fromEntries(products.map((p) => [p.key, p.name.en]));
export const sourceNames: Record<string, string> = {
  website_quote: "Website quotation form",
  website_consultation: "Website consultation booking",
  website_contact: "Website contact form",
  designer_portal: "Designer portal",
  whatsapp: "WhatsApp",
  phone: "Phone",
  walk_in: "Showroom walk-in",
  referral: "Referral",
  instagram: "Instagram",
  website_chat: "Website chat (AI assistant)",
  prospecting: "Marketing prospects",
  other: "Other",
};
export const stageNames: Record<string, string> = {
  new: "New inquiry",
  contacted: "Contacted",
  qualified: "Qualified",
  site_visit: "Site visit",
  measurement: "Measurement",
  quoted: "Quotation",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const periodInfo = (p: Period) => ({ label: p.label, from: p.from, to: p.to });

/** First contact by staff (call, email, WhatsApp or meeting) after each enquiry of the period, in hours. */
async function responseTimes(db: Db, p: Period, now: Date) {
  const rows = await db.$queryRaw<{ created_at: Date; first_contact: Date | null }[]>`
    SELECT l."created_at", (
      SELECT min(a."created_at") FROM "lead_activities" a
      WHERE a."lead_id" = l."id" AND a."author_id" IS NOT NULL
        AND a."kind" IN ('call', 'email', 'whatsapp', 'meeting')
    ) AS "first_contact"
    FROM "leads" l
    WHERE l."archived_at" IS NULL AND l."created_at" >= ${p.start} AND l."created_at" < ${p.end}`;
  const hours = rows
    .filter((r) => r.first_contact)
    .map((r) => (r.first_contact!.getTime() - r.created_at.getTime()) / 3_600_000);
  const waiting = rows.filter((r) => !r.first_contact);
  return {
    enquiries: rows.length,
    contacted: hours.length,
    medianHours: median(hours),
    averageHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
    within24h: hours.filter((h) => h <= 24).length,
    notYetContacted: waiting.length,
    notContactedOver24h: waiting.filter((r) => now.getTime() - r.created_at.getTime() > 24 * 3_600_000)
      .length,
  };
}

export async function summary(db: Db, p: Period, now = new Date()) {
  const inRange = range(p);
  const [
    inquiries,
    newCustomers,
    byTemperature,
    byStatus,
    overdue,
    dueToday,
    quotationsCreated,
    quotationsSent,
    quotationsApproved,
    quotationsAwaiting,
    orders,
    response,
  ] = await Promise.all([
    db.lead.count({ where: { ...live, createdAt: inRange } }),
    db.customer.count({ where: { createdAt: inRange, mergedIntoId: null } }),
    db.lead.groupBy({ by: ["temperature"], where: { ...live, createdAt: inRange }, _count: { _all: true } }),
    db.lead.groupBy({ by: ["status"], where: { ...live, createdAt: inRange }, _count: { _all: true } }),
    db.followUp.count({ where: { doneAt: null, dueAt: { lt: now }, lead: live } }),
    db.followUp.count({
      where: { doneAt: null, dueAt: { gte: now, lt: periodOf("today", now).end }, lead: live },
    }),
    db.quotation.count({ where: { createdAt: inRange } }),
    db.quotationRevision.count({ where: { sentAt: inRange } }),
    db.quotationRevision.count({ where: { approvedAt: inRange } }),
    db.quotation.count({ where: { status: "sent" } }),
    db.order.aggregate({
      where: { createdAt: inRange, status: { not: "cancelled" } },
      _count: { _all: true },
      _sum: { totalFils: true },
    }),
    responseTimes(db, p, now),
  ]);
  const temp = (t: string | null) => byTemperature.find((r) => r.temperature === t)?._count._all ?? 0;
  const stage = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
  const won = stage("won");
  const lost = stage("lost");
  return {
    query: "summary",
    period: periodInfo(p),
    inquiries,
    newCustomers,
    hotLeads: temp("hot"),
    warmLeads: temp("warm"),
    coldLeads: temp("cold"),
    notRated: temp(null),
    followUpsOverdueNow: overdue,
    followUpsDueRestOfToday: dueToday,
    quotationsCreated,
    quotationsSent,
    quotationsApproved,
    quotationsAwaitingCustomerNow: quotationsAwaiting,
    ordersReceived: orders._count._all,
    ordersValueBhd: n(orders._sum.totalFils) / 1000,
    conversion: {
      note: "Enquiries received in the period: how many are won, lost or still open now.",
      won,
      lost,
      open: inquiries - won - lost,
      winRatePercent: won + lost ? Math.round((won / (won + lost)) * 100) : null,
    },
    responseTime: response,
  };
}

async function groupLeads(db: Db, p: Period, by: "source") {
  const rows = await db.lead.groupBy({
    by: [by],
    where: { ...live, createdAt: range(p) },
    _count: { _all: true },
  });
  return rows.map((r) => ({ key: r[by], count: r._count._all })).sort((a, b) => b.count - a.count);
}

export async function leadsBySource(db: Db, p: Period) {
  const rows = await groupLeads(db, p, "source");
  return {
    query: "leads_by_source",
    period: periodInfo(p),
    total: rows.reduce((s, r) => s + r.count, 0),
    rows: rows.map((r) => ({ source: sourceNames[r.key] ?? r.key, leads: r.count })),
  };
}

export async function leadsByProduct(db: Db, p: Period) {
  const leads = await db.lead.findMany({
    where: { ...live, createdAt: range(p) },
    select: { category: true, requirements: { select: { productCategory: true } } },
  });
  const counts = new Map<string, number>();
  for (const l of leads) {
    const key = l.category
      ? (productNames[l.category] ?? l.category)
      : l.requirements?.productCategory?.trim().slice(0, 60) || "Not stated";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return {
    query: "leads_by_product",
    period: periodInfo(p),
    total: leads.length,
    rows: [...counts]
      .map(([product, count]) => ({ product, leads: count }))
      .sort((a, b) => b.leads - a.leads),
  };
}

export async function pipelineNow(db: Db) {
  const rows = await db.lead.groupBy({
    by: ["status"],
    where: { ...live, status: { notIn: ["won", "lost"] } },
    _count: { _all: true },
  });
  return {
    query: "pipeline_now",
    note: "Open leads by stage right now.",
    rows: Object.keys(stageNames)
      .filter((s) => s !== "won" && s !== "lost")
      .map((s) => ({ stage: stageNames[s], leads: rows.find((r) => r.status === s)?._count._all ?? 0 })),
  };
}

/** Leads whose follow-up is overdue or due today, oldest first (references only). */
export async function followUpsDue(db: Db, now = new Date()) {
  const end = periodOf("today", now).end;
  const rows = await db.followUp.findMany({
    where: { doneAt: null, dueAt: { lt: end }, lead: live },
    orderBy: { dueAt: "asc" },
    take: 25,
    select: {
      dueAt: true,
      lead: { select: { id: true, reference: true, status: true, temperature: true } },
      assignedTo: { select: { name: true } },
    },
  });
  const total = await db.followUp.count({ where: { doneAt: null, dueAt: { lt: end }, lead: live } });
  return {
    query: "follow_ups_due",
    note: "Open follow-ups overdue or due by the end of today, oldest first (at most 25 listed).",
    total,
    rows: rows.map((r) => ({
      lead: r.lead.reference,
      leadId: r.lead.id,
      stage: stageNames[r.lead.status] ?? r.lead.status,
      rating: r.lead.temperature ?? "not rated",
      due: r.dueAt.toISOString(),
      overdue: r.dueAt < now,
      assignedTo: r.assignedTo?.name ?? "nobody",
    })),
  };
}

/** Quotations sent to customers and waiting for their answer. */
export async function quotationsAwaiting(db: Db, now = new Date()) {
  const rows = await db.quotation.findMany({
    where: { status: "sent" },
    take: 25,
    select: {
      id: true,
      number: true,
      revisions: {
        where: { sentAt: { not: null } },
        orderBy: { revision: "desc" },
        take: 1,
        select: { sentAt: true, revision: true },
      },
    },
  });
  const total = await db.quotation.count({ where: { status: "sent" } });
  const list = rows
    .map((q) => {
      const sent = q.revisions[0]?.sentAt ?? null;
      return {
        quotation: q.number,
        quotationId: q.id,
        revision: q.revisions[0]?.revision ?? null,
        sent: sent?.toISOString() ?? null,
        daysWaiting: sent ? Math.floor((now.getTime() - sent.getTime()) / 86_400_000) : null,
      };
    })
    .sort((a, b) => (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0));
  return {
    query: "quotations_awaiting",
    note: "Sent and waiting for the customer's answer (at most 25 listed).",
    total,
    rows: list,
  };
}

export async function newCustomers(db: Db, p: Period) {
  const rows = await db.customer.groupBy({
    by: ["type"],
    where: { createdAt: range(p), mergedIntoId: null },
    _count: { _all: true },
  });
  return {
    query: "new_customers",
    period: periodInfo(p),
    note: "Customers recorded for the first time in the period (people or businesses who contacted us).",
    total: rows.reduce((s, r) => s + r._count._all, 0),
    rows: rows
      .map((r) => ({ type: r.type.replace(/_/g, " "), customers: r._count._all }))
      .sort((a, b) => b.customers - a.customers),
  };
}

/** Email campaigns to prospects and social media campaigns, with their results in the period. */
export async function campaignResults(db: Db, p: Period) {
  const inRange = range(p);
  const campaigns = await db.campaign.findMany({
    where: { OR: [{ createdAt: inRange }, { messages: { some: { sentAt: inRange } } }] },
    select: { id: true, name: true, status: true },
    take: 30,
  });
  const email = await Promise.all(
    campaigns.map(async (c) => {
      const [sent, interested, converted, unsubscribed] = await Promise.all([
        db.campaignMessage.count({ where: { campaignId: c.id, sentAt: inRange } }),
        db.prospect.count({
          where: { status: "interested", messages: { some: { campaignId: c.id, status: "sent" } } },
        }),
        db.prospect.count({
          where: { status: "converted", messages: { some: { campaignId: c.id, status: "sent" } } },
        }),
        db.prospect.count({
          where: { unsubscribedAt: { not: null }, messages: { some: { campaignId: c.id, status: "sent" } } },
        }),
      ]);
      return {
        campaign: c.name,
        status: c.status,
        emailsSentInPeriod: sent,
        nowInterested: interested,
        nowConverted: converted,
        unsubscribed,
      };
    }),
  );
  const social = await db.socialCampaign.findMany({
    where: { posts: { some: { targets: { some: { publishedAt: inRange } } } } },
    select: {
      name: true,
      posts: {
        select: {
          targets: {
            where: { status: "published", publishedAt: inRange },
            select: { likes: true, comments: true, shares: true },
          },
        },
      },
    },
    take: 30,
  });
  return {
    query: "campaign_results",
    period: periodInfo(p),
    emailCampaigns: email.sort(
      (a, b) => b.nowConverted - a.nowConverted || b.nowInterested - a.nowInterested,
    ),
    socialCampaigns: social.map((c) => {
      const t = c.posts.flatMap((x) => x.targets);
      return {
        campaign: c.name,
        publications: t.length,
        likes: t.reduce((s, x) => s + (x.likes ?? 0), 0),
        comments: t.reduce((s, x) => s + (x.comments ?? 0), 0),
        shares: t.reduce((s, x) => s + (x.shares ?? 0), 0),
      };
    }),
  };
}

export async function socialPerformance(db: Db, p: Period) {
  const targets = await db.socialPostTarget.findMany({
    where: { status: "published", publishedAt: range(p) },
    select: {
      platform: true,
      likes: true,
      comments: true,
      shares: true,
      metricsAt: true,
      post: { select: { title: true } },
    },
  });
  const platforms = ["instagram", "facebook", "linkedin", "tiktok"] as const;
  return {
    query: "social_performance",
    period: periodInfo(p),
    note: "Likes, comments and shares come from Meta (Facebook, Instagram) only; posts made by hand have no figures.",
    rows: platforms.map((platform) => {
      const t = targets.filter((x) => x.platform === platform);
      const m = t.filter((x) => x.metricsAt);
      return {
        platform,
        published: t.length,
        withFigures: m.length,
        likes: m.reduce((s, x) => s + (x.likes ?? 0), 0),
        comments: m.reduce((s, x) => s + (x.comments ?? 0), 0),
        shares: m.reduce((s, x) => s + (x.shares ?? 0), 0),
      };
    }),
    topPosts: targets
      .filter((x) => x.metricsAt)
      .map((x) => ({
        post: x.post.title,
        platform: x.platform,
        engagement: (x.likes ?? 0) + (x.comments ?? 0) + (x.shares ?? 0),
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 5),
  };
}

// ─── The catalogue the AI chooses from ────────────────────────────────────────

export const queryCatalogue = {
  summary: {
    period: true,
    about:
      "Main figures for a period: enquiries (total inquiries), new customers, hot/warm/cold leads among them, follow-ups overdue now, quotations created/sent/approved, quotations awaiting the customer now, orders and their value, conversion (won/lost/open of the period's enquiries), customer response times (first staff contact).",
  },
  leads_by_source: {
    period: true,
    about:
      "Leads received in a period by source or marketing channel (website forms, chat, WhatsApp, Instagram, referral, prospects…).",
  },
  leads_by_product: { period: true, about: "Leads received in a period by the product they asked about." },
  new_customers: {
    period: true,
    about: "New customers in a period, by type (homeowner, designer, developer…).",
  },
  campaign_results: {
    period: true,
    about:
      "Email campaigns to prospects and social media campaigns: emails sent, prospects interested or converted, social publications and engagement.",
  },
  social_performance: {
    period: true,
    about:
      "Social media posts published in a period by platform, with likes, comments and shares, and the top posts.",
  },
  pipeline_now: { period: false, about: "Open leads by pipeline stage right now." },
  follow_ups_due: {
    period: false,
    about: "Which leads need follow-up: open follow-ups overdue or due today, by lead reference.",
  },
  quotations_awaiting: {
    period: false,
    about: "Quotations sent and awaiting the customer's answer, with days waiting.",
  },
} as const;
export type QueryName = keyof typeof queryCatalogue;
export const queryNames = Object.keys(queryCatalogue) as QueryName[];

export async function runQuery(db: Db, name: QueryName, key: PeriodKey | undefined, now = new Date()) {
  const p = periodOf(key && periodKeys.includes(key) ? key : "this_week", now);
  switch (name) {
    case "summary":
      return summary(db, p, now);
    case "leads_by_source":
      return leadsBySource(db, p);
    case "leads_by_product":
      return leadsByProduct(db, p);
    case "new_customers":
      return newCustomers(db, p);
    case "campaign_results":
      return campaignResults(db, p);
    case "social_performance":
      return socialPerformance(db, p);
    case "pipeline_now":
      return pipelineNow(db);
    case "follow_ups_due":
      return followUpsDue(db, now);
    case "quotations_awaiting":
      return quotationsAwaiting(db, now);
  }
}
