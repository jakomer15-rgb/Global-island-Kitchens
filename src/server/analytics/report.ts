import {
  change,
  hoursText,
  reportKindNames,
  reportPeriod,
  type Period,
  type ReportKind,
} from "@/lib/analytics";
import { parseSetting } from "@/lib/site-settings";
import { assertCan, type Actor } from "@/server/auth/staff";
import type { Db } from "@/server/db/client";
import { env as readEnv, type Env } from "@/server/env";
import { sendEmail, type ChannelResult } from "@/server/outbox/deliver";
import { enqueue } from "@/server/outbox/events";
import {
  campaignResults,
  followUpsDue,
  leadsByProduct,
  leadsBySource,
  newCustomers,
  pipelineNow,
  quotationsAwaiting,
  socialPerformance,
  summary,
} from "./queries";

/**
 * Daily, weekly and monthly business reports (Stage 7), counted from the database when they are opened or
 * sent, with the previous period for comparison. Every figure in the brief: enquiries, new, hot/warm/cold
 * leads, follow-ups pending, quotations generated and approved, orders, conversion, lead sources,
 * products asked about, social media and campaign performance, and response times.
 */

/** `anchor` picks the period (a moment inside it); figures marked "now" are counted at `now`. */
export async function buildReport(db: Db, kind: ReportKind, now = new Date(), offset = 0, anchor = now) {
  const p = reportPeriod(kind, anchor, offset);
  const prev = reportPeriod(kind, anchor, offset + 1);
  const [
    current,
    previous,
    sources,
    productsAsked,
    customers,
    campaigns,
    social,
    pipeline,
    followUps,
    quotations,
  ] = await Promise.all([
    summary(db, p, now),
    summary(db, prev, now),
    leadsBySource(db, p),
    leadsByProduct(db, p),
    newCustomers(db, p),
    campaignResults(db, p),
    socialPerformance(db, p),
    pipelineNow(db),
    followUpsDue(db, now),
    quotationsAwaiting(db, now),
  ]);
  return {
    kind,
    period: p,
    previousPeriod: prev,
    current,
    previous,
    sources,
    productsAsked,
    customers,
    campaigns,
    social,
    pipeline,
    followUps,
    quotations,
  };
}
export type BusinessReport = Awaited<ReturnType<typeof buildReport>>;

export async function businessReport(db: Db, actor: Actor, kind: ReportKind, offset = 0, now = new Date()) {
  assertCan(actor, "analytics.read");
  return buildReport(db, kind, now, Math.max(0, Math.min(24, offset)));
}

const line = (label: string, a: number, b: number) => `${label}: ${a} (${change(a, b) || "—"} vs previous)`;

/** The report as a plain-text email (figures only, lead references, no customer details). */
export function reportEmail(r: BusinessReport, siteUrl: string) {
  const c = r.current;
  const b = r.previous;
  const title = `${reportKindNames[r.kind]} business report: ${r.period.from}${r.period.to !== r.period.from ? ` to ${r.period.to}` : ""}`;
  const text = [
    title,
    `Global Island Kitchens — counted from the database. Previous period: ${r.previousPeriod.from} to ${r.previousPeriod.to}.`,
    "",
    "ENQUIRIES",
    line("Total enquiries", c.inquiries, b.inquiries),
    line("New customers", c.newCustomers, b.newCustomers),
    `Hot / warm / cold: ${c.hotLeads} / ${c.warmLeads} / ${c.coldLeads} (${c.notRated} not rated)`,
    `Response time (first staff contact): median ${hoursText(c.responseTime.medianHours)}, ${c.responseTime.within24h} of ${c.responseTime.contacted} within 24 h; ${c.responseTime.notYetContacted} not contacted yet`,
    "",
    "SALES",
    line("Quotations created", c.quotationsCreated, b.quotationsCreated),
    line("Quotations approved", c.quotationsApproved, b.quotationsApproved),
    line("Orders received", c.ordersReceived, b.ordersReceived),
    `Order value: BHD ${c.ordersValueBhd.toFixed(3)}`,
    `Of this period's enquiries: ${c.conversion.won} won, ${c.conversion.lost} lost, ${c.conversion.open} open`,
    `Quotations awaiting the customer now: ${c.quotationsAwaitingCustomerNow}`,
    `Follow-ups overdue now: ${c.followUpsOverdueNow}`,
    "",
    "LEAD SOURCES",
    ...(r.sources.rows.length ? r.sources.rows.map((x) => `- ${x.source}: ${x.leads}`) : ["- none"]),
    "",
    "PRODUCTS ASKED ABOUT",
    ...(r.productsAsked.rows.length
      ? r.productsAsked.rows.slice(0, 8).map((x) => `- ${x.product}: ${x.leads}`)
      : ["- none"]),
    "",
    "SOCIAL MEDIA",
    ...r.social.rows
      .filter((x) => x.published)
      .map(
        (x) =>
          `- ${x.platform}: ${x.published} published, ${x.likes} likes, ${x.comments} comments, ${x.shares} shares`,
      ),
    ...(r.social.rows.some((x) => x.published) ? [] : ["- nothing published"]),
    "",
    "CAMPAIGNS",
    ...r.campaigns.emailCampaigns.map(
      (x) =>
        `- ${x.campaign}: ${x.emailsSentInPeriod} emails sent, ${x.nowInterested} interested, ${x.nowConverted} converted`,
    ),
    ...r.campaigns.socialCampaigns.map(
      (x) =>
        `- ${x.campaign} (social): ${x.publications} publications, ${x.likes + x.comments + x.shares} interactions`,
    ),
    ...(r.campaigns.emailCampaigns.length + r.campaigns.socialCampaigns.length ? [] : ["- none"]),
    "",
    `Open the full report: ${siteUrl}/admin/analytics?report=${r.kind}`,
  ].join("\n");
  return { subject: title, text };
}

/** Records a report for one period once and queues its email; false when it was already queued. */
async function queueOnce(db: Db, kind: ReportKind | "campaigns", p: Period) {
  return db.$transaction(async (tx) => {
    const inserted = await tx.$executeRaw`
      INSERT INTO "analytics_report_runs" ("id", "kind", "period_start")
      VALUES (${`arr_${kind}_${p.from}`}, ${kind}, ${p.start})
      ON CONFLICT ("kind", "period_start") DO NOTHING`;
    if (inserted) await enqueue(tx, "analytics.report", { kind, periodStart: p.start.toISOString() });
    return inserted > 0;
  });
}

/** The last completed period of each report kind switched on, queued once each (scheduled job). */
export async function queueDueReports(db: Db, now = new Date()) {
  const row = await db.siteSetting.findUnique({ where: { key: "analyticsReports" } });
  const s = parseSetting("analyticsReports", row?.value);
  let queued = 0;
  for (const kind of ["daily", "weekly", "monthly"] as const) {
    if (s[kind] && (await queueOnce(db, kind, reportPeriod(kind, now, 1)))) queued++;
  }
  return { queued };
}

/** Workflow "Weekly campaign → performance report": last week's campaign results, queued once a week. */
export async function queueCampaignReport(db: Db, now = new Date()) {
  return { queued: (await queueOnce(db, "campaigns", reportPeriod("weekly", now, 1))) ? 1 : 0 };
}

/** Campaign results of one week as a plain-text email. */
export function campaignReportEmail(c: Awaited<ReturnType<typeof campaignResults>>, siteUrl: string) {
  const subject = `Weekly campaign report: ${c.period.from} to ${c.period.to}`;
  const text = [
    subject,
    "Global Island Kitchens — counted from the database.",
    "",
    "EMAIL CAMPAIGNS TO PROSPECTS",
    ...(c.emailCampaigns.length
      ? c.emailCampaigns.map(
          (x) =>
            `- ${x.campaign} (${x.status}): ${x.emailsSentInPeriod} emails sent this week; now ${x.nowInterested} interested, ${x.nowConverted} converted, ${x.unsubscribed} unsubscribed`,
        )
      : ["- none this week"]),
    "",
    "SOCIAL MEDIA CAMPAIGNS",
    ...(c.socialCampaigns.length
      ? c.socialCampaigns.map(
          (x) =>
            `- ${x.campaign}: ${x.publications} publications, ${x.likes} likes, ${x.comments} comments, ${x.shares} shares`,
        )
      : ["- none this week"]),
    "",
    `Details: ${siteUrl}/admin/marketing/campaigns and ${siteUrl}/admin/social/campaigns`,
  ].join("\n");
  return { subject, text };
}

/** Outbox delivery of one emailed report to the chosen addresses (or NOTIFY_EMAILS). */
export async function sendReportEmail(
  db: Db,
  e: Env,
  kind: ReportKind | "campaigns",
  periodStart: string,
  siteUrl: string,
  send = sendEmail,
): Promise<ChannelResult> {
  const row = await db.siteSetting.findUnique({ where: { key: "analyticsReports" } });
  const s = parseSetting("analyticsReports", row?.value);
  const to = s.emails.length
    ? s.emails
    : (e.NOTIFY_EMAILS ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
  if (!e.RESEND_API_KEY || !e.EMAIL_FROM || to.length === 0) return "not_configured";
  // The period that started at periodStart (a minute into it picks it); "now" figures as of sending.
  const anchor = new Date(new Date(periodStart).getTime() + 60_000);
  const { subject, text } =
    kind === "campaigns"
      ? campaignReportEmail(await campaignResults(db, reportPeriod("weekly", anchor, 0)), siteUrl)
      : reportEmail(await buildReport(db, kind, new Date(), 0, anchor), siteUrl);
  await send(e, to, subject, text);
  return "sent";
}
export const reportSettingsReady = (e: Pick<Env, "RESEND_API_KEY" | "EMAIL_FROM"> = readEnv()) =>
  Boolean(e.RESEND_API_KEY && e.EMAIL_FROM);
