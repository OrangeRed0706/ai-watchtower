import { mkdtempSync, readFileSync } from "node:fs";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "vitest";

import { runIngest } from "../src/pipeline/ingest";
import { runNormalize } from "../src/pipeline/run-normalize";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("pipeline integration", () => {
  test("ingest writes raw snapshots and normalize produces canonical snapshot", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "watchtower-"));
    tempDirs.push(cwd);

    const configPath = join(cwd, "sources.json");
    const dbPath = join(cwd, "watchtower.sqlite");
    const rawDir = join(cwd, "data", "raw");
    const normalizedDir = join(cwd, "data", "normalized");
    const feedXml = readFileSync(new URL("./fixtures/sample-feed.xml", import.meta.url), "utf8");

    await import("node:fs/promises").then((fs) =>
      fs.writeFile(
        configPath,
        JSON.stringify(
          {
            version: 1,
            sources: [
              {
                id: "openai-blog",
                name: "OpenAI Blog",
                siteUrl: "https://openai.com/blog",
                feedUrl: "https://openai.com/blog/rss.xml",
                category: "Model / Product",
                tier: "official",
                priority: 95,
                sourceType: "vendor_blog",
                fetchPolicy: "feed",
                enabled: true
              }
            ]
          },
          null,
          2
        )
      )
    );

    const ingest = await runIngest({
      configPath,
      dbPath,
      rawDir,
      nowIso: "2026-03-12T10:15:00.000Z",
      fetchImpl: async () =>
        new Response(feedXml, {
          status: 200,
          headers: {
            "content-type": "application/rss+xml",
            etag: '"fixture-etag"',
            "last-modified": "Thu, 12 Mar 2026 10:15:00 GMT"
          }
        })
    });

    const normalized = await runNormalize({
      configPath,
      dbPath,
      rawDir,
      normalizedDir,
      runId: ingest.runId,
      nowIso: "2026-03-12T10:20:00.000Z",
      timezone: "Asia/Taipei"
    });

    expect(ingest.rawSnapshots).toHaveLength(1);
    expect(normalized.items).toHaveLength(2);
    expect(normalized.items[0]?.url).not.toContain("utm_source");
    expect(normalized.sources[0]?.lastFetch?.snapshotPath).toContain("data/raw/2026/03/12/openai-blog");
  });
});
