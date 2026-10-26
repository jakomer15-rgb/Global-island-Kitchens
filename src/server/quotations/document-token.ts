import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";

/**
 * Access to the printable quotation document (/documents/quotations/<id>) for the PDF renderer.
 * The token names one revision and expires after two minutes, so the browser that prints the PDF
 * never needs a staff session (it may be a remote browser).
 */
const TTL_MS = 2 * 60 * 1000;

function sign(revisionId: string, exp: number) {
  return createHmac("sha256", `${env().BETTER_AUTH_SECRET}:quotation-document`)
    .update(`${revisionId}.${exp}`)
    .digest("base64url");
}

export function documentToken(revisionId: string, now = Date.now()): string {
  const exp = now + TTL_MS;
  return `${exp}.${sign(revisionId, exp)}`;
}

export function verifyDocumentToken(token: string, revisionId: string, now = Date.now()): boolean {
  const [expText, sig] = token.split(".");
  const exp = Number(expText);
  if (!sig || !Number.isSafeInteger(exp) || exp <= now || exp > now + TTL_MS) return false;
  const expected = Buffer.from(sign(revisionId, exp), "base64url");
  const given = Buffer.from(sig, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
