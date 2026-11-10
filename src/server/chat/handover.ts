import type { Tx } from "@/server/db/client";
import { notify } from "@/server/crm/shared";

/** Reasons that mean "a person should contact me" rather than "send me a quotation". */
export const HANDOVER_REASONS = ["human", "callback"] as const;

/** How soon the team is asked to call back. */
export const HANDOVER_DUE_MS = 2 * 60 * 60 * 1000;

/**
 * Hands a chat over to the sales team: marks the lead, adds a follow-up due within two hours (for the
 * lead's salesperson, or unassigned) and alerts everyone who assigns leads, in the admin. The chat
 * email and WhatsApp alert to the team are sent as for every chat lead (outbox).
 */
export async function requestHandover(
  tx: Tx,
  lead: { id: string; reference: string; assignedToId: string | null },
  reason: string,
  now = new Date(),
) {
  await tx.lead.update({ where: { id: lead.id }, data: { handoverRequestedAt: now } });
  await tx.followUp.create({
    data: {
      leadId: lead.id,
      dueAt: new Date(now.getTime() + HANDOVER_DUE_MS),
      assignedToId: lead.assignedToId,
      note:
        reason === "callback"
          ? "Callback requested in the website chat."
          : "Asked in the website chat to talk to a person.",
    },
  });
  const managers = await tx.user.findMany({
    where: {
      kind: "staff",
      status: "active",
      roles: { some: { role: { permissions: { some: { permissionKey: "lead.assign" } } } } },
    },
    select: { id: true },
  });
  const recipients = new Set([
    ...managers.map((m) => m.id),
    ...(lead.assignedToId ? [lead.assignedToId] : []),
  ]);
  for (const userId of recipients) {
    await notify(
      tx,
      userId,
      `${lead.reference}: customer wants to talk to a person`,
      `/admin/leads/${lead.id}`,
      reason === "callback" ? "Callback requested in the chat." : "Hand-over requested in the chat.",
    );
  }
}
