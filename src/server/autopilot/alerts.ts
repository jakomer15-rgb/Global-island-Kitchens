import { AUTOPILOT_HELD } from "@/lib/autopilot";
import { bahrainDay, bahrainTime, composeCaption, platformNames } from "@/lib/social";
import type { Db } from "@/server/db/client";
import type { Env } from "@/server/env";
import type { ApprovalRequested } from "@/server/outbox/events";
import { ownerAddresses, sendEmail, type ChannelResult, type SendEmail } from "@/server/outbox/deliver";
import { readAutopilot } from "./state";

/**
 * "Approval needed" emails to the owner (2026-11-20): one per email, campaign or social post waiting for a
 * person, with the full text so it can be read on the phone, and the link to approve it in the admin. Built
 * when sent, so it shows the current text and any safety warnings; skipped if it was decided meanwhile.
 * Customer contact details are not included (the lead reference is).
 */

const warning = (note: string | null) =>
  note?.startsWith(AUTOPILOT_HELD) ? `WARNING: ${note.replace(`${AUTOPILOT_HELD}: `, "")}` : null;

export async function approvalEmail(db: Db, a: ApprovalRequested, siteUrl: string) {
  if (a.kind === "customer_message") {
    const m = await db.customerMessage.findUnique({
      where: { id: a.id },
      include: { lead: { select: { id: true, reference: true, summary: true } } },
    });
    if (!m || m.status !== "pending_approval") return null;
    return {
      subject: `Approval needed: email to customer ${m.lead.reference}`,
      text: [
        `${m.origin === "staff" ? "A team member" : "The AI"} wrote this email to customer ${m.lead.reference} (${m.lead.summary}). It is sent only after you approve it.`,
        warning(m.decisionNote),
        "",
        `Subject: ${m.subject ?? ""}`,
        "",
        m.body,
        "",
        `Approve, change or reject it: ${siteUrl}/admin/leads/${m.lead.id}#messages`,
      ]
        .filter((l) => l !== null)
        .join("\n"),
    };
  }
  if (a.kind === "campaign") {
    const c = await db.campaign.findUnique({
      where: { id: a.id },
      include: {
        messages: { take: 1, orderBy: { createdAt: "asc" }, select: { subject: true, body: true } },
        _count: { select: { messages: true } },
      },
    });
    if (!c || c.status !== "pending_approval") return null;
    const first = c.messages[0];
    return {
      subject: `Approval needed: ${c._count.messages} email(s) to businesses (${c.name})`,
      text: [
        `${c._count.messages} introduction email(s) to businesses in your prospect list are ready. They are sent only after you approve them.`,
        "",
        first ? `Example — Subject: ${first.subject}\n\n${first.body}` : null,
        "",
        `See every email, then approve or reject: ${siteUrl}/admin/marketing/campaigns/${c.id}`,
      ]
        .filter((l) => l !== null)
        .join("\n"),
    };
  }
  const p = await db.socialPost.findUnique({ where: { id: a.id } });
  if (!p || p.status !== "pending_approval") return null;
  return {
    subject: `Approval needed: social media post "${p.title}"`,
    text: [
      `A ${p.type} post for ${p.platforms.map((x) => platformNames[x]).join(", ")} is ready${p.plannedAt ? `, planned for ${bahrainDay(p.plannedAt)} at ${bahrainTime(p.plannedAt)} (Bahrain)` : ""}. It is published only after you approve it.`,
      warning(p.decisionNote),
      p.imageFileId ? "With a photo from your portfolio (shown on the page below)." : null,
      "",
      composeCaption(p),
      "",
      `Approve, change or reject it: ${siteUrl}/admin/social/${p.id}`,
    ]
      .filter((l) => l !== null)
      .join("\n"),
  };
}

/** Outbox delivery of one approval request (Autopilot page → "email me every approval request"). */
export async function sendApprovalRequest(
  db: Db,
  e: Env,
  a: ApprovalRequested,
  siteUrl: string,
  send: SendEmail = sendEmail,
): Promise<ChannelResult> {
  if (!(await readAutopilot(db)).approvalEmails) return "skipped";
  const to = await ownerAddresses(db, e);
  if (!e.RESEND_API_KEY || !e.EMAIL_FROM || to.length === 0) return "not_configured";
  const email = await approvalEmail(db, a, siteUrl);
  if (!email) return "skipped";
  await send(e, to, email.subject, email.text);
  return "sent";
}
