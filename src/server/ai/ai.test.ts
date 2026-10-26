import { describe, expect, it } from "vitest";
import { redactContact } from "./grounding";
import { AiError, aiConfigured, parseAiJson } from "./provider";
import { z } from "zod";

describe("what the AI provider is allowed to see", () => {
  it("removes contact lines, emails and phone numbers", () => {
    const text =
      "Name: Amal Test\nPhone: +973 3459 7636\nEmail: amal@example.com\n\nPlease call me on 34597636 or write to amal@example.com about a kitchen.";
    const clean = redactContact(text);
    expect(clean).not.toMatch(/Amal Test|3459|34597636|@example\.com/);
    expect(clean).toContain("kitchen");
  });
});

describe("assistant answers", () => {
  const schema = z.object({ reply: z.string().min(1) });
  it("accepts JSON, also inside a code fence", () => {
    expect(parseAiJson('```json\n{"reply":"Hello"}\n```', schema)).toEqual({ reply: "Hello" });
  });
  it("refuses text that is not the expected JSON", () => {
    expect(() => parseAiJson("I cannot help with that.", schema)).toThrow(AiError);
    expect(() => parseAiJson('{"other":1}', schema)).toThrow(AiError);
    expect(() => parseAiJson("{broken", schema)).toThrow(AiError);
  });
});

describe("provider availability", () => {
  it("needs a key (or the test provider)", () => {
    expect(aiConfigured({ ANTHROPIC_API_KEY: undefined, AI_PROVIDER: undefined })).toBe(false);
    expect(aiConfigured({ ANTHROPIC_API_KEY: "sk-ant-test-key-0123456789", AI_PROVIDER: undefined })).toBe(
      true,
    );
    expect(aiConfigured({ ANTHROPIC_API_KEY: undefined, AI_PROVIDER: "mock" })).toBe(true);
  });
});
