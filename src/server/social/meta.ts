import type { Env } from "@/server/env";

/**
 * Meta Graph API (official) for the Facebook Page and the Instagram professional account linked to it.
 * Used only to publish posts a person approved, and to read their likes, comments and shares. The access
 * token stays on the server; Meta's error text is shortened and stripped of links before it is stored.
 */

type Fetch = typeof fetch;
const TIMEOUT = 20_000;

export class MetaError extends Error {
  constructor(
    message: string,
    /** false: retrying won't help (not connected, refused content). */
    public readonly retry = true,
  ) {
    super(message);
    this.name = "MetaError";
  }
}

export const metaReady = (e: Pick<Env, "META_PAGE_ID" | "META_PAGE_ACCESS_TOKEN">) =>
  Boolean(e.META_PAGE_ID && e.META_PAGE_ACCESS_TOKEN);
export const instagramReady = (
  e: Pick<Env, "META_PAGE_ID" | "META_PAGE_ACCESS_TOKEN" | "META_INSTAGRAM_ACCOUNT_ID">,
) => metaReady(e) && Boolean(e.META_INSTAGRAM_ACCOUNT_ID);

const graph = (e: Env, path: string) => `https://graph.facebook.com/${e.META_GRAPH_VERSION}/${path}`;

/** Meta's error, safe to show and store: code and a short message without links. */
export function graphErrorText(status: number, body: unknown): string {
  const err = (body as { error?: { message?: unknown; code?: unknown } } | null)?.error;
  const code = typeof err?.code === "number" ? ` ${err.code}` : "";
  const message =
    typeof err?.message === "string"
      ? err.message
          .replace(/https?:\/\/\S+/g, "[link]")
          .replace(/[^\p{L}\p{N}\s.,:;'()\-[\]#/]/gu, "")
          .slice(0, 200)
      : "";
  return `Meta refused it (${status}${code})${message ? `: ${message}` : "."}`;
}

async function request(
  f: Fetch,
  e: Env,
  path: string,
  init: { method?: "GET" | "POST"; form?: Record<string, string> } = {},
): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await f(graph(e, path), {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${e.META_PAGE_ACCESS_TOKEN}`,
        ...(init.form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      },
      body: init.form ? new URLSearchParams(init.form).toString() : undefined,
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch {
    throw new MetaError("Meta did not answer in time.");
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    // 4xx other than rate limits won't succeed by retrying the same request.
    throw new MetaError(graphErrorText(res.status, body), res.status >= 500 || res.status === 429);
  }
  return body ?? {};
}

const id = (v: unknown) => (typeof v === "string" && /^[\d_]{3,80}$/.test(v) ? v : null);

export interface Published {
  externalId: string;
  permalink: string | null;
}

/** A photo post (with the image's public URL) or a text post on the Facebook Page. */
export async function publishToFacebook(
  e: Env,
  input: { caption: string; imageUrl: string | null },
  f: Fetch = fetch,
): Promise<Published> {
  if (!metaReady(e))
    throw new MetaError("The Facebook Page isn't connected (Automation Centre → Integrations).", false);
  if (input.imageUrl) {
    const body = await request(f, e, `${e.META_PAGE_ID}/photos`, {
      method: "POST",
      form: { url: input.imageUrl, caption: input.caption, published: "true" },
    });
    const postId = id(body.post_id) ?? id(body.id);
    if (!postId) throw new MetaError("Meta answered without a post id.");
    return { externalId: postId, permalink: `https://www.facebook.com/${postId}` };
  }
  const body = await request(f, e, `${e.META_PAGE_ID}/feed`, {
    method: "POST",
    form: { message: input.caption },
  });
  const postId = id(body.id);
  if (!postId) throw new MetaError("Meta answered without a post id.");
  return { externalId: postId, permalink: `https://www.facebook.com/${postId}` };
}

/**
 * Instagram: create the media container from the image URL (Meta downloads it; JPEG only), then publish
 * it. A story uses the same two steps with media_type STORIES.
 */
export async function publishToInstagram(
  e: Env,
  input: { caption: string; imageUrl: string; mimeType: string; story: boolean },
  f: Fetch = fetch,
): Promise<Published> {
  if (!instagramReady(e))
    throw new MetaError("Instagram isn't connected (Automation Centre → Integrations).", false);
  if (input.mimeType !== "image/jpeg")
    throw new MetaError("Instagram only accepts JPEG photos. Choose a JPEG image.", false);
  const container = await request(f, e, `${e.META_INSTAGRAM_ACCOUNT_ID}/media`, {
    method: "POST",
    form: input.story
      ? { image_url: input.imageUrl, media_type: "STORIES" }
      : { image_url: input.imageUrl, caption: input.caption },
  });
  const creationId = id(container.id);
  if (!creationId) throw new MetaError("Meta answered without a media container id.");
  const published = await request(f, e, `${e.META_INSTAGRAM_ACCOUNT_ID}/media_publish`, {
    method: "POST",
    form: { creation_id: creationId },
  });
  const mediaId = id(published.id);
  if (!mediaId) throw new MetaError("Meta answered without a media id.");
  let permalink: string | null = null;
  try {
    const info = await request(f, e, `${mediaId}?fields=permalink`);
    permalink =
      typeof info.permalink === "string" && /^https:\/\/(www\.)?instagram\.com\//.test(info.permalink)
        ? info.permalink
        : null;
  } catch {
    // The post is published; the link is only a convenience.
  }
  return { externalId: mediaId, permalink };
}

export interface Metrics {
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

/** Likes (reactions on Facebook), comments and shares of one published post. */
export async function fetchMetaMetrics(
  e: Env,
  platform: "facebook" | "instagram",
  externalId: string,
  f: Fetch = fetch,
): Promise<Metrics> {
  if (platform === "facebook") {
    const b = await request(
      f,
      e,
      `${externalId}?fields=reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares`,
    );
    const summary = (k: string) =>
      count((b[k] as { summary?: { total_count?: unknown } } | undefined)?.summary?.total_count);
    return {
      likes: summary("reactions"),
      comments: summary("comments"),
      shares: count((b.shares as { count?: unknown } | undefined)?.count) ?? 0,
    };
  }
  const b = await request(f, e, `${externalId}?fields=like_count,comments_count`);
  return { likes: count(b.like_count), comments: count(b.comments_count), shares: null };
}

/** Read-only connection test for the Integrations screen. */
export async function testMeta(e: Env, f: Fetch): Promise<string> {
  const page = await request(f, e, `${e.META_PAGE_ID}?fields=name`);
  const name = typeof page.name === "string" ? page.name.slice(0, 80) : "found";
  if (!e.META_INSTAGRAM_ACCOUNT_ID)
    return `Token accepted; Facebook Page ${name}. Instagram account id not set.`;
  const ig = await request(f, e, `${e.META_INSTAGRAM_ACCOUNT_ID}?fields=username`);
  const user = typeof ig.username === "string" ? `@${ig.username.slice(0, 40)}` : "found";
  return `Token accepted; Facebook Page ${name} and Instagram ${user}.`;
}
