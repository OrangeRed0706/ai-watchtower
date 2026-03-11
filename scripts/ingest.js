#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");

let Parser;
try {
  // eslint-disable-next-line global-require
  Parser = require("rss-parser");
} catch (e) {
  console.error("Missing dependency: rss-parser");
  console.error("Install deps (requires npm registry access): npm install");
  process.exit(2);
}

const { openDb, migrateDb } = require("./lib/db");
const {
  canonicalizeUrl,
  normalizeSnippet,
  normalizeTimestamp,
  normalizeTitle,
  sha256Hex
} = require("./lib/normalize");

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), "config", "sources.json");
const DEFAULT_DB_PATH = path.join(process.cwd(), ".data", "watchtower.sqlite");
const DEFAULT_EXPORT_PATH = path.join(process.cwd(), "src", "_data", "ingested.json");

function nowIso() {
  return new Date().toISOString();
}

function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function configHashFromFileBytes(filePath) {
  return sha256Hex(fs.readFileSync(filePath));
}

function toIntBool(v) {
  return v ? 1 : 0;
}

async function fetchWithTimeout(url, { timeoutMs, headers }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      headers,
      redirect: "follow",
      signal: controller.signal
    });
    const durationMs = Date.now() - startedAt;
    return { res, durationMs };
  } finally {
    clearTimeout(timeout);
  }
}

function pickEntryUid({ guid, urlCanonical, fingerprint }) {
  if (guid && String(guid).trim()) return String(guid).trim();
  if (urlCanonical && String(urlCanonical).trim()) return String(urlCanonical).trim();
  return fingerprint;
}

function extractTextCandidate(item) {
  // rss-parser commonly provides: contentSnippet, content, summary
  return item?.contentSnippet || item?.content || item?.summary || "";
}

async function main() {
  const { values } = parseArgs({
    options: {
      config: { type: "string", default: DEFAULT_CONFIG_PATH },
      db: { type: "string", default: DEFAULT_DB_PATH },
      export: { type: "string", default: DEFAULT_EXPORT_PATH },
      timeoutMs: { type: "string", default: "15000" },
      perFeedLimit: { type: "string", default: "200" },
      maxItems: { type: "string", default: "250" }
    }
  });

  const configPath = path.resolve(values.config);
  const dbPath = path.resolve(values.db);
  const exportPath = path.resolve(values.export);
  const timeoutMs = Math.max(1, Number(values.timeoutMs) || 15000);
  const perFeedLimit = Math.max(1, Number(values.perFeedLimit) || 200);
  const maxItems = Math.max(1, Number(values.maxItems) || 250);

  if (!fs.existsSync(configPath)) {
    console.error(`Missing config: ${configPath}`);
    process.exit(2);
  }

  const config = readJson(configPath);
  const sources = Array.isArray(config?.sources) ? config.sources : [];
  const enabledSources = sources.filter((s) => s && s.enabled !== false);
  if (enabledSources.length === 0) {
    console.error("No enabled sources in config.");
    process.exit(2);
  }

  ensureDirForFile(dbPath);
  ensureDirForFile(exportPath);

  const db = openDb(dbPath);
  migrateDb(db);

  const startedAt = nowIso();
  const cfgHash = configHashFromFileBytes(configPath);
  const runId = db
    .prepare(
      `INSERT INTO ingestion_runs (started_at, config_hash, sources_count)
       VALUES (?, ?, ?)
       RETURNING id`
    )
    .get(startedAt, cfgHash, enabledSources.length).id;

  const upsertSourceStmt = db.prepare(
    `INSERT INTO sources (id, name, site_url, feed_url, category, notes, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       site_url=excluded.site_url,
       feed_url=excluded.feed_url,
       category=excluded.category,
       notes=excluded.notes,
       enabled=excluded.enabled`
  );

  for (const s of enabledSources) {
    upsertSourceStmt.run(
      s.id,
      s.name || s.id,
      s.siteUrl || s.url || null,
      s.feedUrl,
      s.category || null,
      s.notes || null,
      toIntBool(s.enabled !== false)
    );
  }

  const getSourceStateStmt = db.prepare(
    `SELECT id, feed_url, etag, last_modified
     FROM sources
     WHERE id = ?`
  );

  const insertFetchStmt = db.prepare(
    `INSERT INTO feed_fetches
     (run_id, source_id, started_at, finished_at, ok, status_code, etag, last_modified, bytes, entries_parsed, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const updateSourceFetchStateStmt = db.prepare(
    `UPDATE sources
     SET etag = COALESCE(?, etag),
         last_modified = COALESCE(?, last_modified),
         last_fetch_at = ?,
         last_fetch_status = ?,
         last_fetch_error = ?
     WHERE id = ?`
  );

  const insertEntryStmt = db.prepare(
    `INSERT OR IGNORE INTO feed_entries_raw
     (source_id, entry_uid, guid, url_raw, url_canonical, title_raw, title_norm,
      snippet_raw, snippet_norm, published_at, updated_at, author,
      fingerprint, content_hash, raw_json, first_seen_at, last_seen_at)
     VALUES
     (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const updateEntryStmt = db.prepare(
    `UPDATE feed_entries_raw
     SET guid = COALESCE(?, guid),
         url_raw = COALESCE(?, url_raw),
         url_canonical = COALESCE(?, url_canonical),
         title_raw = COALESCE(?, title_raw),
         title_norm = COALESCE(?, title_norm),
         snippet_raw = COALESCE(?, snippet_raw),
         snippet_norm = COALESCE(?, snippet_norm),
         published_at = COALESCE(?, published_at),
         updated_at = COALESCE(?, updated_at),
         author = COALESCE(?, author),
         fingerprint = ?,
         content_hash = ?,
         raw_json = COALESCE(?, raw_json),
         last_seen_at = ?
     WHERE source_id = ? AND entry_uid = ?`
  );

  const parser = new Parser({
    // Some feeds reject unknown user agents; keep it explicit.
    headers: { "User-Agent": "ai-watchtower/phase1 (+https://github.com)" }
  });

  let totalParsed = 0;
  let totalNew = 0;
  let totalErrors = 0;

  for (const s of enabledSources) {
    const sourceRow = getSourceStateStmt.get(s.id);
    const feedUrl = sourceRow?.feed_url || s.feedUrl;

    const fetchStartedAt = nowIso();
    let fetchFinishedAt = fetchStartedAt;
    let ok = false;
    let statusCode = null;
    let etag = null;
    let lastModified = null;
    let bytes = null;
    let entriesParsed = 0;
    let error = null;

    try {
      const headers = {};
      if (sourceRow?.etag) headers["If-None-Match"] = sourceRow.etag;
      if (sourceRow?.last_modified) headers["If-Modified-Since"] = sourceRow.last_modified;

      const { res } = await fetchWithTimeout(feedUrl, { timeoutMs, headers });
      statusCode = res.status;
      etag = res.headers.get("etag");
      lastModified = res.headers.get("last-modified");
      fetchFinishedAt = nowIso();

      if (res.status === 304) {
        ok = true;
        entriesParsed = 0;
      } else if (!res.ok) {
        ok = false;
        error = `HTTP ${res.status}`;
      } else {
        const text = await res.text();
        bytes = Buffer.byteLength(text, "utf8");
        const feed = await parser.parseString(text);
        const items = Array.isArray(feed?.items) ? feed.items.slice(0, perFeedLimit) : [];

        for (const item of items) {
          const titleRaw = item?.title || "";
          const urlRaw = item?.link || item?.id || "";
          const urlCanonical = canonicalizeUrl(urlRaw);
          const guid = item?.guid || item?.id || null;
          const publishedAt = normalizeTimestamp(item?.isoDate || item?.pubDate || item?.published);
          const updatedAt = normalizeTimestamp(item?.updated || item?.lastBuildDate);
          const titleNorm = normalizeTitle(titleRaw);

          const snippetRaw = extractTextCandidate(item);
          const snippetNorm = normalizeSnippet(snippetRaw);

          const fingerprint = sha256Hex(
            [
              String(s.id),
              String(guid || ""),
              String(urlCanonical || ""),
              String(titleNorm || ""),
              String(publishedAt || "")
            ].join("|")
          );

          const contentHash = sha256Hex([String(titleNorm || ""), String(snippetNorm || "")].join("\n"));
          const entryUid = pickEntryUid({ guid, urlCanonical, fingerprint });

          const rawJson = JSON.stringify(
            {
              title: item?.title,
              link: item?.link,
              guid: item?.guid,
              id: item?.id,
              pubDate: item?.pubDate,
              isoDate: item?.isoDate,
              author: item?.creator || item?.author,
              categories: item?.categories,
              content: item?.content,
              contentSnippet: item?.contentSnippet
            },
            null,
            0
          );

          const seenAt = nowIso();
          const insertResult = insertEntryStmt.run(
            s.id,
            entryUid,
            guid,
            urlRaw || null,
            urlCanonical || null,
            titleRaw || null,
            titleNorm || null,
            snippetRaw || null,
            snippetNorm || null,
            publishedAt,
            updatedAt,
            item?.creator || item?.author || null,
            fingerprint,
            contentHash,
            rawJson,
            seenAt,
            seenAt
          );

          entriesParsed += 1;
          totalParsed += 1;

          if (insertResult.changes === 1) {
            totalNew += 1;
          } else {
            updateEntryStmt.run(
              guid,
              urlRaw || null,
              urlCanonical || null,
              titleRaw || null,
              titleNorm || null,
              snippetRaw || null,
              snippetNorm || null,
              publishedAt,
              updatedAt,
              item?.creator || item?.author || null,
              fingerprint,
              contentHash,
              rawJson,
              seenAt,
              s.id,
              entryUid
            );
          }
        }

        ok = true;
      }
    } catch (e) {
      fetchFinishedAt = nowIso();
      ok = false;
      error = e?.name === "AbortError" ? `Timeout after ${timeoutMs}ms` : String(e?.message || e);
    }

    if (!ok) totalErrors += 1;

    insertFetchStmt.run(
      runId,
      s.id,
      fetchStartedAt,
      fetchFinishedAt,
      toIntBool(ok),
      statusCode,
      etag,
      lastModified,
      bytes,
      entriesParsed,
      error
    );

    updateSourceFetchStateStmt.run(
      etag,
      lastModified,
      fetchFinishedAt,
      statusCode,
      error,
      s.id
    );
  }

  const finishedAt = nowIso();
  db.prepare(
    `UPDATE ingestion_runs
     SET finished_at = ?,
         entries_seen = ?,
         entries_new = ?,
         errors_count = ?
     WHERE id = ?`
  ).run(finishedAt, totalParsed, totalNew, totalErrors, runId);

  const latestItems = db
    .prepare(
      `SELECT
         e.source_id AS sourceId,
         s.name AS sourceName,
         s.site_url AS sourceUrl,
         s.feed_url AS feedUrl,
         s.category AS category,
         s.notes AS notes,
         e.title_raw AS title,
         e.snippet_norm AS snippet,
         e.url_canonical AS url,
         e.published_at AS publishedAt,
         e.updated_at AS updatedAt,
         e.fingerprint AS fingerprint
       FROM feed_entries_raw e
       JOIN sources s ON s.id = e.source_id
       WHERE s.enabled = 1
       ORDER BY COALESCE(e.published_at, e.last_seen_at) DESC
       LIMIT ?`
    )
    .all(maxItems);

  const sourcesForExport = db
    .prepare(
      `SELECT
         id,
         name,
         site_url AS siteUrl,
         feed_url AS feedUrl,
         category,
         notes,
         last_fetch_at AS lastFetchAt,
         last_fetch_status AS lastFetchStatus,
         last_fetch_error AS lastFetchError
       FROM sources
       WHERE enabled = 1
       ORDER BY name ASC`
    )
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      siteUrl: row.siteUrl,
      feedUrl: row.feedUrl,
      category: row.category,
      notes: row.notes,
      lastFetch: {
        at: row.lastFetchAt,
        status: row.lastFetchStatus,
        ok: row.lastFetchStatus && Number(row.lastFetchStatus) >= 200 && Number(row.lastFetchStatus) < 400,
        error: row.lastFetchError
      }
    }));

  const exportObj = {
    schemaVersion: 1,
    generatedAt: finishedAt,
    run: {
      id: runId,
      startedAt,
      finishedAt,
      configHash: cfgHash,
      sourcesCount: enabledSources.length,
      entriesSeen: totalParsed,
      entriesNew: totalNew,
      sourcesErrored: totalErrors
    },
    sources: sourcesForExport,
    items: latestItems
  };

  fs.writeFileSync(exportPath, `${JSON.stringify(exportObj, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        runId,
        sources: enabledSources.length,
        entriesSeen: totalParsed,
        entriesNew: totalNew,
        sourcesErrored: totalErrors,
        db: path.relative(process.cwd(), dbPath),
        export: path.relative(process.cwd(), exportPath)
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
