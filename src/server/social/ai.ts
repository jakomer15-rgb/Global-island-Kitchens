import { z } from "zod";
import { company } from "@/config/company";
import {
  bahrainDateTime,
  calendarDays,
  languageNames,
  normaliseHashtags,
  platformNames,
  postTypeNames,
  socialPlatforms,
  socialPostTypes,
  type SocialLanguageKey,
} from "@/lib/social";
import { aiAvailable } from "@/server/ai/drafts";
import { groundingFacts, hardRules } from "@/server/ai/grounding";
import { aiGenerate, parseAiJson, type AiGenerate } from "@/server/ai/provider";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import type { Db } from "@/server/db/client";
import { NotFoundError, RuleError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { usableImages } from "./posts";

/**
 * The AI side of the social media agent: it drafts captions, hashtags, scripts and image briefs, suggests
 * project photos from the published portfolio, and proposes a week's or month's content plan. Everything
 * it writes is a draft that staff edit and an approver approves; it never publishes.
 */

const socialRules = [
  "Write for Global Island Kitchens' own Instagram, Facebook and LinkedIn: confident, warm, specific, never pushy. No emojis beyond one or two where natural.",
  "Arabic: clear Modern Standard Arabic suited to the Gulf, written naturally (not a word-for-word translation).",
  "Describe a project only with the details given for its photo. Never invent projects, clients, locations, measurements, reviews or awards.",
  "Never mention prices, discounts, offers, deadlines, delivery or installation times, or warranties.",
  "Invite people to visit the showroom, send their measurements on the website, or message the team.",
].join("\n");

async function readyForAi(db: Db, actor: Actor) {
  assertCan(actor, "social.manage");
  assertCan(actor, "ai.use");
  if (!(await aiAvailable(db, "contentAssistant")))
    throw new RuleError("aiOff", "The AI assistant is switched off.");
  if (!(await rateLimit(db, `ai:${actor.id}`, 30, 60 * 60)))
    throw new RuleError("tooMany", "Too many AI requests in the last hour. Please try again later.");
}

const aiPost = z.object({
  captionEn: z.string().trim().max(2000).default(""),
  captionAr: z.string().trim().max(2000).default(""),
  hashtags: z.array(z.string()).max(40).default([]),
  imageBrief: z.string().trim().max(2000).default(""),
  script: z.string().trim().max(5000).default(""),
  photoIds: z.array(z.string()).max(10).default([]),
});

/** Drafts the post's text from its title and brief, and suggests up to three photos. Draft posts only. */
export async function writePostWithAi(db: Db, actor: Actor, id: string, generate: AiGenerate = aiGenerate) {
  await readyForAi(db, actor);
  const post = await db.socialPost.findUnique({ where: { id }, include: { campaign: true } });
  if (!post) throw new NotFoundError("Post");
  if (post.status !== "draft")
    throw new RuleError("notDraft", "Only a draft can be changed. Send it back to draft first.");
  const photos = (await usableImages(db, 60)).filter((p) => p.project);
  const lang = post.language as SocialLanguageKey;
  const { text } = await generate({
    task: "social_post",
    maxTokens: 2000,
    system: [
      `You draft social media posts for ${company.legalName}. A person edits and approves every post before it is published.`,
      `Post type: ${postTypeNames[post.type]}. Platforms: ${post.platforms.map((p) => platformNames[p]).join(", ")}. Captions needed: ${languageNames[lang]}.`,
      'Reply with JSON only: {"captionEn":"...","captionAr":"...","hashtags":["..."],"imageBrief":"...","script":"...","photoIds":["..."]}.',
      "Captions: 60–150 words each, no hashtags inside them. Leave a caption empty if that language isn't needed.",
      "Hashtags: 8–15, without #, mixing English and Arabic, relevant to Bahrain and the post.",
      "imageBrief: what the promotional image should show and how (format, framing, text on it), for a designer or Canva.",
      post.type === "reel"
        ? "script: a 20–40 second reel script with numbered shots and the words on screen."
        : "script: leave empty.",
      photos.length
        ? "photoIds: up to three ids from the photo list that suit the post, best first; empty if none suit it."
        : "photoIds: empty (no photos are available).",
      "Facts you may use:",
      groundingFacts(),
      "Rules:",
      hardRules,
      socialRules,
    ].join("\n\n"),
    user: [
      `Post: ${post.title}`,
      post.brief ? `Brief from the team: ${post.brief}` : null,
      post.campaign
        ? `Campaign: ${post.campaign.name}${post.campaign.objective ? ` — ${post.campaign.objective}` : ""}`
        : null,
      photos.length
        ? `Photos (id — project, location, scope — description):\n${photos
            .map(
              (p) =>
                `${p.id} — ${p.project!.name}, ${p.project!.location}, ${p.project!.scope} — ${p.project!.alt}`,
            )
            .join("\n")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 12000),
  });
  const draft = parseAiJson(text, aiPost);
  const known = new Set(photos.map((p) => p.id));
  const suggested = [...new Set(draft.photoIds.filter((pid) => known.has(pid)))].slice(0, 3);
  const data = {
    captionEn: lang === "ar" ? post.captionEn : draft.captionEn || null,
    captionAr: lang === "en" ? post.captionAr : draft.captionAr || null,
    hashtags: normaliseHashtags(draft.hashtags),
    imageBrief: draft.imageBrief || null,
    script: post.type === "reel" ? draft.script || null : post.script,
    suggestedImageIds: suggested,
  };
  await db.$transaction(async (tx) => {
    await tx.socialPost.update({ where: { id }, data });
    await audit(tx, {
      actorId: actor.id,
      action: "social_post.ai_written",
      entityType: "social_post",
      entityId: id,
    });
  });
  return { suggested: suggested.length };
}

export const planInput = z.object({
  view: z.enum(["week", "month"]),
  /** Any day in the week or month to plan. */
  anchorDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the week or month."),
  postsPerWeek: z.number().int().min(1).max(7),
  platforms: z.array(z.enum(socialPlatforms)).min(1, "Choose at least one platform."),
  language: z.enum(["en", "ar", "both"]),
  focus: z.string().trim().max(1000).optional(),
  campaignId: z.string().optional(),
});

const aiPlan = z.object({
  ideas: z
    .array(
      z.object({
        dayOffset: z.number().int().min(0).max(41),
        time: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .optional(),
        title: z.string().trim().min(2).max(160),
        brief: z.string().trim().max(1000).default(""),
        type: z.enum(socialPostTypes).default("image"),
        platforms: z.array(z.enum(socialPlatforms)).default([]),
      }),
    )
    .max(40),
});

/**
 * Proposes a content plan for a week or month and adds each idea to the calendar as a draft (title, brief,
 * day, type, platforms). Captions are written per post afterwards.
 */
export async function planContentWithAi(
  db: Db,
  actor: Actor,
  input: z.input<typeof planInput>,
  generate: AiGenerate = aiGenerate,
  now = new Date(),
) {
  const p = planInput.parse(input);
  await readyForAi(db, actor);
  const campaign = p.campaignId ? await db.socialCampaign.findUnique({ where: { id: p.campaignId } }) : null;
  if (p.campaignId && !campaign) throw new RuleError("campaignId", "Unknown campaign.");
  const { days } = calendarDays(p.view, p.anchorDay);
  // A month view includes days of the neighbouring months: plan only the month itself.
  const planDays = p.view === "month" ? days.filter((d) => d.startsWith(p.anchorDay.slice(0, 7))) : days;
  const max = Math.ceil((planDays.length / 7) * p.postsPerWeek);
  const { text } = await generate({
    task: "social_plan",
    maxTokens: 3000,
    system: [
      `You plan social media content for ${company.legalName}. Each idea becomes a draft that the team writes, checks and approves.`,
      `Plan ${max} posts over ${planDays.length} days (dayOffset 0 = ${planDays[0]}, up to ${planDays.length - 1}), about ${p.postsPerWeek} per week, spread out, at times people in Bahrain are online (HH:MM, Bahrain time).`,
      `Platforms to use: ${p.platforms.map((x) => platformNames[x]).join(", ")}. Types: image, text, reel, story. Mix project showcases, materials and finishes (EGGER décors, painted MDF), the factory and craft, design tips and showroom invitations.`,
      'Reply with JSON only: {"ideas":[{"dayOffset":0,"time":"19:00","title":"...","brief":"...","type":"image","platforms":["instagram"]}]}. Titles in English; briefs say what to show and the angle.',
      "Facts you may use:",
      groundingFacts(),
      "Rules:",
      hardRules,
      socialRules,
    ].join("\n\n"),
    user: [
      p.focus ? `Focus from the team: ${p.focus}` : "No particular focus: a balanced plan.",
      campaign ? `Campaign: ${campaign.name}${campaign.objective ? ` — ${campaign.objective}` : ""}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  const plan = parseAiJson(text, aiPlan);
  const ideas = plan.ideas
    .filter((i) => i.dayOffset < planDays.length)
    .slice(0, max)
    .map((i) => {
      const platforms = i.platforms.filter((x) => p.platforms.includes(x));
      return {
        ...i,
        platforms: platforms.length ? platforms : p.platforms,
        at: bahrainDateTime(planDays[i.dayOffset]!, i.time ?? "19:00")!,
      };
    })
    .filter((i) => i.at > now);
  if (!ideas.length)
    throw new RuleError(
      "noIdeas",
      "The plan had no usable ideas for future days. Try again or choose a later period.",
    );
  await db.$transaction(async (tx) => {
    await tx.socialPost.createMany({
      data: ideas.map((i) => ({
        title: i.title,
        brief: i.brief || null,
        type: i.type,
        platforms: i.platforms,
        language: p.language,
        plannedAt: i.at,
        campaignId: campaign?.id ?? null,
        createdById: actor.id,
      })),
    });
    await audit(tx, {
      actorId: actor.id,
      action: "social_post.planned_with_ai",
      entityType: "social_post",
      entityId: campaign?.id ?? "plan",
      changes: { view: p.view, anchorDay: p.anchorDay, drafts: ideas.length },
    });
  });
  return { created: ideas.length };
}
