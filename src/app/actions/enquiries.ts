"use server";

import { after } from "next/server";
import type { z } from "zod";
import { looksLikeBot } from "@/lib/forms/common";
import { consultationSchema } from "@/lib/forms/consultation";
import { contactSchema } from "@/lib/forms/contact";
import { quoteRequestSchema } from "@/lib/forms/quote";
import { db } from "@/server/db";
import { submitConsultation, submitContact, submitQuoteRequest } from "@/server/enquiries/submit";
import { RuleError } from "@/server/errors";
import { processOutbox } from "@/server/outbox/worker";
import { rateLimit } from "@/server/rate-limit";
import { clientIpHash } from "@/server/request";
import { getStorage } from "@/server/storage/driver";
import { verifyUploads } from "@/server/storage/files";

/** Result shown by the forms. Error codes are translated under `Forms.errors`. */
export type EnquiryResult =
  { ok: true; reference: string | null } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Sends the new enquiry's notifications right after the response; the cron retries failures. */
function deliverSoon() {
  after(() => processOutbox(db).catch((e) => console.error("Outbox delivery failed", e)));
}

async function guard(form: string, limit: number) {
  const ipHash = await clientIpHash();
  const allowed = await rateLimit(db, `form:${form}:${ipHash}`, limit, 60 * 60);
  return { ipHash, allowed };
}

export async function submitQuoteAction(input: unknown): Promise<EnquiryResult> {
  const { ipHash, allowed } = await guard("quote", 5);
  if (!allowed) return { ok: false, error: "tooMany" };
  const parsed = quoteRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrors(parsed.error) };
  // Bots get a normal-looking reply and nothing is saved.
  if (looksLikeBot(parsed.data)) return { ok: true, reference: null };

  try {
    let verifiedFileIds: string[] = [];
    if (parsed.data.files.length) {
      const storage = getStorage();
      if (!storage) return { ok: false, error: "uploadsOff" };
      verifiedFileIds = await verifyUploads(db, storage, parsed.data.files);
    }
    const { reference } = await submitQuoteRequest(db, parsed.data, { ipHash, verifiedFileIds });
    deliverSoon();
    return { ok: true, reference };
  } catch (error) {
    if (error instanceof RuleError) return { ok: false, error: error.code };
    console.error("Quote submission failed", error);
    return { ok: false, error: "server" };
  }
}

export async function submitConsultationAction(input: unknown): Promise<EnquiryResult> {
  const { ipHash, allowed } = await guard("consultation", 5);
  if (!allowed) return { ok: false, error: "tooMany" };
  const parsed = consultationSchema().safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrors(parsed.error) };
  if (looksLikeBot(parsed.data)) return { ok: true, reference: null };
  try {
    const { reference } = await submitConsultation(db, parsed.data, { ipHash });
    deliverSoon();
    return { ok: true, reference };
  } catch (error) {
    console.error("Consultation submission failed", error);
    return { ok: false, error: "server" };
  }
}

export async function submitContactAction(input: unknown): Promise<EnquiryResult> {
  const { ipHash, allowed } = await guard("contact", 5);
  if (!allowed) return { ok: false, error: "tooMany" };
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrors(parsed.error) };
  if (looksLikeBot(parsed.data)) return { ok: true, reference: null };
  try {
    const { reference } = await submitContact(db, parsed.data, { ipHash });
    deliverSoon();
    return { ok: true, reference };
  } catch (error) {
    console.error("Contact submission failed", error);
    return { ok: false, error: "server" };
  }
}
