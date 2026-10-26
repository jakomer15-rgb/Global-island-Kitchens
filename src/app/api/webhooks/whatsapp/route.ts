import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { parseWhatsAppPayload, ingestWhatsApp, verifyMetaSignature } from "@/server/whatsapp";

const MAX_BODY = 1_000_000;

/** Meta's one-time check when the webhook is registered. */
export async function GET(request: Request) {
  const { WHATSAPP_VERIFY_TOKEN } = env();
  if (!WHATSAPP_VERIFY_TOKEN) return new Response("Not configured", { status: 404 });
  const params = new URL(request.url).searchParams;
  const given = Buffer.from(params.get("hub.verify_token") ?? "");
  const expected = Buffer.from(WHATSAPP_VERIFY_TOKEN);
  const ok =
    params.get("hub.mode") === "subscribe" &&
    given.length === expected.length &&
    timingSafeEqual(given, expected);
  const challenge = params.get("hub.challenge") ?? "";
  if (!ok || !/^[\w-]{1,200}$/.test(challenge)) return new Response("Forbidden", { status: 403 });
  return new Response(challenge, { headers: { "content-type": "text/plain" } });
}

/** Inbound messages. The body must be signed with the app secret; anything else is refused. */
export async function POST(request: Request) {
  const { WHATSAPP_APP_SECRET } = env();
  if (!WHATSAPP_APP_SECRET) return new Response("Not configured", { status: 404 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) return new Response("Too large", { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response("Too large", { status: 413 });
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), WHATSAPP_APP_SECRET))
    return new Response("Invalid signature", { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  for (const message of parseWhatsAppPayload(payload)) await ingestWhatsApp(db, message);
  return Response.json({ ok: true });
}
