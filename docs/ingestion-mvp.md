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
- Site wiring:
  - If `src/_data/ingested.json` exists, the site renders “Latest items” and per-source fetch status.
  - If it does not exist, the demo site continues to render using mock digests/sources.

## Configuration

`config/sources.json` (MVP fields):

- `sources[].id`: stable identifier (used as the DB primary key).
- `sources[].name`
- `sources[].siteUrl`: human-facing website URL.
- `sources[].feedUrl`: RSS/Atom URL ingested by the pipeline.
- `sources[].category`, `sources[].notes`
- `sources[].enabled`: set `false` to disable a source.

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

Shape (schemaVersion 1):

- `ingested.run`: run metadata (counts, hashes, timestamps)
- `ingested.sources[]`: source list + last fetch status/error
- `ingested.items[]`: most recent normalized entries across sources

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

- Cross-source deduplication (beyond per-source idempotency)
- Classification (rules + AI assist)
- AI summarization and digest assembly
- Redirect-following canonical URL expansion (bounded) and HTML full-text extraction
- CI scheduling to run ingestion before deploy (GitHub Actions currently builds the demo site without ingest)

