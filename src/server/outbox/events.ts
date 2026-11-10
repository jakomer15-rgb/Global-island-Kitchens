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

/**
 * A visitor sent the sales chat's contact form. The sales-team email is built when it is sent, from
 * the lead's latest requirements and rating (the AI reading finishes just after the form).
 */
export interface ChatLead {
  leadId: string;
  reference: string;
  conversationId: string;
  reason: "quotation" | "callback" | "showroom_visit" | "human";
  /** false: the chat was added to the customer's open lead. */
  newLead: boolean;
  locale: "en" | "ar";
  customer: { name: string; phone: string; email: string | null };
  preferredContact: "whatsapp" | "call" | "email";
  customerId: string;
  consent: { email: boolean; whatsapp: boolean };
  unsubscribeUrl: string | null;
}

/** An approved message to a customer (Stage 4). The message itself stays in customer_messages. */
export interface CustomerMessageApproved {
  messageId: string;
  leadId: string;
}

export interface OutboxEvents {
  "customer.message": CustomerMessageApproved;
  "enquiry.received": EnquiryReceived;
  "chat.lead": ChatLead;
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
