import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed tokens for the local storage driver's URLs: { op, key, expires, size?, type? } with an
 * HMAC. Stand-in for S3 presigned URLs during development.
 */
export interface LocalTokenPayload {
  op: "put" | "get";
  key: string;
  exp: number;
  size?: number;
  type?: string;
  name?: string;
}

export function signToken(payload: LocalTokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token: string, secret: string, now = Date.now()): LocalTokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as LocalTokenPayload;
    return payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}
