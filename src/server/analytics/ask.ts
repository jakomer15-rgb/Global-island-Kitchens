import { z } from "zod";
import { periodKeys, periodNames, type PeriodKey } from "@/lib/analytics";
import { bahrainDay } from "@/lib/social";
import { aiAvailable } from "@/server/ai/drafts";
import { aiGenerate, parseAiJson, type AiGenerate } from "@/server/ai/provider";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import type { Db } from "@/server/db/client";
import { RuleError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { queryCatalogue, queryNames, runQuery, type QueryName } from "./queries";

/**
 * Management questions ("Which channel brought the most leads this week?"). The AI never counts anything
 * and never sees the database: (1) it chooses up to four queries from a fixed catalogue; (2) the server
 * runs them; (3) the AI answers from those results only and says so when they don't answer the question.
 * The question, queries, results and answer are kept, and the page shows the figures used.
 */

export const questionInput = z.object({
  question: z.string().trim().min(3, "Ask a question (at least 3 characters).").max(500),
});

const planSchema = z.object({
  queries: z
    .array(
      z.object({
        name: z.enum(queryNames as [QueryName, ...QueryName[]]),
        period: z.enum(periodKeys).optional(),
      }),
    )
    .max(4)
    .default([]),
  /** Set when no query can answer it (e.g. it asks about something the system doesn't record). */
  cannotAnswer: z.string().max(300).optional(),
});

const answerSchema = z.object({ answer: z.string().trim().min(1).max(3000) });

const catalogueText = () =>
  queryNames
    .map(
      (n) =>
        `- ${n}${queryCatalogue[n].period ? " (needs a period)" : " (no period: right now)"}: ${queryCatalogue[n].about}`,
    )
    .join("\n");

export async function askAnalytics(
  db: Db,
  actor: Actor,
  input: z.input<typeof questionInput>,
  generate: AiGenerate = aiGenerate,
  now = new Date(),
) {
  assertCan(actor, "analytics.read");
  assertCan(actor, "ai.use");
  const { question } = questionInput.parse(input);
  if (!(await aiAvailable(db, "leadAssistant")))
    throw new RuleError("aiOff", "The AI assistant is switched off.");
  if (!(await rateLimit(db, `ai:${actor.id}`, 30, 60 * 60)))
    throw new RuleError("tooMany", "Too many AI requests in the last hour. Please try again later.");

  const today = bahrainDay(now);
  const plan = parseAiJson(
    (
      await generate({
        task: "analytics_plan",
        maxTokens: 400,
        system: [
          "You help the management of Global Island Kitchens (Bahrain) get figures from their business system.",
          `Today is ${today} (Bahrain). Weeks start on Saturday.`,
          "Choose the queries (at most four) whose results answer the question. Periods: " +
            periodKeys.map((k) => `${k} (${periodNames[k]})`).join(", ") +
            ". If the question names no period, use this_week.",
          "Queries:",
          catalogueText(),
          'Reply with JSON only: {"queries":[{"name":"summary","period":"this_week"}]} or, if none can answer it, {"queries":[],"cannotAnswer":"why"}.',
        ].join("\n\n"),
        user: question,
      })
    ).text,
    planSchema,
  );

  const queries = plan.queries.map((q) => ({
    name: q.name,
    period: queryCatalogue[q.name].period ? ((q.period ?? "this_week") as PeriodKey) : undefined,
  }));
  const results: unknown[] = [];
  for (const q of queries) results.push(await runQuery(db, q.name, q.period, now));

  let answer: string;
  let model = "none";
  if (!queries.length) {
    answer = `The system doesn't record what this question needs, so I can't answer it from the figures.${plan.cannotAnswer ? ` (${plan.cannotAnswer.trim()})` : ""}`;
  } else {
    const out = await generate({
      task: "analytics_answer",
      maxTokens: 900,
      system: [
        "You answer management questions for Global Island Kitchens from the query results given, and nothing else.",
        "Rules: use only numbers that appear in the results; never estimate, extrapolate or invent figures; name the period (with its dates) you are reporting; if the results don't answer the question, say which figures are available instead; be brief (2–6 sentences or a short list); refer to leads and quotations by their reference numbers; plain text, no markdown tables.",
        'Reply with JSON only: {"answer":"..."}.',
      ].join("\n\n"),
      user: `Question: ${question}\n\nQuery results (JSON):\n${JSON.stringify(results).slice(0, 30000)}`,
    });
    answer = parseAiJson(out.text, answerSchema).answer;
    model = out.model;
  }

  return db.$transaction(async (tx) => {
    const row = await tx.analyticsQuestion.create({
      data: {
        question,
        queries,
        results: JSON.parse(JSON.stringify(results)),
        answer,
        model,
        askedById: actor.id,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "analytics.question",
      entityType: "analytics_question",
      entityId: row.id,
      changes: { queries: queries.map((q) => q.name) },
    });
    return row;
  });
}

export async function recentQuestions(db: Db, actor: Actor, limit = 20) {
  assertCan(actor, "analytics.read");
  return db.analyticsQuestion.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { askedBy: { select: { name: true } } },
  });
}

export const exampleQuestions = [
  "How many new customers contacted us this week?",
  "Which marketing channel generated the most leads this month?",
  "Which customers need follow-up?",
  "How many quotations are awaiting approval?",
  "Which products receive the most inquiries?",
  "Which campaigns generate the best results?",
];
