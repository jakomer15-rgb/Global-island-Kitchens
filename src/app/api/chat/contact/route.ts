import { after } from "next/server";
import { chatContactSchema } from "@/lib/chat";
import { looksLikeBot } from "@/lib/forms/common";
import { analyseConversation } from "@/server/chat/analysis";
import { openConversation } from "@/server/chat/conversation";
import { submitChatContact } from "@/server/chat/leads";
import { chatSettings } from "@/server/chat/reply";
import { db } from "@/server/db";
import { RuleError } from "@/server/errors";
import { processOutbox } from "@/server/outbox/worker";
import { json, readJsonBody, sameOrigin } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { clientIpHash } from "@/server/request";
import { getStorage } from "@/server/storage/driver";
import { verifyUploads } from "@/server/storage/files";

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) out[issue.path.join(".")] ??= issue.message;
  return out;
}

/**
 * The sales chat's contact form: saves the visitor's details as a lead (src/server/chat/leads.ts).
 * Same-origin, schema-checked, rate-limited, with the forms' spam traps. Responds
 * `{ reference }` or `{ error, fieldErrors? }`.
 */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return json({ error: "invalid" }, 403);
  const ipHash = await clientIpHash();
  if (!(await rateLimit(db, `form:chat:${ipHash}`, 5, 60 * 60))) return json({ error: "tooMany" }, 429);

  const parsed = chatContactSchema.safeParse(await readJsonBody(request, 20_000));
  if (!parsed.success) return json({ error: "invalid", fieldErrors: fieldErrors(parsed.error.issues) }, 400);
  // Bots get a normal-looking answer and nothing is saved.
  if (looksLikeBot(parsed.data)) return json({ reference: null });
  if (!(await chatSettings(db)).enabled) return json({ error: "aiOff" }, 503);

  // Returned with errors too, so a retry continues the same conversation.
  let session = parsed.data.session;
  try {
    let verifiedFileIds: string[] = [];
    if (parsed.data.files.length) {
      const storage = getStorage();
      if (!storage) return json({ error: "uploadsOff", session }, 503);
      verifiedFileIds = await verifyUploads(db, storage, parsed.data.files);
    }
    // The conversation so far (or a new one, if the visitor only used the quick options).
    const { conversation, token, created } = await openConversation(db, {
      session: parsed.data.session,
      locale: parsed.data.locale,
      ipHash,
    });
    session = token;
    const { reference } = await submitChatContact(db, parsed.data, {
      conversationId: conversation.id,
      newConversation: created,
      ipHash,
      verifiedFileIds,
    });
    // Bring the requirements and HOT / WARM / COLD up to date on the lead, then tell the sales team
    // (the email is built from the lead after the reading). The scheduled job retries failures.
    after(async () => {
      await analyseConversation(db, conversation.id, { force: true }).catch((e) =>
        console.error("Chat analysis failed", e),
      );
      await processOutbox(db).catch((e) => console.error("Outbox delivery failed", e));
    });
    return json({ reference, session: token });
  } catch (error) {
    if (error instanceof RuleError) return json({ error: error.code, session }, 400);
    console.error("Chat contact form failed", error);
    return json({ error: "server", session }, 500);
  }
}
