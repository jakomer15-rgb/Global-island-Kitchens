import { AUTOPILOT_HELD, AUTOPILOT_NOTE } from "@/lib/autopilot";
import { reportPeriod } from "@/lib/analytics";
import { parseSetting } from "@/lib/site-settings";
import { bahrainTime } from "@/lib/social";
import type { Db } from "@/server/db/client";
import type { Env } from "@/server/env";
import { sendEmail, type ChannelResult, type SendEmail } from "@/server/outbox/deliver";
import { enqueue } from "@/server/outbox/events";
import { readAutopilot } from "./state";

/**
 * The Autopilot morning email: what the AI sent, published and held for a person the day before, and
 * anything that went wrong. Lead references only (no customer names or contact details). Queued once per
 * Bahrain day from 07:00, while Autopilot and its summary are on.
 */

const DAY = 24 * 60 * 60 * 1000;

export async function queueAutopilotSummary(db: Db, now = new Date()) {
  const s = await readAutopilot(db);
  if (!s.enabled || !s.dailySummary) return { queued: 0 };
  if (bahrainTime(now) < "07:00") return { queued: 0 };
  const p = reportPeriod("daily", now, 1);
  return db.$transaction(async (tx) => {
    const inserted = await tx.$executeRaw`
      INSERT INTO "analytics_report_runs" ("id", "kind", "period_start")
      VALUES (${`arr_autopilot_${p.from}`}, 'autopilot', ${p.start})
      ON CONFLICT ("kind", "period_start") DO NOTHING`;
    if (inserted) await enqueue(tx, "autopilot.summary", { periodStart: p.start.toISOString() });
    return { queued: inserted ? 1 : 0 };
  });
}

const held = (note: string | null) => (note ?? "").replace(`${AUTOPILOT_HELD}: `, "");

/** The summary for the Bahrain day starting at `start` (pure data, used by the email and tests). */
export async function autopilotDay(db: Db, start: Date) {
  const range = { gte: start, lt: new Date(start.getTime() + DAY) };
  const autoCampaign = { decisionNote: AUTOPILOT_NOTE };
  const [sent, heldMessages, prospectsSent, unsubscribed, scheduled, published, heldPosts, failed, s] =
    await Promise.all([
      db.customerMessage.findMany({
        where: { decisionNote: AUTOPILOT_NOTE, sentAt: range },
        select: { origin: true, lead: { select: { reference: true } } },
      }),
      db.customerMessage.findMany({
        where: { status: "pending_approval", decisionNote: { startsWith: AUTOPILOT_HELD }, createdAt: range },
        select: { decisionNote: true, lead: { select: { reference: true } } },
      }),
      db.campaignMessage.count({ where: { status: "sent", sentAt: range, campaign: autoCampaign } }),
      db.prospect.count({ where: { unsubscribedAt: range } }),
      db.socialPost.findMany({
        where: { decisionNote: AUTOPILOT_NOTE, approvedAt: range },
        select: { title: true, plannedAt: true },
      }),
      db.socialPostTarget.count({ where: { status: "published", publishedAt: range } }),
      db.socialPost.findMany({
        where: { status: "pending_approval", decisionNote: { startsWith: AUTOPILOT_HELD }, createdAt: range },
        select: { title: true, decisionNote: true },
      }),
      db.outboxEvent.count({
        where: {
          status: "failed",
          createdAt: range,
          type: { in: ["customer.message", "campaign.message", "social.publish"] },
        },
      }),
      readAutopilot(db),
    ]);
  return {
    replies: sent.filter((m) => m.origin === "ai").map((m) => m.lead.reference),
    followUps: sent.filter((m) => m.origin === "auto_follow_up").map((m) => m.lead.reference),
    heldMessages: heldMessages.map((m) => ({ ref: m.lead.reference, reason: held(m.decisionNote) })),
    prospectsSent,
    unsubscribed,
    scheduled,
    published,
    heldPosts: heldPosts.map((p) => ({ title: p.title, reason: held(p.decisionNote) })),
    failed,
    paused: s.prospectPausedReason,
    enabled: s.enabled,
  };
}

export function autopilotSummaryEmail(
  d: Awaited<ReturnType<typeof autopilotDay>>,
  day: string,
  siteUrl: string,
) {
  const list = (items: string[]) => (items.length ? ` (${items.slice(0, 15).join(", ")})` : "");
  const lines = [
    `Autopilot summary for ${day}`,
    "Global Island Kitchens — what the AI did yesterday.",
    "",
    "CUSTOMERS",
    `- First replies to new enquiries: ${d.replies.length}${list(d.replies)}`,
    `- Follow-ups to customers who stopped replying: ${d.followUps.length}${list(d.followUps)}`,
    `- Held for a person: ${d.heldMessages.length}`,
    ...d.heldMessages.slice(0, 15).map((m) => `    ${m.ref}: ${m.reason}`),
    "",
    "PROSPECTS",
    `- Introduction emails sent: ${d.prospectsSent}`,
    `- Unsubscribed: ${d.unsubscribed}`,
    ...(d.paused ? [`- PAUSED: ${d.paused}`] : []),
    "",
    "SOCIAL MEDIA",
    `- Posts written and scheduled: ${d.scheduled.length}${list(d.scheduled.map((p) => p.title))}`,
    `- Published on a platform: ${d.published}`,
    `- Held for a person: ${d.heldPosts.length}`,
    ...d.heldPosts.slice(0, 10).map((p) => `    ${p.title}: ${p.reason}`),
    "",
    `Problems: ${d.failed ? `${d.failed} email(s) or post(s) could not be delivered (see Automation Centre → System log)` : "none"}`,
    "",
    `Waiting for a person: ${siteUrl}/admin/automation/approvals`,
    `Autopilot settings and the OFF switch: ${siteUrl}/admin/automation/autopilot`,
  ];
  return { subject: `Autopilot summary: ${day}`, text: lines.join("\n") };
}

export async function sendAutopilotSummary(
  db: Db,
  e: Env,
  periodStart: string,
  siteUrl: string,
  send: SendEmail = sendEmail,
): Promise<ChannelResult> {
  const row = await db.siteSetting.findUnique({ where: { key: "analyticsReports" } });
  const reports = parseSetting("analyticsReports", row?.value);
  const to = reports.emails.length
    ? reports.emails
    : (e.NOTIFY_EMAILS ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
  if (!e.RESEND_API_KEY || !e.EMAIL_FROM || to.length === 0) return "not_configured";
  const start = new Date(periodStart);
  const day = new Date(start.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { subject, text } = autopilotSummaryEmail(await autopilotDay(db, start), day, siteUrl);
  await send(e, to, subject, text);
  return "sent";
}
