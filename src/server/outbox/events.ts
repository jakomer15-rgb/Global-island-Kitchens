import type { Tx } from "@/server/db/client";

/** Events written to the outbox in the same transaction as the business change. */
export interface EnquiryReceived {
  kind: "quote" | "consultation" | "contact";
  reference: string;
  leadId: string;
  locale: "en" | "ar";
  customer: { name: string; phone: string | null; email: string | null };
  summary: string;
}

export interface OutboxEvents {
  "enquiry.received": EnquiryReceived;
}

export type OutboxType = keyof OutboxEvents;

export async function enqueue<T extends OutboxType>(tx: Tx, type: T, payload: OutboxEvents[T]) {
  await tx.outboxEvent.create({ data: { type, payload: payload as unknown as object } });
}
