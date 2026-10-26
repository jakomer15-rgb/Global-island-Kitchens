import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { normalisePhone } from "@/lib/phone";
import { audit } from "@/server/audit";
import type { Db, Tx } from "@/server/db/client";
import { notify } from "@/server/crm/shared";
import { nextReference } from "@/server/enquiries/submit";
import { enqueue } from "@/server/outbox/events";

/**
 * WhatsApp Business Cloud API, inbound only: messages customers send to the company number are
 * logged on their lead so the team sees them in the CRM. The app never replies on its own; anything
 * sent to a customer is written and sent by staff (or by an n8n workflow the owner approves, which
 * must check consent first).
 */

/** Meta signs the raw body with the app secret: `X-Hub-Signature-256: sha256=<hex>`. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const webhookSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              value: z
                .object({
                  contacts: z
                    .array(
                      z.object({
                        wa_id: z.string(),
                        profile: z.object({ name: z.string().optional() }).optional(),
                      }),
                    )
                    .optional(),
                  messages: z
                    .array(
                      z.object({
                        id: z.string().min(1).max(200),
                        from: z.string().regex(/^\d{6,15}$/),
                        type: z.string().max(40),
                        text: z.object({ body: z.string() }).optional(),
                      }),
                    )
                    .optional(),
                })
                .optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

export interface InboundWhatsApp {
  id: string;
  from: string;
  name: string | null;
  text: string;
}

/** The messages in a webhook payload (status updates and other notifications are ignored). */
export function parseWhatsAppPayload(payload: unknown): InboundWhatsApp[] {
  const parsed = webhookSchema.safeParse(payload);
  if (!parsed.success) return [];
  const out: InboundWhatsApp[] = [];
  for (const entry of parsed.data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      for (const message of value?.messages ?? []) {
        const name = value?.contacts?.find((c) => c.wa_id === message.from)?.profile?.name ?? null;
        const text =
          message.type === "text" && message.text
            ? message.text.body.slice(0, 2000)
            : `[${message.type} message: open WhatsApp to view it]`;
        out.push({ id: message.id, from: message.from, name: name?.slice(0, 100) ?? null, text });
      }
    }
  }
  return out;
}

async function staffToNotify(db: Tx, assignedToId: string | null) {
  if (assignedToId) return [{ id: assignedToId }];
  return db.user.findMany({
    where: {
      kind: "staff",
      status: "active",
      roles: { some: { role: { permissions: { some: { permissionKey: "lead.update" } } } } },
    },
    select: { id: true },
  });
}

/** Logs one inbound message on the customer's open lead, creating the customer and lead if needed. Safe to repeat. */
export async function ingestWhatsApp(db: Db, message: InboundWhatsApp): Promise<{ duplicate: boolean }> {
  const phone =
    normalisePhone(`+${message.from}`) ?? (/^[1-9]\d{6,14}$/.test(message.from) ? `+${message.from}` : null);
  if (!phone) return { duplicate: false };
  try {
    await db.$transaction(async (tx) => {
      if (await tx.leadActivity.findUnique({ where: { externalId: message.id }, select: { id: true } }))
        throw new DuplicateMessage();
      const customer =
        (await tx.customer.findFirst({
          where: { phone, archivedAt: null },
          orderBy: { createdAt: "asc" },
        })) ??
        (await tx.customer.create({
          data: { name: message.name || phone, phone, type: "homeowner", preferredLanguage: "en" },
        }));
      let lead = await tx.lead.findFirst({
        where: { customerId: customer.id, archivedAt: null, status: { notIn: ["won", "lost"] } },
        orderBy: { createdAt: "desc" },
      });
      const newLead = !lead;
      lead ??= await tx.lead.create({
        data: {
          reference: await nextReference(tx, "W"),
          customerId: customer.id,
          source: "whatsapp",
          summary: "Message on WhatsApp",
          locale: "en",
        },
      });
      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          kind: "whatsapp",
          internal: false,
          body: message.text,
          externalId: message.id,
        },
      });
      for (const staff of await staffToNotify(tx, lead.assignedToId)) {
        await notify(tx, staff.id, "New WhatsApp message", `/admin/leads/${lead.id}`, `On ${lead.reference}`);
      }
      await enqueue(tx, "whatsapp.received", { leadId: lead.id, reference: lead.reference, newLead });
      await audit(tx, {
        actorId: null,
        action: "whatsapp.received",
        entityType: "lead",
        entityId: lead.id,
        changes: { newLead },
      });
    });
  } catch (error) {
    if (error instanceof DuplicateMessage) return { duplicate: true };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return { duplicate: true };
    throw error;
  }
  return { duplicate: false };
}

class DuplicateMessage extends Error {}
