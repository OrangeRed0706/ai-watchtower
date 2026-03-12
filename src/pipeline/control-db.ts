import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";

import type { SourceConfig } from "./config";

export interface RunRecord {
  runId: string;
  startedAt: string;
  finishedAt: string | null;
  configHash: string;
  status: "running" | "completed" | "failed";
  sourceCount: number;
  fetchedSources: number;
  errorCount: number;
  rawSnapshotCount: number;
}

export interface SourceStateRow {
  id: string;
  name: string;
  site_url: string;
  feed_url: string;
  category: string;
  tier: string | null;
  priority: number | null;
  source_type: string | null;
  fetch_policy: string | null;
  enabled: number;
  etag: string | null;
  last_modified: string | null;
  last_fetch_at: string | null;
  last_fetch_status: number | null;
  last_fetch_error: string | null;
  last_snapshot_path: string | null;
}

export function openControlDb(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      site_url TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      category TEXT NOT NULL,
      tier TEXT,
      priority INTEGER,
      source_type TEXT,
      fetch_policy TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      etag TEXT,
      last_modified TEXT,
      last_fetch_at TEXT,
      last_fetch_status INTEGER,
      last_fetch_error TEXT,
      last_snapshot_path TEXT
    );

    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      config_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      source_count INTEGER NOT NULL,
      fetched_sources INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      raw_snapshot_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS fetch_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      ok INTEGER NOT NULL,
      status_code INTEGER,
      etag TEXT,
      last_modified TEXT,
      bytes INTEGER,
      entries_parsed INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      snapshot_path TEXT
    );
  `);
  ensureSourceColumns(db);
  return db;
}

function ensureSourceColumns(db: Database.Database): void {
  const columns = new Set(
    (db.prepare("PRAGMA table_info(sources)").all() as Array<{ name: string }>).map((row) => row.name)
  );
  const statements: string[] = [];
  if (!columns.has("tier")) statements.push("ALTER TABLE sources ADD COLUMN tier TEXT");
  if (!columns.has("priority")) statements.push("ALTER TABLE sources ADD COLUMN priority INTEGER");
  if (!columns.has("source_type")) statements.push("ALTER TABLE sources ADD COLUMN source_type TEXT");
  if (!columns.has("fetch_policy")) statements.push("ALTER TABLE sources ADD COLUMN fetch_policy TEXT");
  if (!columns.has("last_snapshot_path")) statements.push("ALTER TABLE sources ADD COLUMN last_snapshot_path TEXT");

  for (const statement of statements) {
    db.exec(statement);
  }
}

export function upsertSources(db: Database.Database, sources: SourceConfig[]): void {
  const statement = db.prepare(`
    INSERT INTO sources (
      id, name, site_url, feed_url, category, tier, priority, source_type, fetch_policy, enabled
    ) VALUES (
      @id, @name, @site_url, @feed_url, @category, @tier, @priority, @source_type, @fetch_policy, @enabled
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      site_url = excluded.site_url,
      feed_url = excluded.feed_url,
      category = excluded.category,
      tier = excluded.tier,
      priority = excluded.priority,
      source_type = excluded.source_type,
      fetch_policy = excluded.fetch_policy,
      enabled = excluded.enabled
  `);

  const insertMany = db.transaction((rows: SourceConfig[]) => {
    for (const source of rows) {
      statement.run({
        id: source.id,
        name: source.name,
        site_url: source.siteUrl,
        feed_url: source.feedUrl,
        category: source.category ?? "",
        tier: source.tier ?? null,
        priority: source.priority ?? null,
        source_type: source.sourceType ?? null,
        fetch_policy: source.fetchPolicy ?? null,
        enabled: source.enabled === false ? 0 : 1
      });
    }
  });

  insertMany(sources);
}

export function getSourceState(db: Database.Database, sourceId: string): SourceStateRow | undefined {
  return db.prepare("SELECT * FROM sources WHERE id = ?").get(sourceId) as SourceStateRow | undefined;
}

export function listSourceStates(db: Database.Database): SourceStateRow[] {
  return db.prepare("SELECT * FROM sources ORDER BY id ASC").all() as SourceStateRow[];
}

export function insertRun(db: Database.Database, run: RunRecord): void {
  db.prepare(`
    INSERT INTO runs (
      run_id, started_at, finished_at, config_hash, status, source_count, fetched_sources, error_count, raw_snapshot_count
    ) VALUES (
      @runId, @startedAt, @finishedAt, @configHash, @status, @sourceCount, @fetchedSources, @errorCount, @rawSnapshotCount
    )
  `).run(run);
}

export function updateRun(
  db: Database.Database,
  runId: string,
  patch: Partial<Pick<RunRecord, "finishedAt" | "status" | "fetchedSources" | "errorCount" | "rawSnapshotCount">>
): void {
  db.prepare(`
    UPDATE runs
    SET finished_at = COALESCE(@finishedAt, finished_at),
        status = COALESCE(@status, status),
        fetched_sources = COALESCE(@fetchedSources, fetched_sources),
        error_count = COALESCE(@errorCount, error_count),
        raw_snapshot_count = COALESCE(@rawSnapshotCount, raw_snapshot_count)
    WHERE run_id = @runId
  `).run({
    runId,
    finishedAt: patch.finishedAt ?? null,
    status: patch.status ?? null,
    fetchedSources: patch.fetchedSources ?? null,
    errorCount: patch.errorCount ?? null,
    rawSnapshotCount: patch.rawSnapshotCount ?? null
  });
}

export function recordFetchAttempt(
  db: Database.Database,
  input: {
    runId: string;
    sourceId: string;
    startedAt: string;
    finishedAt: string;
    ok: boolean;
    statusCode: number | null;
    etag: string | null;
    lastModified: string | null;
    bytes: number;
    entriesParsed: number;
    error: string | null;
    snapshotPath: string | null;
  }
): void {
  db.prepare(`
    INSERT INTO fetch_attempts (
      run_id, source_id, started_at, finished_at, ok, status_code, etag, last_modified, bytes, entries_parsed, error, snapshot_path
    ) VALUES (
      @runId, @sourceId, @startedAt, @finishedAt, @ok, @statusCode, @etag, @lastModified, @bytes, @entriesParsed, @error, @snapshotPath
    )
  `).run({
    ...input,
    ok: input.ok ? 1 : 0
  });

  db.prepare(`
    UPDATE sources
    SET etag = COALESCE(@etag, etag),
        last_modified = COALESCE(@lastModified, last_modified),
        last_fetch_at = @finishedAt,
        last_fetch_status = @statusCode,
        last_fetch_error = @error,
        last_snapshot_path = COALESCE(@snapshotPath, last_snapshot_path)
    WHERE id = @sourceId
  `).run(input);
}

export function getLatestRunId(db: Database.Database): string | null {
  const row = db
    .prepare("SELECT run_id FROM runs ORDER BY started_at DESC LIMIT 1")
    .get() as { run_id?: string } | undefined;
  return row?.run_id ?? null;
}
