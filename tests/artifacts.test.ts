import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { buildArtifactSet } from "../src/pipeline/build-artifacts";
import type { NormalizedSnapshot } from "../src/contracts/artifacts";

const normalized = JSON.parse(
  readFileSync(new URL("./fixtures/normalized-snapshot.json", import.meta.url), "utf8")
) as NormalizedSnapshot;

describe("buildArtifactSet", () => {
  test("builds manifest and publish artifacts from normalized input", () => {
    const built = buildArtifactSet(normalized, {
      generatedAt: "2026-03-12T10:20:00.000Z",
      timezone: "Asia/Taipei"
    });

    expect(built.candidates.items).toHaveLength(2);
    expect(built.candidates.items[0]?.title).toBe("Introducing GPT-5.4");
    expect(built.dedupGroups.stats.duplicateItems).toBe(1);
    expect(built.digests[0]?.date).toBe("2026-03-11");
    expect(built.sourceHealth.summary.errored).toBe(1);
    expect(built.manifest.artifacts.some((artifact) => artifact.name === "candidates.json")).toBe(true);
    expect(built.validation.valid).toBe(true);
  });
});
