import { encodeChatEvent, type ChatErrorCode, type ChatEvent, type ChatRequest } from "@/lib/chat";
import { parseSetting, type Settings } from "@/lib/site-settings";
import { aiConfigured } from "@/server/ai/provider";
import { redactContact } from "@/server/ai/grounding";
import type { Db } from "@/server/db/client";
import { env } from "@/server/env";
import { reason } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { claudeChat, mockChat, type ChatModelFn, type ChatTurn, type ChatUsage } from "./claude";
import { conversationHistory, openConversation, saveAssistantReply, saveVisitorTurn } from "./conversation";
import { fallbackKnowledgeSources, knowledgeText, loadKnowledgeSources } from "./knowledge";
import { buildSystemPrompt, visitContext } from "./prompt";

/**
 * The public sales chat ("GIK Smart Assistant"). Checks the switch and the limits, builds the
 * instructions from the knowledge base, and streams Claude's reply back as NDJSON events.
 * Contact details visitors type are removed before anything is sent to the AI provider.
 */

export const CHAT_LIMITS = {
  /** Per visitor (hashed IP). The site-wide daily ceiling is set in Admin → AI agent. */
  perVisitorPerHour: 40,
  perVisitorPerDay: 150,
  /** What the AI reads of a conversation: enough for a sales chat, never an unbounded bill. */
  historyMessages: 30,
  historyChars: 12_000,
} as const;

export type ChatReply =
  | { ok: true; stream: ReadableStream<Uint8Array>; conversationId: string }
  | { ok: false; error: ChatErrorCode };

export async function chatSettings(db: Db): Promise<Settings["chatAgent"]> {
  const row = await db.siteSetting.findUnique({ where: { key: "chatAgent" } });
  return parseSetting("chatAgent", row?.value);
}

/**
 * Counts one AI call (a reply or a background reading) against the site's daily ceiling set in
 * Admin → AI agent. Returns false once today's ceiling is reached.
 */
export async function spendSiteBudget(db: Db, settings: Settings["chatAgent"]): Promise<boolean> {
  return rateLimit(db, "chat:all", settings.dailyMessageLimit, 24 * 60 * 60);
}

/**
 * The saved conversation as the provider receives it: contact details removed (again, in case an older
 * message was saved before a pattern was added), and the visit's context in the latest turn.
 */
export function toProviderTurns(
  history: { role: "user" | "assistant"; content: string }[],
  locale: "en" | "ar",
  now = new Date(),
): ChatTurn[] {
  const turns: ChatTurn[] = history.map((m) => ({
    role: m.role,
    content: m.role === "user" ? redactContact(m.content) || "…" : m.content,
  }));
  const last = turns.at(-1)!;
  last.content = [
    { type: "text", text: visitContext(locale, now) },
    { type: "text", text: last.content as string },
  ];
  return turns;
}

export async function startChatReply(
  db: Db,
  input: ChatRequest,
  ipHash: string | null,
  model: ChatModelFn = env().AI_PROVIDER === "mock" ? mockChat : claudeChat,
): Promise<ChatReply> {
  const settings = await chatSettings(db);
  if (!settings.enabled || !aiConfigured()) return { ok: false, error: "aiOff" };
  if (
    ipHash &&
    (!(await rateLimit(db, `chat:${ipHash}`, CHAT_LIMITS.perVisitorPerHour, 60 * 60)) ||
      !(await rateLimit(db, `chat:day:${ipHash}`, CHAT_LIMITS.perVisitorPerDay, 24 * 60 * 60)))
  )
    return { ok: false, error: "tooMany" };
  if (!(await spendSiteBudget(db, settings))) return { ok: false, error: "busy" };

  let sources;
  try {
    sources = await loadKnowledgeSources(db);
  } catch (error) {
    console.warn("Chat knowledge unavailable, using the built-in facts:", reason(error));
    sources = fallbackKnowledgeSources();
  }
  const system = buildSystemPrompt(knowledgeText(sources), settings.instructions);

  const { conversation, token, created } = await openConversation(db, {
    session: input.session,
    locale: input.locale,
    ipHash,
  });
  await saveVisitorTurn(db, conversation.id, input, created);
  // What the AI reads comes from the database, not from what the browser says was said.
  const messages = toProviderTurns(
    await conversationHistory(db, conversation.id, {
      messages: CHAT_LIMITS.historyMessages,
      chars: CHAT_LIMITS.historyChars,
    }),
    input.locale,
  );

  const abort = new AbortController();
  const encoder = new TextEncoder();
  let open = true;
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, event: ChatEvent) => {
    if (open) controller.enqueue(encoder.encode(encodeChatEvent(event)));
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      let usage: ChatUsage | undefined;
      // A new conversation's token goes first, so the window can keep it even if the reply fails.
      if (created) send(controller, { t: "session", v: token });
      try {
        for await (const part of model({ model: settings.model, system, messages, signal: abort.signal })) {
          if (part.type === "text") {
            reply += part.text;
            send(controller, { t: "text", v: part.text });
          } else if (part.type === "form") {
            send(controller, { t: "form", reason: part.reason });
          } else {
            usage = part.usage;
            send(controller, part.reason === "declined" ? { t: "error", code: "declined" } : { t: "done" });
          }
        }
      } catch (error) {
        if (!abort.signal.aborted) {
          // The provider's error body is never logged or shown: it can echo the conversation.
          console.error("Sales chat provider failed:", error instanceof Error ? error.name : "unknown");
          send(controller, { t: "error", code: "server" });
        }
      } finally {
        // Saved before the response ends, so the analysis that runs afterwards reads the full reply.
        await saveAssistantReply(db, conversation.id, reply, usage).catch((e) =>
          console.error("Saving the chat reply failed:", reason(e)),
        );
        open = false;
        try {
          controller.close();
        } catch {
          // Already closed because the visitor left.
        }
      }
    },
    cancel() {
      // The visitor closed the page: stop paying for a reply nobody reads.
      open = false;
      abort.abort();
    },
  });
  return { ok: true, stream, conversationId: conversation.id };
}
