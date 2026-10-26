"use server";

import { looksLikeBot } from "@/lib/forms/common";
import { unsubscribe } from "@/server/consent";
import { db } from "@/server/db";
import { AiError } from "@/server/ai/provider";
import type { FurnitureAnswer } from "@/lib/furniture";
import { askFurnitureAssistant, MAX_QUESTION } from "@/server/ai/furniture";
import { RuleError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { clientIpHash } from "@/server/request";

export type AskResult = { ok: true; answer: FurnitureAnswer } | { ok: false; error: string };

export async function askFurnitureAction(input: {
  question: string;
  locale: string;
  website?: string;
  startedAt: number;
}): Promise<AskResult> {
  const locale = input.locale === "ar" ? "ar" : "en";
  if (typeof input.question !== "string" || input.question.length > MAX_QUESTION * 2)
    return { ok: false, error: "tooShort" };
  if (looksLikeBot({ website: input.website, startedAt: Number(input.startedAt) }))
    return { ok: false, error: "server" };
  try {
    const answer = await askFurnitureAssistant(db, {
      question: input.question,
      locale,
      ipHash: await clientIpHash(),
    });
    return { ok: true, answer };
  } catch (error) {
    if (error instanceof RuleError) return { ok: false, error: error.code };
    if (!(error instanceof AiError)) console.error("Furniture assistant failed", error);
    return { ok: false, error: "server" };
  }
}

export async function unsubscribeAction(token: string): Promise<{ ok: boolean }> {
  const ipHash = await clientIpHash();
  // Bounded so the link can't be used to flood the consent table.
  if (!(await rateLimit(db, `unsubscribe:${ipHash}`, 20, 60 * 60))) return { ok: false };
  try {
    await unsubscribe(db, String(token).slice(0, 300), ipHash);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
