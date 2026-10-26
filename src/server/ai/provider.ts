import { z } from "zod";
import { env, type Env } from "@/server/env";

/**
 * The only place that talks to an AI provider (Anthropic's Messages API). Assistants never send
 * anything to customers: they return text that staff review (./drafts.ts). With no key set the
 * assistants are simply unavailable.
 */

export class AiError extends Error {
  constructor(
    public readonly code: "notConfigured" | "provider" | "unusable",
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface AiRequest {
  /** Names the job (lead_reply, lead_summary, blog_post, furniture); the mock provider answers per task. */
  task: "lead_reply" | "lead_summary" | "blog_post" | "furniture";
  system: string;
  user: string;
  maxTokens: number;
}

export type AiGenerate = (request: AiRequest) => Promise<{ text: string; model: string }>;

export function aiConfigured(e: Pick<Env, "ANTHROPIC_API_KEY" | "AI_PROVIDER"> = env()): boolean {
  return e.AI_PROVIDER === "mock" || Boolean(e.ANTHROPIC_API_KEY);
}

const mockAnswers: Record<AiRequest["task"], object> = {
  lead_reply: {
    language: "en",
    reply: "Thank you for your enquiry. We would like to confirm a few details before preparing a quotation.",
    questions: ["What are the wall measurements?", "Which board family do you prefer?"],
  },
  lead_summary: {
    summary: "The customer asks about a fitted kitchen.",
    missing: ["Measurements"],
    nextSteps: ["Call the customer", "Book a site visit"],
  },
  blog_post: {
    slug: "caring-for-painted-mdf",
    titleEn: "Caring for painted MDF",
    titleAr: "العناية بألواح MDF المطلية",
    excerptEn: "Simple steps to keep painted MDF doors looking good.",
    excerptAr: "خطوات بسيطة للحفاظ على مظهر أبواب MDF المطلية.",
    bodyEn: `Wipe painted MDF with a soft damp cloth.\n\n## Avoid\n\n- Abrasive cleaners\n- Standing water\n\n${"Dry the surface after cleaning. ".repeat(8)}`,
    bodyAr: `امسحوا السطح بقطعة قماش ناعمة ورطبة.\n\n## تجنبوا\n\n- المنظفات الخشنة\n- المياه الراكدة\n\n${"جففوا السطح بعد التنظيف. ".repeat(8)}`,
  },
  furniture: {
    answer: "A fitted kitchen in EGGER melamine or painted MDF suits this. Our team can confirm the details.",
    categories: ["woodenKitchens"],
    followUp: "What are the wall measurements?",
  },
};

/** Test provider: deterministic answers, or unusable text when the prompt contains BAD_OUTPUT. */
const mockGenerate: AiGenerate = async (request) => {
  if (request.user.includes("BAD_OUTPUT")) return { text: "I cannot help with that.", model: "mock" };
  return { text: JSON.stringify(mockAnswers[request.task]), model: "mock" };
};

const anthropicResponse = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});

export const aiGenerate: AiGenerate = async (request) => {
  const e = env();
  if (e.AI_PROVIDER === "mock") return mockGenerate(request);
  if (!e.ANTHROPIC_API_KEY) throw new AiError("notConfigured", "No AI provider key is set.");
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": e.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: e.AI_MODEL,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: [{ role: "user", content: request.user }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new AiError("provider", "The AI provider did not answer in time.");
  }
  // The response body is never logged or shown: it can echo the prompt.
  if (!res.ok) throw new AiError("provider", `The AI provider refused the request (${res.status}).`);
  const parsed = anthropicResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new AiError("unusable", "The AI provider answered in an unexpected format.");
  const text = parsed.data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  return { text, model: e.AI_MODEL };
};

/** Finds the JSON object in a model answer (it may be wrapped in a code fence) and validates it. */
export function parseAiJson<T extends z.ZodType>(text: string, schema: T): z.output<T> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start)
    throw new AiError("unusable", "The assistant did not return a usable draft.");
  let value: unknown;
  try {
    value = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AiError("unusable", "The assistant did not return a usable draft.");
  }
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AiError("unusable", "The assistant's draft did not have the expected parts.");
  return result.data;
}
