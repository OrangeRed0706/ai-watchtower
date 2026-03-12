import { describe, expect, test } from "vitest";

import { classifyItem } from "../src/pipeline/classify";
import { scoreItem } from "../src/pipeline/scoring";

describe("scoring and classification", () => {
  test("scoreItem prioritizes official recent model releases", () => {
    const scored = scoreItem(
      {
        title: "Introducing GPT-5.4",
        url: "https://openai.com/index/introducing-gpt-5-4",
        publishedAt: "2026-03-05T10:00:00.000Z",
        sourcePriority: 95,
        sourceTier: "official",
        category: "Model / Product"
      },
      { nowIso: "2026-03-12T10:15:00.000Z" }
    );

    expect(scored.score).toBeGreaterThanOrEqual(100);
    expect(scored.reasons.some((reason) => reason.key === "title:announce")).toBe(true);
  });

  test("classifyItem upgrades security items to high impact", () => {
    const classified = classifyItem({
      title: "Secret scanning pattern updates - March 2026",
      url: "https://github.blog/changelog/2026-03-10-secret-scanning-pattern-updates",
      snippet: "Security detection improvements for repositories.",
      score: 110,
      category: "Tooling",
      sourceType: "changelog"
    });

    expect(classified.impactArea).toBe("security");
    expect(classified.impactLevel).toBe("high");
    expect(classified.tags).toContain("security");
  });
});
