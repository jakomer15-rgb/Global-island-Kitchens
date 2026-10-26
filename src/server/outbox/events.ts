import type { Tx } from "@/server/db/client";

/** Events written to the outbox in the same transaction as the business change. */
export interface EnquiryReceived {
  kind: "quote" | "consultation" | "contact";
  reference: string;
  leadId: string;
  locale: "en" | "ar";
  customer: { name: string; phone: string | null; email: string | null };
  summary: string;
  /** What the customer agreed to (latest record per channel) and a link to withdraw email consent. */
  customerId?: string;
  consent?: { email: boolean; whatsapp: boolean };
  unsubscribeUrl?: string | null;
}

/** Events for n8n workflows. They carry references and statuses, not contact details. */
export interface LeadStatusChanged {
  leadId: string;
  reference: string;
  from: string;
  to: string;
}
export interface QuotationEvent {
  quotationId: string;
  number: string;
  revision: number;
  totalFils: number;
}
export interface DesignerRegistered {
  designerId: string;
  profession: string;
}
export interface WhatsAppReceived {
  leadId: string;
  reference: string;
  newLead: boolean;
}

export interface OutboxEvents {
  "enquiry.received": EnquiryReceived;
  "lead.status_changed": LeadStatusChanged;
  "quotation.sent": QuotationEvent;
  "quotation.approved": QuotationEvent;
  "designer.registered": DesignerRegistered;
  "whatsapp.received": WhatsAppReceived;
}

export type OutboxType = keyof OutboxEvents;

export async function enqueue<T extends OutboxType>(tx: Tx, type: T, payload: OutboxEvents[T]) {
  await tx.outboxEvent.create({ data: { type, payload: payload as unknown as object } });
}
