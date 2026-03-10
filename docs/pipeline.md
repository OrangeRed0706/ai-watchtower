# Pipeline spec — Ingestion → Publish

## Overview

The pipeline runs on a schedule (daily MVP) and is safe to rerun. It writes to SQLite as the source of truth and generates deterministic site content and a GitLab Pages artifact.

## Stage 0 — Inputs and configuration

**Inputs**
- `sources` config: list of feeds and policies
- `classification` config: rule patterns, tag vocab, thresholds
- `publishing` config: timezone/day boundary, site title, templates
- Secrets (AI API keys) only via CI variables

**Config hashing**
- Compute a `config_hash` each run so outputs are traceable to configuration.

## Stage 1 — Ingestion

**Steps**
1. For each enabled feed:
   - Apply per-host rate limit.
   - Use conditional GET with stored `ETag`/`Last-Modified` when available.
2. Record a `feed_fetches` row for every attempt (success or failure).
3. Parse feed; store each entry into `feed_entries_raw` (upsert).

**Idempotency**
- Uniqueness by (`feed_id`, GUID) where possible; fallback to (`feed_id`, url).

**Retries**
- Network/timeouts: retry with exponential backoff.
- Permanent errors: record error and continue.

## Stage 2 — Normalization

**Canonical URL**
- Normalize and canonicalize `url_raw`:
  - strip tracking params
  - standardize host/scheme
  - remove fragments (usually)
  - optionally follow redirects (bounded) to find canonical

**Content extraction**
- Prefer feed-provided content/snippets.
- HTML fetch is opt-in per source and only when:
  - item is a candidate for digest and feed content is insufficient
  - within per-run budget caps

**Fingerprints**
- Compute:
  - `title_norm` (casefold, whitespace collapse)
  - `title_hash`
  - `content_hash` (normalized text used for AI cache)
  - optional `simhash` for similarity grouping

## Stage 3 — Deduplication

**Deterministic matching tiers**
1. Exact:
   - canonical URL match
   - GUID match (same feed) and canonical URL match across feeds if available
2. Strong heuristic:
   - same `title_hash` within a time window (e.g., 72h) + similar host/category
3. Similarity:
   - `simhash` distance under threshold on title+snippet

**Uncertain band**
- If similarity score is close to threshold, mark as `uncertain` and:
  - either keep separate (conservative default), or
  - run a **single AI tiebreak** prompt comparing the two candidates (budgeted).

**Provenance**
- Persist “why merged” decisions (`match_reason`, scores, inputs).

## Stage 4 — Classification (rules-first)

**Rules**
- Regex/pattern rules for:
  - “model release”, “system card”, “paper”, “benchmark”
  - “API deprecation”, “pricing”, “changelog”, “release notes”
  - “tooling/library/framework”, “SDK”, “CLI”

**AI assist**
- Only if rules produce:
  - low confidence
  - conflicting tags
  - missing impact area/level

## Stage 5 — Summarization (AI)

**When to summarize**
- Only summarize Items that are:
  - high priority sources OR high impact level OR chosen for digest inclusion
- Use cache keyed by `input_hash` + `prompt_hash` + `model`.

**Validation**
- AI output must pass strict JSON schema validation.
- If it fails:
  - run one “repair” attempt using the invalid output as context
  - otherwise fall back to deterministic summary (title + source list)

## Stage 6 — Digest assembly

**Digest date**
- Derived from a configured timezone (e.g., `America/New_York`), stored as `YYYY-MM-DD`.

**Selection**
- Rank items with deterministic scoring:
  - impact level (high > medium > low)
  - source priority
  - recency
  - diversity (avoid 10 items from same source)

**Output**
- Create/replace a `digests` row for the date (idempotent).

## Stage 7 — Publish (GitLab Pages)

**Site content generation**
- Emit deterministic content files (Markdown/JSON) from SQLite snapshot.

**Static build**
- Run the static site generator; output to `public/`.

**GitLab Pages**
- `pages` job publishes `public/` as artifact.

## Observability (MVP-friendly)

- Per-run summary:
  - feeds fetched ok/failed
  - new raw entries
  - new items
  - AI calls made + estimated tokens/cost
- Persist warnings/errors for later review.

