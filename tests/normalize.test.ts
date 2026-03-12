import { describe, expect, test } from "vitest";

import { canonicalizeUrl, normalizeSnippet, normalizeTimestamp } from "../src/pipeline/normalize";

describe("normalize utilities", () => {
  test("canonicalizeUrl removes tracking params and fragments", () => {
    expect(
      canonicalizeUrl("https://OpenAI.com/blog/post/?utm_source=x&b=2&a=1#section")
    ).toBe("https://openai.com/blog/post?a=1&b=2");
  });

  test("normalizeSnippet strips html and truncates deterministically", () => {
    expect(normalizeSnippet("<p>Hello <strong>world</strong></p>", { maxLen: 32 })).toBe(
      "Hello world"
    );
  });

  test("normalizeTimestamp returns null for invalid inputs", () => {
    expect(normalizeTimestamp("not-a-date")).toBeNull();
  });
});
