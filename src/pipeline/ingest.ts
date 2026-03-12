import { readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

import Parser from "rss-parser";

import type { NormalizedSnapshot } from "../contracts/artifacts";
import { loadSourceRegistry } from "./config";
import {
  getSourceState,
  insertRun,
  openControlDb,
  recordFetchAttempt,
  updateRun,
  upsertSources
} from "./control-db";
import { writeJsonlGz } from "./files";
import { canonicalizeUrl, normalizeTimestamp, sha256Hex } from "./normalize";

function formatRunId(nowIso: string): string {
  return `run_${nowIso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
}

function rawSnapshotPath(rawDir: string, sourceId: string, runId: string, nowIso: string): string {
  const [year, month, day] = nowIso.slice(0, 10).split("-");
  return join(rawDir, year, month, day, sourceId, `${runId}.jsonl.gz`);
}

export async function runIngest(options: {
  configPath: string;
  dbPath: string;
  rawDir: string;
  nowIso?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ runId: string; rawSnapshots: string[]; configHash: string }> {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const runId = formatRunId(nowIso);
  const registry = loadSourceRegistry(options.configPath);
  const enabledSources = registry.sources.filter(
    (source) => source.enabled !== false && source.fetchPolicy !== "manual" && source.feedUrl.trim().length > 0
  );
  const configHash = sha256Hex(readFileSync(options.configPath));
  const fetchImpl = options.fetchImpl ?? fetch;
  const parser = new Parser();
  const db = openControlDb(options.dbPath);

  upsertSources(db, registry.sources);
  insertRun(db, {
    runId,
    startedAt: nowIso,
    finishedAt: null,
    configHash,
    status: "running",
    sourceCount: enabledSources.length,
    fetchedSources: 0,
    errorCount: 0,
    rawSnapshotCount: 0
  });

  const rawSnapshots: string[] = [];
  let fetchedSources = 0;
  let errorCount = 0;

  for (const source of enabledSources) {
    const startedAt = nowIso;
    const sourceState = getSourceState(db, source.id);
    const headers = new Headers();
    if (sourceState?.etag) headers.set("if-none-match", sourceState.etag);
    if (sourceState?.last_modified) headers.set("if-modified-since", sourceState.last_modified);

    try {
      const response = await fetchImpl(source.feedUrl, {
        headers
      });
      const finishedAt = new Date().toISOString();
      const body = response.status === 304 ? "" : await response.text();
      let entriesParsed = 0;
      let snapshotPath: string | null = null;

      if (response.ok && response.status !== 304) {
        const feed = await parser.parseString(body);
        const rows = (feed.items ?? []).map((item) => {
          const canonicalUrl = canonicalizeUrl(item.link ?? item.guid ?? "");
          const fingerprintBase = `${source.id}|${item.guid ?? canonicalUrl ?? item.title ?? ""}|${item.pubDate ?? ""}`;
          entriesParsed += 1;
          return {
            runId,
            fetchedAt: finishedAt,
            source: {
              id: source.id,
              name: source.name,
              siteUrl: source.siteUrl,
              feedUrl: source.feedUrl,
              category: source.category,
              tier: source.tier ?? null,
              priority: source.priority ?? null,
              sourceType: source.sourceType ?? null,
              fetchPolicy: source.fetchPolicy ?? null
            },
            entry: {
              entryUid: String(item.guid ?? canonicalUrl ?? sha256Hex(fingerprintBase)),
              guid: item.guid ?? null,
              url: item.link ?? null,
              canonicalUrl,
              title: item.title ?? "(untitled)",
              snippetRaw: item.contentSnippet ?? item.content ?? item.summary ?? "",
              publishedAt: normalizeTimestamp(item.isoDate ?? item.pubDate ?? null),
              updatedAt: normalizeTimestamp((item as { updated?: string }).updated ?? null),
              author: item.creator ?? item.author ?? null,
              fingerprintHint: sha256Hex(fingerprintBase),
              raw: item
            }
          };
        });

        snapshotPath = rawSnapshotPath(options.rawDir, source.id, runId, nowIso);
        writeJsonlGz(snapshotPath, rows);
        rawSnapshots.push(snapshotPath);
      }

      recordFetchAttempt(db, {
        runId,
        sourceId: source.id,
        startedAt,
        finishedAt,
        ok: response.ok,
        statusCode: response.status,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        bytes: Buffer.byteLength(body, "utf8"),
        entriesParsed,
        error: response.ok ? null : `HTTP ${response.status}`,
        snapshotPath: snapshotPath ? relative(process.cwd(), snapshotPath) : null
      });
      fetchedSources += 1;
      if (!response.ok) errorCount += 1;
    } catch (error) {
      const finishedAt = new Date().toISOString();
      errorCount += 1;
      recordFetchAttempt(db, {
        runId,
        sourceId: source.id,
        startedAt,
        finishedAt,
        ok: false,
        statusCode: null,
        etag: null,
        lastModified: null,
        bytes: 0,
        entriesParsed: 0,
        error: error instanceof Error ? error.message : String(error),
        snapshotPath: null
      });
    }
  }

  updateRun(db, runId, {
    finishedAt: new Date().toISOString(),
    status: errorCount > 0 && fetchedSources === 0 ? "failed" : "completed",
    fetchedSources,
    errorCount,
    rawSnapshotCount: rawSnapshots.length
  });

  return {
    runId,
    rawSnapshots: rawSnapshots.map((snapshot) => relative(process.cwd(), snapshot)),
    configHash
  };
}
