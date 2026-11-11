import { describe, expect, it, vi } from "vitest";
import type { Env } from "@/server/env";
import {
  fetchMetaMetrics,
  graphErrorText,
  MetaError,
  publishToFacebook,
  publishToInstagram,
  testMeta,
} from "./meta";

const e = {
  META_PAGE_ID: "1234567",
  META_PAGE_ACCESS_TOKEN: "page-token-that-is-long-enough",
  META_INSTAGRAM_ACCOUNT_ID: "7654321",
  META_GRAPH_VERSION: "v21.0",
} as unknown as Env;

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("Meta publishing", () => {
  it("posts a photo to the Page with the token in a header, never in the URL", async () => {
    const f = vi.fn(async () => reply({ id: "1", post_id: "1234567_99" }));
    const r = await publishToFacebook(e, { caption: "Hello", imageUrl: "https://files.example/a.jpg" }, f);
    expect(r).toEqual({ externalId: "1234567_99", permalink: "https://www.facebook.com/1234567_99" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/1234567/photos");
    expect(url).not.toContain("token");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer page-token-that-is-long-enough",
    );
    expect(new URLSearchParams(String(init.body)).get("caption")).toBe("Hello");
  });

  it("publishes to Instagram in two steps and reads the link", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply({ id: "555" }))
      .mockResolvedValueOnce(reply({ id: "777" }))
      .mockResolvedValueOnce(reply({ permalink: "https://www.instagram.com/p/abc/" }));
    const r = await publishToInstagram(
      e,
      { caption: "Hi", imageUrl: "https://files.example/a.jpg", mimeType: "image/jpeg", story: false },
      f,
    );
    expect(r).toEqual({ externalId: "777", permalink: "https://www.instagram.com/p/abc/" });
    expect(f.mock.calls[1]![0]).toBe("https://graph.facebook.com/v21.0/7654321/media_publish");
  });

  it("refuses non-JPEG photos for Instagram without calling Meta", async () => {
    const f = vi.fn();
    await expect(
      publishToInstagram(
        e,
        { caption: "", imageUrl: "https://x/a.png", mimeType: "image/png", story: false },
        f,
      ),
    ).rejects.toThrow(/JPEG/);
    expect(f).not.toHaveBeenCalled();
  });

  it("is not connected without the Page settings", async () => {
    const err = await publishToFacebook({ ...e, META_PAGE_ACCESS_TOKEN: undefined } as Env, {
      caption: "x",
      imageUrl: null,
    }).catch((x: unknown) => x);
    expect(err).toBeInstanceOf(MetaError);
    expect((err as MetaError).retry).toBe(false);
  });

  it("keeps Meta's errors short and without links; 4xx are not retried", async () => {
    expect(
      graphErrorText(400, {
        error: { code: 100, message: "Invalid image https://files.example/secret?sig=1 <b>" },
      }),
    ).toBe("Meta refused it (400 100): Invalid image [link] b");
    const f = vi.fn(async () => reply({ error: { code: 190, message: "Token expired" } }, 400));
    const err = await publishToFacebook(e, { caption: "x", imageUrl: null }, f).catch((x: unknown) => x);
    expect((err as MetaError).retry).toBe(false);
    const g = vi.fn(async () => reply({}, 503));
    const err2 = await publishToFacebook(e, { caption: "x", imageUrl: null }, g).catch((x: unknown) => x);
    expect((err2 as MetaError).retry).toBe(true);
  });

  it("reads likes, comments and shares", async () => {
    const f = vi.fn(async () =>
      reply({
        reactions: { summary: { total_count: 12 } },
        comments: { summary: { total_count: 3 } },
        shares: { count: 2 },
      }),
    );
    expect(await fetchMetaMetrics(e, "facebook", "1_2", f)).toEqual({ likes: 12, comments: 3, shares: 2 });
    const g = vi.fn(async () => reply({ like_count: 40, comments_count: 5 }));
    expect(await fetchMetaMetrics(e, "instagram", "9", g)).toEqual({ likes: 40, comments: 5, shares: null });
  });

  it("tests the connection read-only", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply({ name: "GIK" }))
      .mockResolvedValueOnce(reply({ username: "gik.bh" }));
    expect(await testMeta(e, f)).toBe("Token accepted; Facebook Page GIK and Instagram @gik.bh.");
    expect(
      f.mock.calls.every((c) => !(c[1] as RequestInit).method || (c[1] as RequestInit).method === "GET"),
    ).toBe(true);
  });
});
