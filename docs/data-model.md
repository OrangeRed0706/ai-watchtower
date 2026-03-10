# Data model (proposed) — SQLite-first

This is a proposed schema. Exact names may change, but constraints and provenance requirements should be preserved.

## Design principles
- **Single source of truth**: SQLite DB drives site generation.
- **Immutable-ish raw**: keep raw feed payloads and fetched HTML snapshots for audit/debug.
- **Idempotent writes**: unique keys + upserts.
- **Provenance everywhere**: record where each decision/value came from.

## Entities / tables

### `runs`
Represents one pipeline execution.
- `id` (PK)
- `started_at_utc`, `finished_at_utc`
- `status` (`success` | `partial` | `failed`)
- `git_sha` (optional; CI-provided)
- `config_hash` (hash of relevant config files)
- `notes` (human-readable summary)

### `feeds`
Configured source feeds.
- `id` (PK)
- `name`
- `url` (feed URL)
- `site_url` (optional)
- `category` (e.g., `official`, `research`, `releases`, `community`)
- `enabled` (bool)
- `fetch_interval_minutes` (MVP: fixed daily, but model supports later)
- `last_fetch_at_utc` (nullable)
- `etag`, `last_modified` (nullable)
- `created_at_utc`, `updated_at_utc`

Constraints:
- unique(`url`)

### `feed_fetches`
Fetch attempts (for retries, provenance, debugging).
- `id` (PK)
- `run_id` (FK `runs`)
- `feed_id` (FK `feeds`)
- `fetched_at_utc`
- `http_status` (nullable)
- `error` (nullable)
- `response_headers_json` (nullable)
- `raw_body_path` (path in repo artifact cache or CI workspace; MVP may store in DB as blob/JSON instead)

### `feed_entries_raw`
Raw entries as seen in feeds (even if duplicates).
- `id` (PK)
- `feed_id` (FK)
- `feed_entry_id` (GUID/id from feed; nullable)
- `url_raw` (nullable)
- `title_raw` (nullable)
- `published_at_raw` (nullable string)
- `published_at_utc` (nullable)
- `content_html_raw` (nullable)
- `content_text_raw` (nullable)
- `raw_json` (full parsed entry JSON)
- `ingested_at_utc`

Constraints:
- unique(`feed_id`, `feed_entry_id`) where `feed_entry_id` not null
- unique(`feed_id`, `url_raw`) where `url_raw` not null

### `items`
Normalized, deduplicated items.
- `id` (PK)
- `canonical_url` (nullable; may be absent for some feeds)
- `title` (normalized)
- `published_at_utc` (nullable)
- `first_seen_at_utc`
- `content_text` (nullable; merged/selected best)
- `content_hash` (hash of normalized text used for AI cache)
- `dedup_group_id` (FK `dedup_groups`)
- `provenance_json` (how the item was formed/merged)

Constraints:
- unique(`canonical_url`) where not null
- index on (`published_at_utc`)
- index on (`content_hash`)

### `item_sources`
Many-to-one mapping from raw entries to an Item.
- `id` (PK)
- `item_id` (FK `items`)
- `feed_entry_raw_id` (FK `feed_entries_raw`)
- `source_url_canonical`
- `match_reason` (e.g., `url`, `guid`, `title_hash`, `simhash`, `ai_tiebreak`)

Constraints:
- unique(`item_id`, `feed_entry_raw_id`)

### `dedup_groups`
Groups of Items that are considered the same story/update (usually 1:1 with Item for MVP).
- `id` (PK)
- `key` (stable group key)
- `method` (`exact` | `similarity` | `ai`)
- `score` (nullable)
- `created_at_utc`

Note:
- MVP can represent dedup via `items` only; this table supports future clustering.

### `classifications`
Classification results (rules-first, optionally AI-refined).
- `id` (PK)
- `item_id` (FK `items`)
- `impact_area` (`model` | `product` | `tooling` | `career`)
- `impact_level` (`low` | `medium` | `high`)
- `tags_json` (array)
- `method` (`rules` | `ai` | `hybrid`)
- `rationale` (short text; must reference evidence)
- `created_at_utc`

Constraints:
- unique(`item_id`) for “latest classification” in MVP (or keep history later)

### `summaries`
AI-generated digest-ready content (cached).
- `id` (PK)
- `item_id` (FK `items`)
- `summary` (1–2 sentences)
- `takeaways_json` (array of strings)
- `why_it_matters` (short paragraph)
- `entities_json` (array)
- `sources_json` (array of URLs used)
- `method` (`ai`)
- `model` (e.g., `gpt-4.1-mini` etc; configurable)
- `prompt_hash` (hash of system+user prompt template)
- `input_hash` (typically `content_hash`)
- `created_at_utc`

Constraints:
- unique(`item_id`) in MVP (or unique by `item_id`,`input_hash`,`prompt_hash` if keeping history)

### `digests`
Daily digest pages.
- `id` (PK)
- `digest_date` (YYYY-MM-DD in a configured timezone)
- `generated_at_utc`
- `run_id` (FK)
- `title`
- `intro` (optional)
- `items_json` (ordered list of item IDs with ordering metadata)
- `stats_json` (counts by impact area/level)

Constraints:
- unique(`digest_date`)

### `errors`
Structured errors/warnings (optional MVP but recommended).
- `id` (PK)
- `run_id` (FK)
- `stage` (`ingest` | `normalize` | `dedup` | `classify` | `summarize` | `publish`)
- `entity_type` (e.g., `feed`, `item`)
- `entity_id` (nullable)
- `severity` (`warning` | `error`)
- `message`
- `details_json` (nullable)
- `created_at_utc`

## Output files (generated)

Even with SQLite as truth, the publisher should emit deterministic, versionable artifacts:
- `site-content/digests/YYYY-MM-DD.md` (or JSON)
- `site-content/items/<item-id>.md` (optional MVP)
- `site-content/index.json` (for site build collections/search later)

