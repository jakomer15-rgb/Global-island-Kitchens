import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signature on every webhook sent to n8n: X-GIK-Signature = hex HMAC-SHA256(secret, `${timestamp}.${body}`),
 * with the Unix time in seconds in X-GIK-Timestamp. docs/n8n/README.md shows the same check for a Code node.
 */
export function signWebhook(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** Receiver-side check (reference implementation): right signature and not older than five minutes. */
export function verifyWebhook(
  secret: string,
  input: { timestamp: string; body: string; signature: string },
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  const sent = Number(input.timestamp);
  if (!Number.isInteger(sent) || Math.abs(nowSeconds - sent) > toleranceSeconds) return false;
  const expected = Buffer.from(signWebhook(secret, input.timestamp, input.body), "hex");
  const given = Buffer.from(input.signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
