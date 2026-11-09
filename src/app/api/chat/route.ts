import { after } from "next/server";
import { chatRequestSchema } from "@/lib/chat";
import { analyseConversation } from "@/server/chat/analysis";
import { startChatReply } from "@/server/chat/reply";
import { db } from "@/server/db";
import { json, readJsonBody, sameOrigin } from "@/server/http";
import { clientIpHash } from "@/server/request";

/** Largest request body accepted: 30 messages of up to 4,000 characters, with room for JSON. */
const MAX_BODY_BYTES = 200_000;

/**
 * The sales chat. Same-origin only; the body is checked against the shared schema; the reply streams
 * back as NDJSON (src/lib/chat.ts). Errors are `{ error: code }` with no detail. After the reply, the
 * conversation is read for requirements and HOT / WARM / COLD (src/server/chat/analysis.ts).
 */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return json({ error: "invalid" }, 403);
  const parsed = chatRequestSchema.safeParse(await readJsonBody(request, MAX_BODY_BYTES));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  // Honeypot filled in: answer like a normal refusal, without saying why.
  if (parsed.data.website) return json({ error: "invalid" }, 400);

  try {
    const reply = await startChatReply(db, parsed.data, await clientIpHash());
    if (!reply.ok) return json({ error: reply.error }, reply.error === "tooMany" ? 429 : 503);
    after(() =>
      analyseConversation(db, reply.conversationId).catch((e) => console.error("Chat analysis failed", e)),
    );
    return new Response(reply.stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Sales chat failed", error);
    return json({ error: "server" }, 500);
  }
}
