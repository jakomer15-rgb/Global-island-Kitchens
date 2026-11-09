import { createHash, randomBytes } from "node:crypto";
import type { ChatConversation } from "@/generated/prisma/client";
import { isChatCardText } from "@/content/chat";
import type { ChatRequest } from "@/lib/chat";
import { redactContact } from "@/server/ai/grounding";
import type { Db, Tx } from "@/server/db/client";
import type { ChatUsage } from "./claude";

/**
 * Sales chat conversations. The browser keeps a random token (sessionStorage, this tab only); the
 * database keeps its hash, so a leaked database can't be used to continue someone's chat. Messages are
 * stored with phone numbers and email addresses removed, the same text the AI provider sees.
 */

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

/** The longest stored message; matches the database CHECK. */
const MAX_STORED = 8000;
const clip = (text: string) => (text.length > MAX_STORED ? `${text.slice(0, MAX_STORED - 1)}…` : text);

/** The conversation for this token, or a new one (with a new token) when it is missing or unknown. */
export async function openConversation(
  db: Db,
  input: { session?: string; locale: "en" | "ar"; ipHash: string | null },
): Promise<{ conversation: ChatConversation; token: string; created: boolean }> {
  if (input.session) {
    const found = await db.chatConversation.findUnique({ where: { tokenHash: hashToken(input.session) } });
    if (found) return { conversation: found, token: input.session, created: false };
  }
  const token = newToken();
  const conversation = await db.chatConversation.create({
    data: { tokenHash: hashToken(token), locale: input.locale, ipHash: input.ipHash },
  });
  return { conversation, token, created: true };
}

export async function findConversation(db: Db, token: string) {
  return db.chatConversation.findUnique({ where: { tokenHash: hashToken(token) } });
}

/**
 * The messages from the browser the server hasn't seen yet: the visitor's new message and any quick
 * options or cards shown in the window since the last reply (for a new conversation, everything sent).
 * "Assistant" messages are kept only when they are one of the window's own cards: the browser can't
 * put words in the assistant's mouth, whose real replies are saved by the server as they stream.
 */
export function freshMessages(
  input: { messages: ChatRequest["messages"]; fresh?: number },
  created: boolean,
): ChatRequest["messages"] {
  const count = created ? input.messages.length : Math.min(input.fresh ?? 1, input.messages.length);
  // (slice(-0) would be everything)
  const fresh = count > 0 ? input.messages.slice(-count) : [];
  return fresh.filter((m) => m.role === "user" || isChatCardText(m.text));
}

/** Stores {@link freshMessages}. */
export async function saveVisitorTurn(
  db: Tx,
  conversationId: string,
  input: { messages: ChatRequest["messages"]; fresh?: number },
  created: boolean,
) {
  const fresh = freshMessages(input, created);
  if (fresh.length === 0) return;
  const start = Date.now();
  await db.chatMessage.createMany({
    data: fresh.map((m, i) => ({
      conversationId,
      role: m.role,
      content: clip(m.role === "user" ? redactContact(m.text) || "…" : m.text),
      // Keep their order even when written in the same millisecond.
      createdAt: new Date(start + i),
    })),
  });
  await db.chatConversation.update({
    where: { id: conversationId },
    data: { messageCount: { increment: fresh.length }, lastMessageAt: new Date(start + fresh.length) },
  });
}

/**
 * What the AI reads: the conversation as the server saved it (contact details already removed), newest
 * last, within a size limit so a long chat can't make every reply expensive. Starts with the visitor.
 */
export async function conversationHistory(
  db: Db,
  conversationId: string,
  limits: { messages: number; chars: number },
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const rows = await db.chatMessage.findMany({
    where: { conversationId, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "desc" },
    take: limits.messages,
    select: { role: true, content: true },
  });
  const out: { role: "user" | "assistant"; content: string }[] = [];
  let size = 0;
  for (const row of rows) {
    size += row.content.length;
    // The newest message always goes, however long.
    if (out.length > 0 && size > limits.chars) break;
    out.unshift({ role: row.role as "user" | "assistant", content: row.content });
  }
  while (out.length > 1 && out[0]!.role !== "user") out.shift();
  return out;
}

export async function saveAssistantReply(
  db: Db,
  conversationId: string,
  text: string,
  usage: ChatUsage | undefined,
) {
  await db.$transaction([
    ...(text.trim()
      ? [
          db.chatMessage.create({
            data: { conversationId, role: "assistant", content: clip(text.trim()), createdAt: new Date() },
          }),
        ]
      : []),
    db.chatConversation.update({
      where: { id: conversationId },
      data: {
        messageCount: { increment: text.trim() ? 1 : 0 },
        lastMessageAt: new Date(),
        ...(usage && {
          model: usage.model,
          inputTokens: { increment: usage.inputTokens },
          outputTokens: { increment: usage.outputTokens },
          cacheReadTokens: { increment: usage.cacheReadTokens },
          cacheWriteTokens: { increment: usage.cacheWriteTokens },
        }),
      },
    }),
  ]);
}

/** Something that happened in the chat, shown to staff in the transcript (never sent to the model). */
export async function saveChatEvent(db: Db, conversationId: string, text: string) {
  await db.chatMessage.create({ data: { conversationId, role: "event", content: clip(text) } });
}
