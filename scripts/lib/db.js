const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function openDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

function getUserVersion(db) {
  return db.prepare("PRAGMA user_version;").get().user_version;
}

function setUserVersion(db, v) {
  db.exec(`PRAGMA user_version = ${Number(v)};`);
}

function migrateDb(db) {
  let v = getUserVersion(db);

  if (v < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ingestion_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        config_hash TEXT,
        sources_count INTEGER NOT NULL DEFAULT 0,
        entries_seen INTEGER NOT NULL DEFAULT 0,
        entries_new INTEGER NOT NULL DEFAULT 0,
        errors_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        site_url TEXT,
        feed_url TEXT NOT NULL,
        category TEXT,
        notes TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        etag TEXT,
        last_modified TEXT,
        last_fetch_at TEXT,
        last_fetch_status INTEGER,
        last_fetch_error TEXT
      );

      CREATE TABLE IF NOT EXISTS feed_fetches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,
        source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        ok INTEGER NOT NULL,
        status_code INTEGER,
        etag TEXT,
        last_modified TEXT,
        bytes INTEGER,
        entries_parsed INTEGER NOT NULL DEFAULT 0,
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS feed_entries_raw (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
        entry_uid TEXT NOT NULL,
        guid TEXT,
        url_raw TEXT,
        url_canonical TEXT,
        title_raw TEXT,
        title_norm TEXT,
        snippet_raw TEXT,
        snippet_norm TEXT,
        published_at TEXT,
        updated_at TEXT,
        author TEXT,
        fingerprint TEXT NOT NULL,
        content_hash TEXT,
        raw_json TEXT,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        UNIQUE(source_id, entry_uid)
      );

      CREATE INDEX IF NOT EXISTS idx_feed_entries_raw_published
      ON feed_entries_raw (published_at);

      CREATE INDEX IF NOT EXISTS idx_feed_entries_raw_last_seen
      ON feed_entries_raw (last_seen_at);
    `);

    setUserVersion(db, 1);
    v = 1;
  }

  if (v < 2) {
    // Add source policy/tiering metadata. These are optional and default to null.
    // Guard each ALTER TABLE so re-runs or schema drift don't hard-fail.
    const existingCols = new Set(
      db
        .prepare("PRAGMA table_info(sources);")
        .all()
        .map((r) => String(r.name))
    );

    if (!existingCols.has("tier")) db.exec("ALTER TABLE sources ADD COLUMN tier TEXT;");
    if (!existingCols.has("priority")) db.exec("ALTER TABLE sources ADD COLUMN priority INTEGER;");
    if (!existingCols.has("source_type")) db.exec("ALTER TABLE sources ADD COLUMN source_type TEXT;");
    if (!existingCols.has("fetch_policy")) db.exec("ALTER TABLE sources ADD COLUMN fetch_policy TEXT;");

    setUserVersion(db, 2);
    v = 2;
  }

  return v;
}

module.exports = {
  openDb,
  migrateDb
};
