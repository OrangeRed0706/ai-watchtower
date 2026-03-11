# Phase 1 — Ingestion + normalization MVP

This phase adds a real RSS/Atom ingestion pipeline that writes to a local SQLite DB and exports a build-friendly JSON snapshot for the Eleventy site.

## What you get in Phase 1

- `config/sources.json`: seed list of RSS/Atom feeds.
- `npm run ingest`: fetch feeds, parse entries, store raw rows in SQLite, export normalized items to `src/_data/ingested.json`.
- Basic normalization:
  - canonical URL cleanup (tracking param stripping, fragments removed, stable query ordering)
  - timestamp normalization (ISO-8601 UTC when parseable)
  - normalized title/snippet fields (whitespace collapse, HTML stripped, snippet truncation)
  - stable hashes (`fingerprint`, `content_hash`) for future dedup + AI cache keys
- Deterministic processing:
  - candidate scoring (v1): `score` + `scoreReasons`
  - cross-source dedup (v1): stable groups keyed by canonical URL (fallback to content hash, then day+title)
  - first-pass classification (v1): `impactArea`, `impactLevel`, `tags`, `reasons`
- Site wiring:
  - If `src/_data/ingested.json` exists, the site renders the homepage, daily candidate pages, candidates, items, dedup groups, and per-source fetch status from real data.
  - If it does not exist, pages render with empty states (prompting you to run `npm run ingest`).

## Configuration

`config/sources.json` (current fields):

- `sources[].id`: stable identifier (used as the DB primary key).
- `sources[].name`
- `sources[].siteUrl`: human-facing website URL.
- `sources[].feedUrl`: RSS/Atom URL ingested by the pipeline.
- `sources[].category`, `sources[].notes`
- `sources[].enabled`: set `false` to disable a source.
- Source policy metadata (used for ranking and future budgeting):
  - `sources[].tier`: `primary|official|reference|secondary`
  - `sources[].priority`: `0..100` (higher = more important)
  - `sources[].sourceType`: `changelog|release_notes|vendor_blog|...`
  - `sources[].fetchPolicy`: `feed` (ingest) or `manual` (document only; not ingested yet)

## Storage + idempotency

SQLite DB: `.data/watchtower.sqlite` (not committed).

Tables (MVP):

- `sources`: configured sources plus last fetch state (`etag`, `last_modified`, `last_fetch_*`).
- `feed_fetches`: per-run per-source fetch attempts (success/failure metadata + error strings).
- `feed_entries_raw`: per-source raw entries (idempotent upserts).
- `ingestion_runs`: per-run summary.

Idempotency rule:

- Entries are unique by `(source_id, entry_uid)`, where `entry_uid` is `guid` if present, else canonical URL, else a computed fingerprint.
- Re-running `npm run ingest` updates `last_seen_at` and does not create duplicates.

## Export for the site

The ingest script writes `src/_data/ingested.json` (not committed by default). Eleventy will pick it up automatically as `ingested`.

Shape (schemaVersion 2, with additive fields):

- `ingested.run`: run metadata (counts, hashes, timestamps)
- `ingested.sources[]`: source list + last fetch status/error
- `ingested.items[]`: most recent normalized entries across sources
- `ingested.scoring`: scoring metadata for the current snapshot
- `ingested.dedup`: dedup metadata + groups (inspectable)
- `ingested.classification`: classification metadata (version + timestamp)
- Per-item scoring fields:
  - `items[].score`, `items[].scoreVersion`
  - `items[].scoreReasons[]`: explainable “why” signals (keyword/path/recency/source policy)
- Per-item dedup fields:
  - `items[].dedup.key`, `items[].dedup.basis`, `items[].dedup.groupSize`, `items[].dedup.isCanonical`
- Per-item classification fields:
  - `items[].classification.impactArea`, `items[].classification.impactLevel`
  - `items[].classification.tags[]`, `items[].classification.reasons[]`

## Running locally

Prereqs:
- Node.js 24+ for ingestion (uses `node:sqlite`).
- Network access to:
  - the configured feed hosts
  - the npm registry (to install `rss-parser`)

Commands:

- Install: `npm install`
- Ingest: `npm run ingest`
- Build: `npm run build`
- Dev: `npm run dev`

## What remains (not in Phase 1)

- AI summarization and digest assembly (the “final” compact digest output)
- Diversity controls and per-source budgeting (e.g., avoid 10 items from one source)
- Redirect-following canonical URL expansion (bounded) and HTML full-text extraction
- CI scheduling to run ingestion before deploy (GitHub Pages currently builds the site without ingestion)
