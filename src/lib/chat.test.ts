import { describe, expect, it } from "vitest";
import { quickReplies } from "@/content/chat";
import { products } from "@/content/products";
import {
  CHAT_MAX_MESSAGE,
  chatErrorFrom,
  chatRequestSchema,
  encodeChatEvent,
  readChatStream,
  splitSitePaths,
  type ChatEvent,
} from "./chat";
import { parseSetting, settingDefaults } from "./site-settings";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

describe("chat request schema", () => {
  const ok = { locale: "en", messages: [{ role: "user", text: "Hello" }] };

  it("accepts a conversation ending with the visitor", () => {
    expect(chatRequestSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects a conversation ending with the assistant", () => {
    const body = { ...ok, messages: [...ok.messages, { role: "assistant", text: "Hi" }] };
    expect(chatRequestSchema.safeParse(body).success).toBe(false);
  });

  it("rejects an over-long new message, empty messages and unknown roles or locales", () => {
    const long = { ...ok, messages: [{ role: "user", text: "a".repeat(CHAT_MAX_MESSAGE + 1) }] };
    expect(chatRequestSchema.safeParse(long).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...ok, messages: [] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ ...ok, messages: [{ role: "system", text: "x" }] }).success).toBe(
      false,
    );
    expect(chatRequestSchema.safeParse({ ...ok, locale: "fr" }).success).toBe(false);
  });

  it("rejects more than 30 messages", () => {
    const messages = Array.from({ length: 31 }, () => ({ role: "user", text: "hi" }));
    expect(chatRequestSchema.safeParse({ ...ok, messages }).success).toBe(false);
  });
});

describe("readChatStream", () => {
  it("reads events split across chunks and reports the end", async () => {
    const seen: ChatEvent[] = [];
    const wire = encodeChatEvent({ t: "text", v: "Hel" }) + encodeChatEvent({ t: "text", v: "lo" });
    const end = await readChatStream(
      streamOf(wire.slice(0, 7), wire.slice(7), encodeChatEvent({ t: "done" })),
      (e) => seen.push(e),
    );
    expect(end).toBe("done");
    expect(seen.filter((e) => e.t === "text").map((e) => (e.t === "text" ? e.v : ""))).toEqual(["Hel", "lo"]);
  });

  it("handles Arabic text split inside a character", async () => {
    const bytes = new TextEncoder().encode(encodeChatEvent({ t: "text", v: "مرحبا" }));
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, 13));
        c.enqueue(bytes.slice(13));
        c.close();
      },
    });
    let text = "";
    await readChatStream(stream, (e) => {
      if (e.t === "text") text += e.v;
    });
    expect(text).toBe("مرحبا");
  });

  it("skips invalid lines, returns an error code, and treats a silent close as a server error", async () => {
    expect(await readChatStream(streamOf("not json\n", '{"t":"error","code":"tooMany"}\n'), () => {})).toBe(
      "tooMany",
    );
    expect(await readChatStream(streamOf(encodeChatEvent({ t: "text", v: "x" })), () => {})).toBe("server");
  });
});

describe("splitSitePaths", () => {
  it("links this site's pages only", () => {
    expect(splitSitePaths("Use /request-a-quote or call us.")).toEqual([
      { text: "Use " },
      { text: "/request-a-quote", path: "/request-a-quote" },
      { text: " or call us." },
    ]);
    expect(splitSitePaths("See /ar/kitchens/wooden.")).toEqual([
      { text: "See " },
      { text: "/ar/kitchens/wooden", path: "/kitchens/wooden" },
      { text: "." },
    ]);
  });

  it("leaves other sites, unknown paths and longer paths as text", () => {
    for (const text of [
      "https://evil.example/contact",
      "www.other.com/showroom",
      "/admin",
      "/contact-us",
      "/request-a-quote/../admin",
    ])
      expect(splitSitePaths(text).every((p) => !p.path)).toBe(true);
  });
});

describe("chat errors and settings", () => {
  it("maps unknown error bodies to server", () => {
    expect(chatErrorFrom({ error: "aiOff" })).toBe("aiOff");
    expect(chatErrorFrom({ error: "boom" })).toBe("server");
    expect(chatErrorFrom(null)).toBe("server");
  });

  it("keeps the sales chat off by default, on Sonnet, and fills in fields saved before they existed", () => {
    expect(settingDefaults.chatAgent.enabled).toBe(false);
    expect(settingDefaults.chatAgent.model).toBe("claude-sonnet-5-5");
    expect(parseSetting("chatAgent", { enabled: true })).toEqual({
      ...settingDefaults.chatAgent,
      enabled: true,
    });
    // An unknown model or a silly limit is not accepted: the defaults are used.
    expect(parseSetting("chatAgent", { enabled: true, model: "gpt-x" })).toEqual(settingDefaults.chatAgent);
    expect(parseSetting("chatAgent", { enabled: true, dailyMessageLimit: 0 }).enabled).toBe(false);
  });

  it("offers the owner's quick options and links each product option to a real product", () => {
    expect(quickReplies.map((q) => q.label.en)).toEqual([
      "Wooden Kitchens",
      "Aluminium Kitchens",
      "Wardrobes",
      "Bedroom Furniture",
      "TV Units",
      "Request a Quotation",
      "Book a Showroom Visit",
      "Talk to Our Sales Team",
    ]);
    for (const q of quickReplies)
      if (q.kind === "product") expect(products.some((p) => p.key === q.key)).toBe(true);
  });
});
