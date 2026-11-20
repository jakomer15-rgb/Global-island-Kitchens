import type { Prisma } from "@/generated/prisma/client";
import { AUTOPILOT_NOTE, bahrainDayStarted } from "@/lib/autopilot";
import { bahrainDay } from "@/lib/social";
import { audit } from "@/server/audit";
import type { Db } from "@/server/db/client";
import { env as readEnv, type Env } from "@/server/env";
import { eligibleWhere, fillTemplate } from "@/server/marketing/campaigns";
import { enqueue } from "@/server/outbox/events";
import { emailReady } from "@/server/outreach/messages";
import { autoSends, notifyHolders, partActive, readAutopilot, writeAutopilotBySystem } from "./state";

/**
 * Autopilot's introduction emails to prospects: every run, up to the day's limit, the highest-scored new
 * prospects with an email address get the template the owner approved once (filled with their company,
 * area and type). Each day's emails form one campaign ("Autopilot 2026-11-20") so they show in Marketing →
 * Campaigns and the reports. The same rules as campaigns apply (unsubscribe link, never to do-not-contact
 * or unsubscribed prospects, nobody twice within 30 days), and the safety checks below pause it.
 */

/** Pause when this many emails failed for good in a day … */
export const MAX_FAILED_PER_DAY = 3;
/** … or when more than this share of last week's emails led to an unsubscribe (with enough sent). */
export const MAX_UNSUBSCRIBE_RATE = 0.1;
export const MIN_SENT_FOR_RATE = 20;

const DAY = 24 * 60 * 60 * 1000;

/** Why prospect emails must stop now, or null. */
export async function prospectHealth(db: Db, now = new Date()): Promise<string | null> {
  const failed = await db.outboxEvent.count({
    where: {
      type: "campaign.message",
      status: "failed",
      createdAt: { gte: new Date(now.getTime() - DAY), lte: now },
    },
  });
  if (failed >= MAX_FAILED_PER_DAY)
    return `${failed} prospect emails could not be delivered in the last 24 hours. Check the email connection, then switch prospect emails on again.`;
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const sent = await db.campaignMessage.count({
    where: { status: "sent", sentAt: { gte: weekAgo }, campaign: { decisionNote: AUTOPILOT_NOTE } },
  });
  if (sent >= MIN_SENT_FOR_RATE) {
    const unsubscribed = await db.prospect.count({
      where: {
        unsubscribedAt: { gte: weekAgo },
        messages: { some: { status: "sent", campaign: { decisionNote: AUTOPILOT_NOTE } } },
      },
    });
    if (unsubscribed / sent > MAX_UNSUBSCRIBE_RATE)
      return `${unsubscribed} of ${sent} prospects emailed in the last 7 days unsubscribed. Review the email text before switching prospect emails on again.`;
  }
  return null;
}

export async function runProspectAutopilot(db: Db, options: { now?: Date; env?: Env } = {}) {
  const now = options.now ?? new Date();
  const e = options.env ?? readEnv();
  const s = await readAutopilot(db);
  if (!partActive(s, "prospectEmails") || !s.prospectTemplate) return { queued: 0, skipped: "off" };
  if (!emailReady(e)) return { queued: 0, skipped: "emailOff" };

  const problem = await prospectHealth(db, now);
  if (problem) {
    await db.$transaction(async (tx) => {
      await writeAutopilotBySystem(
        tx,
        { ...s, prospectPausedReason: problem.slice(0, 300) },
        "autopilot.prospects_paused",
        { reason: problem },
      );
      await notifyHolders(
        tx,
        "workflows.manage",
        "Autopilot paused prospect emails",
        "/admin/automation/autopilot",
        problem,
      );
    });
    return { queued: 0, paused: 1 };
  }

  // Today's emails prepared by Autopilot, sent or waiting (its campaigns are named "Autopilot <day>").
  const today = await db.campaignMessage.count({
    where: {
      campaign: { name: { startsWith: "Autopilot " } },
      createdAt: { gte: bahrainDayStarted(now), lt: new Date(bahrainDayStarted(now).getTime() + DAY) },
      status: { in: ["draft", "queued", "sent"] },
    },
  });
  const room = s.prospectEmailsPerDay - today;
  if (room <= 0) return { queued: 0, skipped: "limit" };

  const t = s.prospectTemplate;
  const eligible: Prisma.ProspectWhereInput = {
    AND: [
      eligibleWhere({ status: "new" }, now),
      // Not already in a batch waiting for approval.
      { messages: { none: { status: "draft", campaign: { status: "pending_approval" } } } },
    ],
  };
  if (!autoSends(s))
    return db.$transaction(async (tx) => {
      const prospects = await tx.prospect.findMany({
        where: eligible,
        orderBy: [{ score: "desc" }, { createdAt: "asc" }],
        take: room,
      });
      if (!prospects.length) return { prepared: 0, skipped: "nobody" };
      const campaign = await tx.campaign.create({
        data: {
          name: `Autopilot ${bahrainDay(now)}${today ? ` (${today + 1}+)` : ""}`,
          brief:
            "Introduction emails prepared by Autopilot from the approved template, waiting for approval.",
          subjectTemplate: t.subject,
          bodyTemplate: t.body,
          language: t.language,
          audience: { status: "new" },
          status: "pending_approval",
        },
      });
      await tx.campaignMessage.createMany({
        data: prospects.map((p) => ({
          campaignId: campaign.id,
          prospectId: p.id,
          subject: fillTemplate(t.subject, p, t.language),
          body: fillTemplate(t.body, p, t.language),
          createdAt: now,
        })),
      });
      await notifyHolders(
        tx,
        "outreach.approve",
        `Campaign to approve: ${campaign.name}`,
        `/admin/marketing/campaigns/${campaign.id}`,
        `${prospects.length} email(s)`,
      );
      await enqueue(tx, "approval.requested", { kind: "campaign", id: campaign.id });
      await audit(tx, {
        actorId: null,
        action: "campaign.autopilot_prepared",
        entityType: "campaign",
        entityId: campaign.id,
        changes: { emails: prospects.length },
      });
      return { prepared: prospects.length };
    });

  return db.$transaction(async (tx) => {
    const prospects = await tx.prospect.findMany({
      where: eligible,
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
      take: room,
    });
    if (!prospects.length) return { queued: 0, skipped: "nobody" };
    const name = `Autopilot ${bahrainDay(now)}`;
    const existing = await tx.campaign.findFirst({ where: { name, decisionNote: AUTOPILOT_NOTE } });
    const campaign = existing
      ? await tx.campaign.update({ where: { id: existing.id }, data: { status: "approved" } })
      : await tx.campaign.create({
          data: {
            name,
            brief:
              "Introduction emails sent automatically by Autopilot from the template the owner approved.",
            subjectTemplate: t.subject,
            bodyTemplate: t.body,
            language: t.language,
            audience: { status: "new" },
            status: "approved",
            decidedAt: now,
            decisionNote: AUTOPILOT_NOTE,
          },
        });
    for (const p of prospects) {
      const m = await tx.campaignMessage.create({
        data: {
          campaignId: campaign.id,
          prospectId: p.id,
          subject: fillTemplate(t.subject, p, t.language),
          body: fillTemplate(t.body, p, t.language),
          status: "queued",
          createdAt: now,
        },
      });
      await enqueue(tx, "campaign.message", { campaignMessageId: m.id, campaignId: campaign.id });
    }
    await audit(tx, {
      actorId: null,
      action: "campaign.autopilot_queued",
      entityType: "campaign",
      entityId: campaign.id,
      changes: { queued: prospects.length },
    });
    return { queued: prospects.length };
  });
}
