import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { NormalizedItem, NormalizedSnapshot, SourceRecord } from "../contracts/artifacts";
import { loadSourceRegistry } from "./config";
import { listSourceStates, openControlDb } from "./control-db";
import { listFilesRecursive, readJsonlGz, writeJson } from "./files";
import {
  canonicalizeUrl,
  normalizeSnippet,
  normalizeTimestamp,
  normalizeTitle,
  sha256Hex
} from "./normalize";

interface RawSnapshotRow {
  runId: string;
  fetchedAt: string;
  source: {
    id: string;
    name: string;
    siteUrl: string;
    feedUrl: string;
    category: string;
    tier: string | null;
    priority: number | null;
    sourceType: string | null;
    fetchPolicy: string | null;
  };
  entry: {
    entryUid: string;
    guid: string | null;
    url: string | null;
    canonicalUrl: string | null;
    title: string;
    snippetRaw: string;
    publishedAt: string | null;
    updatedAt: string | null;
    author: string | null;
    fingerprintHint: string;
  };
}

function buildNormalizedItem(row: RawSnapshotRow): NormalizedItem {
  const url = canonicalizeUrl(row.entry.canonicalUrl ?? row.entry.url);
  const title = normalizeTitle(row.entry.title);
  const snippet = normalizeSnippet(row.entry.snippetRaw);
  const publishedAt = normalizeTimestamp(row.entry.publishedAt);
  const updatedAt = normalizeTimestamp(row.entry.updatedAt);
  const contentHash = sha256Hex(`${title}|${snippet}`);
  const fingerprint = sha256Hex(
    `${row.source.id}|${row.entry.entryUid}|${url ?? ""}|${publishedAt ?? ""}|${row.entry.fingerprintHint}`
  );

  return {
    runId: row.runId,
    sourceId: row.source.id,
    sourceName: row.source.name,
    sourceUrl: row.source.siteUrl,
    sourcePriority: row.source.priority,
    sourceTier: (row.source.tier as NormalizedItem["sourceTier"]) ?? null,
    sourceType: row.source.sourceType,
    category: row.source.category,
    entryUid: row.entry.entryUid,
    guid: row.entry.guid,
    url,
    title,
    snippet,
    publishedAt,
    updatedAt,
    author: row.entry.author,
    fingerprint,
    contentHash,
    firstSeenAt: row.fetchedAt,
    lastSeenAt: row.fetchedAt
  };
}

function mergeItem(existing: NormalizedItem, incoming: NormalizedItem): NormalizedItem {
  const keepLatest = Date.parse(incoming.lastSeenAt) >= Date.parse(existing.lastSeenAt);
  return {
    ...(keepLatest ? incoming : existing),
    firstSeenAt:
      Date.parse(existing.firstSeenAt) <= Date.parse(incoming.firstSeenAt)
        ? existing.firstSeenAt
        : incoming.firstSeenAt,
    lastSeenAt:
      Date.parse(existing.lastSeenAt) >= Date.parse(incoming.lastSeenAt)
        ? existing.lastSeenAt
        : incoming.lastSeenAt
  };
}

function buildSources(configPath: string, dbPath: string): SourceRecord[] {
  const registry = loadSourceRegistry(configPath);
  const db = openControlDb(dbPath);
  const states = new Map(listSourceStates(db).map((state) => [state.id, state]));

  return registry.sources.map((source) => {
    const state = states.get(source.id);
    return {
      id: source.id,
      name: source.name,
      siteUrl: source.siteUrl,
      feedUrl: source.feedUrl,
      category: source.category,
      tier: source.tier ?? null,
      priority: source.priority ?? null,
      sourceType: source.sourceType ?? null,
      fetchPolicy: source.fetchPolicy ?? null,
      enabled: source.enabled !== false,
      lastFetch: state?.last_fetch_at
        ? {
            ok: (state.last_fetch_status ?? 500) < 400,
            status: state.last_fetch_status,
            at: state.last_fetch_at,
            error: state.last_fetch_error ?? undefined,
            snapshotPath: state.last_snapshot_path ?? undefined
          }
        : undefined
    };
  });
}

export async function runNormalize(options: {
  configPath: string;
  dbPath: string;
  rawDir: string;
  normalizedDir: string;
  runId: string;
  nowIso?: string;
  timezone: string;
}): Promise<NormalizedSnapshot> {
  const generatedAt = options.nowIso ?? new Date().toISOString();
  const rows = listFilesRecursive(options.rawDir)
    .filter((filePath) => filePath.endsWith(".jsonl.gz"))
    .flatMap((filePath) => readJsonlGz<RawSnapshotRow>(filePath));

  const byEntry = new Map<string, NormalizedItem>();
  for (const row of rows) {
    const normalized = buildNormalizedItem(row);
    const key = `${normalized.sourceId}|${normalized.entryUid}`;
    const existing = byEntry.get(key);
    byEntry.set(key, existing ? mergeItem(existing, normalized) : normalized);
  }

  const items = Array.from(byEntry.values()).sort((left, right) =>
    String(right.publishedAt || right.lastSeenAt).localeCompare(String(left.publishedAt || left.lastSeenAt))
  );
  const snapshot: NormalizedSnapshot = {
    schemaVersion: 1,
    runId: options.runId,
    generatedAt,
    configHash: sha256Hex(readFileSync(options.configPath)),
    window: {
      start: rows.map((row) => row.fetchedAt).sort()[0] ?? generatedAt,
      end: generatedAt,
      timezone: options.timezone
    },
    sources: buildSources(options.configPath, options.dbPath),
    items
  };

  writeJson(join(options.normalizedDir, `${options.runId}.json`), snapshot);
  writeJson(join(options.normalizedDir, "latest.json"), snapshot);
  return snapshot;
}
