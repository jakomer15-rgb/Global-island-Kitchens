import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { env } from "@/server/env";

/**
 * Client IP from the proxy headers. On Vercel `x-forwarded-for` is set by the platform; elsewhere
 * the first hop is used. Only ever used in hashed form.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/** Keyed hash of an IP: stable enough for rate limits and abuse checks, useless if leaked. */
export function hashIp(ip: string): string {
  return createHmac("sha256", env().IP_HASH_SECRET).update(ip).digest("base64url").slice(0, 32);
}

export async function clientIpHash(): Promise<string> {
  return hashIp(await clientIp());
}
