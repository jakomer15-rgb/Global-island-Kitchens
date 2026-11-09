import { z } from "zod";
import { consent, name, optionalEmail, optionalText, phone, spamTraps } from "@/lib/forms/common";

/**
 * The sales chat's wire format, shared by the browser and POST /api/chat.
 *
 * Request: JSON {@link chatRequestSchema}. Response: on success `application/x-ndjson`, one
 * {@link ChatEvent} per line, so the reply can be shown while it is being written; on failure plain
 * JSON `{ error: ChatErrorCode }` with a 4xx/5xx status.
 */

export const CHAT_MAX_MESSAGE = 1000;
export const CHAT_MAX_HISTORY = 30;

export const chatErrorCodes = ["aiOff", "tooMany", "busy", "declined", "invalid", "server"] as const;
export type ChatErrorCode = (typeof chatErrorCodes)[number];

const chatMessage = z
  .object({
    role: z.enum(["user", "assistant"]),
    text: z
      .string()
      .trim()
      .min(1)
      .max(CHAT_MAX_MESSAGE * 4),
  })
  // The visitor's own messages, earlier ones too, are never longer than the box allows.
  .refine((m) => m.role === "assistant" || m.text.length <= CHAT_MAX_MESSAGE, {
    message: `Messages are limited to ${CHAT_MAX_MESSAGE} characters.`,
  });

/** 32 random bytes, base64url. Only its SHA-256 is stored. */
export const chatSessionToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const chatRequestSchema = z.object({
  locale: z.enum(["en", "ar"]),
  /** The conversation so far, oldest first, ending with the visitor's new message. */
  messages: z
    .array(chatMessage)
    .min(1)
    .max(CHAT_MAX_HISTORY)
    .refine((m) => m.at(-1)?.role === "user", "The last message must be the visitor's."),
  /** The conversation's token from an earlier `session` event; absent on the first message. */
  session: chatSessionToken.optional(),
  /**
   * How many messages at the end of `messages` the server hasn't saved yet (the new message, plus any
   * quick options and cards shown since the last reply). Defaults to the new message only.
   */
  fresh: z.number().int().min(1).max(12).optional(),
  /** Honeypot: always empty for people. */
  website: z.string().max(200).optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Why the assistant offers the contact form (also the buttons on the chat's cards). */
export const contactReasons = ["quotation", "callback", "showroom_visit", "human"] as const;
export type ContactReason = (typeof contactReasons)[number];

export const CHAT_MAX_FILES = 5;

/**
 * The chat's contact form (POST /api/chat/contact). The only way contact details reach the CRM from
 * the chat; the AI provider never sees them. Error messages are keys of `chatCopy.form.errors`.
 */
export const chatContactSchema = z
  .object({
    /** Absent when the visitor only used the quick options: the server then starts the conversation. */
    session: chatSessionToken.optional(),
    /** The conversation as shown, so a conversation started from quick options is saved too. */
    messages: z.array(chatMessage).max(CHAT_MAX_HISTORY).default([]),
    /** How many messages at the end of `messages` the server hasn't saved yet. */
    fresh: z.number().int().min(0).max(12).default(0),
    locale: z.enum(["en", "ar"]),
    reason: z.enum(contactReasons),
    name,
    phone,
    email: optionalEmail,
    area: optionalText(120),
    preferredContact: z.enum(["whatsapp", "call", "email"]),
    message: optionalText(1000),
    files: z
      .array(z.object({ id: z.string().min(1).max(40), ticket: z.string().min(1).max(100) }))
      .max(CHAT_MAX_FILES)
      .default([]),
    ...consent,
    ...spamTraps,
  })
  .refine((v) => v.preferredContact !== "email" || Boolean(v.email), {
    message: "emailForContact",
    path: ["email"],
  });
export type ChatContact = z.output<typeof chatContactSchema>;

export const chatEventSchema = z.discriminatedUnion("t", [
  /** The conversation's token: keep it and send it with every later message. */
  z.object({ t: z.literal("session"), v: chatSessionToken }),
  /** The assistant offers the contact form (the visitor agreed to share details). */
  z.object({ t: z.literal("form"), reason: z.enum(contactReasons) }),
  /** A piece of the reply, to append to what is shown. */
  z.object({ t: z.literal("text"), v: z.string() }),
  /** The reply is complete. */
  z.object({ t: z.literal("done") }),
  /** The reply stopped; show the error's message. */
  z.object({ t: z.literal("error"), code: z.enum(chatErrorCodes) }),
]);
export type ChatEvent = z.infer<typeof chatEventSchema>;

export function encodeChatEvent(event: ChatEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Reads an NDJSON reply stream and calls `onEvent` for each valid event, in order. Lines that are not
 * valid events are skipped. Returns how the reply ended: "done", an error code, or "server" when the
 * stream closed without saying.
 */
export async function readChatStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatEvent) => void,
): Promise<"done" | ChatErrorCode> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let ended: "done" | ChatErrorCode | null = null;

  const handle = (line: string) => {
    if (!line.trim()) return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return;
    }
    const parsed = chatEventSchema.safeParse(value);
    if (!parsed.success) return;
    onEvent(parsed.data);
    if (parsed.data.t === "done") ended = "done";
    if (parsed.data.t === "error") ended = parsed.data.code;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      handle(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
  handle(buffer + decoder.decode());
  return ended ?? "server";
}

/**
 * The assistant writes website pages as paths (/request-a-quote). Only this site's own pages become
 * links; anything else stays text, so a reply can never link a visitor somewhere unexpected.
 */
const sitePaths =
  /\/(?:ar\/)?(?:request-a-quote|book-a-consultation|showroom|contact|materials|faq|projects|designers|bespoke|kitchens\/wooden|kitchens\/aluminium|wardrobes|walk-in-closets|bedroom-furniture|tv-units|wall-cladding|bathroom-vanities)(?![\w/-])/g;

export function splitSitePaths(text: string): { text: string; path?: string }[] {
  const out: { text: string; path?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(sitePaths)) {
    const start = match.index;
    // Part of a longer URL or word (e.g. https://other.site/contact): leave it as text.
    if (start > 0 && /[\w.:/-]/.test(text[start - 1]!)) continue;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: match[0], path: match[0].replace(/^\/ar(?=\/)/, "") });
    last = start + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Maps a failed response's `{ error }` body to a known code. */
export function chatErrorFrom(body: unknown): ChatErrorCode {
  const code = (body as { error?: unknown } | null)?.error;
  return (chatErrorCodes as readonly unknown[]).includes(code) ? (code as ChatErrorCode) : "server";
}
