import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { contactReasons, type ContactReason } from "@/lib/chat";
import type { ChatModel } from "@/lib/site-settings";
import { env } from "@/server/env";

/**
 * The only place the sales chat talks to the AI provider (Anthropic's Messages API, streamed). The
 * key stays on the server. Callers get plain text pieces, a request to show the contact form, and how
 * the reply ended.
 */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string | { type: "text"; text: string }[];
}

export interface ChatCall {
  model: ChatModel;
  system: string;
  messages: ChatTurn[];
  signal: AbortSignal;
}

export type ChatPart =
  | { type: "text"; text: string }
  /** The assistant asks the window to show the contact form (after the visitor agreed). */
  | { type: "form"; reason: ContactReason }
  /** done: finished; declined: the model's safety checks refused; truncated: hit the length limit. */
  | { type: "end"; reason: "done" | "declined" | "truncated"; usage?: ChatUsage };

export interface ChatUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export type ChatModelFn = (call: ChatCall) => AsyncIterable<ChatPart>;

/** Room for the model's (short, low-effort) thinking plus a chat-length reply. */
const MAX_TOKENS = 3000;

export const SHOW_CONTACT_FORM = "show_contact_form";

/**
 * The assistant's only tool. It doesn't collect anything itself: the window shows a form the visitor
 * fills in, and those details go straight to the CRM, never to the AI provider.
 */
const contactFormTool = {
  name: SHOW_CONTACT_FORM,
  description:
    "Shows the visitor a short form inside the chat where they can leave their name, phone or WhatsApp number, optional email, area and reference photos or drawings, so the sales team can contact them. Call it only after the visitor has agreed to share their contact details for a quotation, a callback, a showroom visit or to speak with a person. Say one short sentence before calling it. Never ask for the details in the chat itself.",
  strict: true,
  input_schema: {
    type: "object" as const,
    properties: {
      reason: {
        type: "string",
        enum: [...contactReasons],
        description: "What the visitor wants the team to do.",
      },
    },
    required: ["reason"],
    additionalProperties: false,
  },
};

const toolInput = z.object({ reason: z.enum(contactReasons) });

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, maxRetries: 1, timeout: 60_000 });
  return client;
}

export const claudeChat: ChatModelFn = async function* (call) {
  const stream = anthropic().beta.messages.stream(
    {
      model: call.model,
      max_tokens: MAX_TOKENS,
      // Instructions + knowledge are the same for every visitor: cache them (the tool comes first in
      // the prompt and never changes either).
      system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
      tools: [contactFormTool],
      messages: call.messages,
      // Chat: answer quickly; the model thinks briefly only when a question needs it.
      output_config: { effort: "low" },
      // If a safety check wrongly declines (e.g. a cyber false positive), the API retries on
      // Anthropic's recommended fallback model. Haiku has no server-side fallback.
      ...(call.model === "claude-haiku-5-5"
        ? {}
        : { fallbacks: "default" as const, betas: ["server-side-fallback-2026-07-01"] }),
    },
    { signal: call.signal },
  );

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text)
      yield { type: "text", text: event.delta.text };
  }
  const final = await stream.finalMessage();
  const usage: ChatUsage = {
    model: final.model,
    inputTokens: final.usage.input_tokens,
    outputTokens: final.usage.output_tokens,
    cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: final.usage.cache_creation_input_tokens ?? 0,
  };
  if (final.stop_reason === "refusal") {
    yield { type: "end", reason: "declined", usage };
    return;
  }
  // The reply ends at the tool call: the window shows the form and the visitor takes it from there.
  if (final.stop_reason === "tool_use") {
    const call = final.content.find((b) => b.type === "tool_use" && b.name === SHOW_CONTACT_FORM);
    const parsed = call && "input" in call ? toolInput.safeParse(call.input) : null;
    yield { type: "form", reason: parsed?.success ? parsed.data.reason : "callback" };
  }
  yield { type: "end", reason: final.stop_reason === "max_tokens" ? "truncated" : "done", usage };
};

const mockText = {
  en: "Thank you for your question. This is a test reply from the chat's test mode: in the live assistant, Claude answers here using only Global Island Kitchens' approved information, and our team confirms prices and dates.",
  ar: "شكرًا لسؤالكم. هذا رد تجريبي من وضع الاختبار: في المساعد الفعلي يجيب Claude هنا باستخدام معلومات Global Island Kitchens المعتمدة فقط، ويؤكد فريقنا الأسعار والمواعيد.",
};

/**
 * Test provider (AI_PROVIDER=mock): the same words every time, a few at a time. A message containing
 * CONTACT_ME ends with the contact form; DECLINE_ME ends declined.
 */
export const mockChat: ChatModelFn = async function* (call) {
  const last = call.messages.at(-1);
  const text =
    typeof last?.content === "string" ? last.content : (last?.content.map((b) => b.text).join(" ") ?? "");
  const words = mockText[text.includes("page language Arabic") ? "ar" : "en"].split(/(?<= )/);
  await new Promise((r) => setTimeout(r, 400));
  for (let i = 0; i < words.length; i += 3) {
    if (call.signal.aborted) return;
    yield { type: "text", text: words.slice(i, i + 3).join("") };
    await new Promise((r) => setTimeout(r, 30));
  }
  if (text.includes("CONTACT_ME")) yield { type: "form", reason: "quotation" };
  yield {
    type: "end",
    reason: text.includes("DECLINE_ME") ? "declined" : "done",
    usage: { model: "mock", inputTokens: 10, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 },
  };
};
