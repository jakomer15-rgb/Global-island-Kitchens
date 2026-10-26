import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/config/site";
import type { Tx } from "@/server/db/client";
import { audit } from "@/server/audit";
import { env } from "@/server/env";
import { RuleError } from "@/server/errors";

/**
 * Marketing and automation consent. The latest record per channel wins (a withdrawal is a new
 * record with granted = false). Anything automated that contacts a customer must check this first;
 * n8n events carry the snapshot so workflows can too.
 */

export const consentChannels = ["email", "whatsapp"] as const;
export type ConsentChannelName = (typeof consentChannels)[number];

export async function consentSnapshot(
  db: Tx,
  customerId: string,
): Promise<Record<ConsentChannelName, boolean>> {
  const rows = await db.consentRecord.findMany({
    where: { customerId, channel: { in: [...consentChannels] } },
    orderBy: { recordedAt: "desc" },
    select: { channel: true, granted: true },
  });
  const result = { email: false, whatsapp: false };
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.channel)) continue;
    seen.add(row.channel);
    result[row.channel as ConsentChannelName] = row.granted;
  }
  return result;
}

function sign(customerId: string, channel: string) {
  return createHmac("sha256", `${env().BETTER_AUTH_SECRET}:unsubscribe`)
    .update(`${customerId}.${channel}`)
    .digest("base64url");
}

/** A link a customer can use to withdraw consent for one channel. It does not expire. */
export function unsubscribeUrl(customerId: string, channel: ConsentChannelName, base = siteUrl): string {
  const token = `${channel}.${customerId}.${sign(customerId, channel)}`;
  return `${base.replace(/\/$/, "")}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function readUnsubscribeToken(
  token: string,
): { customerId: string; channel: ConsentChannelName } | null {
  const [channel, customerId, sig] = token.split(".");
  if (!channel || !customerId || !sig) return null;
  if (!(consentChannels as readonly string[]).includes(channel)) return null;
  const expected = Buffer.from(sign(customerId, channel), "base64url");
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return { customerId, channel: channel as ConsentChannelName };
}

/** Withdraws consent for the channel in the token. Safe to repeat. */
export async function unsubscribe(db: Tx, token: string, ipHash: string | null) {
  const parsed = readUnsubscribeToken(token);
  if (!parsed) throw new RuleError("invalidLink");
  const customer = await db.customer.findUnique({ where: { id: parsed.customerId }, select: { id: true } });
  if (!customer) throw new RuleError("invalidLink");
  const latest = await db.consentRecord.findFirst({
    where: { customerId: customer.id, channel: parsed.channel },
    orderBy: { recordedAt: "desc" },
  });
  if (latest && !latest.granted) return parsed.channel;
  await db.consentRecord.create({
    data: {
      customerId: customer.id,
      channel: parsed.channel,
      granted: false,
      source: "unsubscribe_link",
      ipHash,
    },
  });
  await audit(db, {
    actorId: null,
    action: "consent.withdrawn",
    entityType: "customer",
    entityId: customer.id,
    changes: { channel: parsed.channel, via: "unsubscribe_link" },
    ipHash,
  });
  return parsed.channel;
}

/** Fields added to outbox events about a customer: what they agreed to, and how to withdraw. */
export async function consentFields(db: Tx, customerId: string) {
  const consent = await consentSnapshot(db, customerId);
  return {
    customerId,
    consent,
    unsubscribeUrl: consent.email ? unsubscribeUrl(customerId, "email") : null,
  };
}
