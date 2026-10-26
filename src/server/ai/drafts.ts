import { z } from "zod";
import { company } from "@/config/company";
import type { Prisma } from "@/generated/prisma/client";
import { parseSetting, type Settings } from "@/lib/site-settings";
import { audit } from "@/server/audit";
import { assertCan, can, type Actor } from "@/server/auth/staff";
import type { Db } from "@/server/db/client";
import { saveBlogPost } from "@/server/admin/content";
import { categoryLabel } from "@/server/enquiries/submit";
import { NotFoundError, RuleError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { aiConfigured, aiGenerate, parseAiJson, type AiGenerate } from "./provider";
import { groundingFacts, hardRules, redactContact } from "./grounding";

/**
 * Assistants for staff. Every result is an AiDraft waiting for review: approving one files a note
 * on the lead or creates an unpublished blog post. Nothing is sent to a customer and nothing is
 * published by the assistant. Customer contact details are removed from what the provider sees.
 */

type Feature = "leadAssistant" | "contentAssistant" | "furnitureAssistant";

export async function aiSettings(db: Db): Promise<Settings["ai"]> {
  const row = await db.siteSetting.findUnique({ where: { key: "ai" } });
  return parseSetting("ai", row?.value);
}

/** True when the owner switched the feature on and a provider key is set on the server. */
export async function aiAvailable(db: Db, feature: Feature): Promise<boolean> {
  if (!aiConfigured()) return false;
  const s = await aiSettings(db);
  return s.enabled && s[feature];
}

export const leadReplySchema = z.object({
  language: z.enum(["en", "ar"]),
  reply: z.string().trim().min(1).max(1500),
  questions: z.array(z.string().trim().min(1).max(200)).max(5),
});
export const leadSummarySchema = z.object({
  summary: z.string().trim().min(1).max(800),
  missing: z.array(z.string().trim().min(1).max(200)).max(8),
  nextSteps: z.array(z.string().trim().min(1).max(200)).max(5),
});
export const blogDraftSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  titleEn: z.string().trim().min(3).max(120),
  titleAr: z.string().trim().min(3).max(120),
  excerptEn: z.string().trim().max(200),
  excerptAr: z.string().trim().max(200),
  bodyEn: z.string().trim().min(200).max(6000),
  bodyAr: z.string().trim().min(200).max(6000),
});

const schemaFor = {
  lead_reply: leadReplySchema,
  lead_summary: leadSummarySchema,
  blog_post: blogDraftSchema,
};

async function guard(db: Db, actor: Actor, feature: Feature) {
  assertCan(actor, "ai.use");
  if (!(await aiAvailable(db, feature))) throw new RuleError("aiOff", "The AI assistant is switched off.");
  if (!(await rateLimit(db, `ai:${actor.id}`, 30, 60 * 60))) throw new RuleError("tooMany");
}

/** One lead as the provider sees it: no phone, email or full name. */
async function leadContext(db: Db, leadId: string) {
  const lead = await db.lead.findFirst({
    where: { id: leadId, archivedAt: null },
    include: {
      customer: { select: { name: true, type: true } },
      activities: { where: { internal: false }, orderBy: { createdAt: "desc" }, take: 6 },
      quotationRequest: {
        select: { unit: true, measurements: true, preferredBoards: true, finishNotes: true },
      },
    },
  });
  if (!lead) throw new NotFoundError("Lead");
  const request = lead.quotationRequest;
  const text = [
    `Customer first name: ${lead.customer.name.split(/\s+/)[0]}`,
    `Customer type: ${lead.customer.type}`,
    `Enquiry: ${lead.category ? categoryLabel(lead.category) : "general"} (${lead.source.replace(/_/g, " ")})`,
    `Status: ${lead.status}`,
    `Preferred language: ${lead.locale === "ar" ? "Arabic" : "English"}`,
    request &&
      `Measurements given (${request.unit}): ${JSON.stringify(request.measurements)}; boards: ${request.preferredBoards.join(", ") || "not said"}${request.finishNotes ? `; notes: ${request.finishNotes}` : ""}`,
    "Messages from the customer, newest first:",
    ...lead.activities.map((a) => `- ${redactContact(a.body).slice(0, 600)}`),
  ]
    .filter(Boolean)
    .join("\n");
  return { lead, text };
}

const rewrap = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 300);

export async function requestLeadDraft(
  db: Db,
  actor: Actor,
  input: { leadId: string; kind: "lead_reply" | "lead_summary"; instruction?: string },
  generate: AiGenerate = aiGenerate,
) {
  assertCan(actor, "lead.read");
  await guard(db, actor, "leadAssistant");
  const { lead, text } = await leadContext(db, input.leadId);
  const instruction = input.instruction ? redactContact(rewrap(input.instruction)) : "";
  const reply = input.kind === "lead_reply";
  const { text: answer, model } = await generate({
    task: input.kind,
    maxTokens: 900,
    system: [
      `You help the sales team of ${company.legalName} in Bahrain.`,
      reply
        ? 'Draft a short, warm reply to the customer for the team to review before anything is sent. Answer in the customer\'s preferred language. Ask for missing details (measurements, board preference, area) instead of guessing. Reply with JSON only: {"language":"en"|"ar","reply":"...","questions":["..."]}.'
        : 'Summarise the enquiry for the team. Reply with JSON only: {"summary":"...","missing":["information still needed"],"nextSteps":["..."]}.',
      "Facts you may use:",
      groundingFacts(),
      "Rules:",
      hardRules,
    ].join("\n\n"),
    user: `${text}${instruction ? `\n\nStaff instruction: ${instruction}` : ""}`,
  });
  const output = parseAiJson(answer, schemaFor[input.kind]);
  return db.$transaction(async (tx) => {
    const draft = await tx.aiDraft.create({
      data: {
        kind: input.kind,
        leadId: lead.id,
        input: { instruction: instruction || null },
        output: output as Prisma.InputJsonValue,
        model,
        requestedById: actor.id,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "ai.draft_created",
      entityType: "ai_draft",
      entityId: draft.id,
      changes: { kind: input.kind, leadId: lead.id, model },
    });
    return draft;
  });
}

export async function requestBlogDraft(
  db: Db,
  actor: Actor,
  input: { topic: string; notes?: string },
  generate: AiGenerate = aiGenerate,
) {
  assertCan(actor, "content.manage");
  await guard(db, actor, "contentAssistant");
  const topic = rewrap(input.topic);
  if (topic.length < 5) throw new RuleError("topic", "Describe the topic in a few words.");
  const notes = input.notes ? redactContact(input.notes.slice(0, 1500)) : "";
  const { text: answer, model } = await generate({
    task: "blog_post",
    maxTokens: 3500,
    system: [
      `You draft blog posts for the website of ${company.legalName} in Bahrain.`,
      'Write a helpful, practical article in English and Arabic (natural Arabic, not a word-for-word copy). Plain text: paragraphs separated by blank lines, section headings on their own line starting with "## ", lists with "- ". Reply with JSON only: {"slug":"lowercase-words-with-hyphens","titleEn":"","titleAr":"","excerptEn":"","excerptAr":"","bodyEn":"","bodyAr":""}.',
      "Facts you may use:",
      groundingFacts(),
      "Rules:",
      hardRules,
    ].join("\n\n"),
    user: `Topic: ${topic}${notes ? `\n\nNotes from the team:\n${notes}` : ""}`,
  });
  const output = parseAiJson(answer, blogDraftSchema);
  return db.$transaction(async (tx) => {
    const draft = await tx.aiDraft.create({
      data: {
        kind: "blog_post",
        input: { topic, notes: notes || null },
        output: output as Prisma.InputJsonValue,
        model,
        requestedById: actor.id,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "ai.draft_created",
      entityType: "ai_draft",
      entityId: draft.id,
      changes: { kind: "blog_post", model },
    });
    return draft;
  });
}

export async function listDrafts(db: Db, actor: Actor, opts: { leadId?: string; pending?: boolean } = {}) {
  if (!can(actor, "ai.use") && !can(actor, "ai.review")) assertCan(actor, "ai.use");
  return db.aiDraft.findMany({
    where: { ...(opts.leadId && { leadId: opts.leadId }), ...(opts.pending && { status: "pending_review" }) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      lead: { select: { id: true, reference: true } },
      blogPost: { select: { id: true, slug: true } },
      requestedBy: { select: { name: true } },
      reviewedBy: { select: { name: true } },
    },
  });
}

/**
 * Approve (optionally with the reviewer's edits) or reject a draft. Approving files a note on the
 * lead (never sent) or creates an unpublished blog post; the usual publish rules still apply to it.
 */
export async function decideDraft(
  db: Db,
  actor: Actor,
  id: string,
  decision: "approved" | "rejected",
  opts: { output?: unknown; note?: string | null } = {},
) {
  assertCan(actor, "ai.review");
  const draft = await db.aiDraft.findUnique({ where: { id } });
  if (!draft) throw new NotFoundError("Draft");
  if (draft.status !== "pending_review") throw new RuleError("decided", "This draft was already reviewed.");
  const note = opts.note?.trim() || null;

  if (decision === "rejected") {
    await db.$transaction(async (tx) => {
      await tx.aiDraft.update({
        where: { id },
        data: { status: "rejected", reviewedById: actor.id, reviewedAt: new Date(), reviewNote: note },
      });
      await audit(tx, {
        actorId: actor.id,
        action: "ai.draft_rejected",
        entityType: "ai_draft",
        entityId: id,
        changes: { kind: draft.kind },
      });
    });
    return;
  }

  const output = schemaFor[draft.kind].parse(opts.output ?? draft.output);
  let blogPostId: string | null = null;
  if (draft.kind === "blog_post") {
    assertCan(actor, "content.manage");
    const post = output as z.output<typeof blogDraftSchema>;
    for (let attempt = 1; ; attempt++) {
      try {
        const saved = await saveBlogPost(db, actor, null, {
          slug: attempt === 1 ? post.slug : `${post.slug}-${attempt}`.slice(0, 80),
          titleEn: post.titleEn,
          titleAr: post.titleAr,
          excerptEn: post.excerptEn || null,
          excerptAr: post.excerptAr || null,
          bodyEn: post.bodyEn,
          bodyAr: post.bodyAr,
          coverFileId: null,
          published: false,
        });
        blogPostId = saved.id;
        break;
      } catch (error) {
        if (!(error instanceof RuleError && error.code === "slug") || attempt >= 5) throw error;
      }
    }
  } else {
    assertCan(actor, "lead.update");
  }

  await db.$transaction(async (tx) => {
    if (draft.kind === "lead_reply" && draft.leadId) {
      const reply = output as z.output<typeof leadReplySchema>;
      await tx.leadActivity.create({
        data: {
          leadId: draft.leadId,
          kind: "note",
          internal: true,
          authorId: actor.id,
          body: `Approved AI draft reply (not sent; copy it into your own message):\n\n${reply.reply}${reply.questions.length ? `\n\nQuestions to ask:\n${reply.questions.map((q) => `- ${q}`).join("\n")}` : ""}`,
        },
      });
    }
    if (draft.kind === "lead_summary" && draft.leadId) {
      const s = output as z.output<typeof leadSummarySchema>;
      await tx.leadActivity.create({
        data: {
          leadId: draft.leadId,
          kind: "note",
          internal: true,
          authorId: actor.id,
          body: `Approved AI summary:\n${s.summary}${s.missing.length ? `\n\nStill needed:\n${s.missing.map((m) => `- ${m}`).join("\n")}` : ""}${s.nextSteps.length ? `\n\nNext steps:\n${s.nextSteps.map((n) => `- ${n}`).join("\n")}` : ""}`,
        },
      });
    }
    await tx.aiDraft.update({
      where: { id },
      data: {
        status: "approved",
        output: output as Prisma.InputJsonValue,
        blogPostId,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "ai.draft_approved",
      entityType: "ai_draft",
      entityId: id,
      changes: { kind: draft.kind, edited: opts.output !== undefined, blogPostId },
    });
  });
  return { blogPostId };
}
