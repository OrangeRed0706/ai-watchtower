# ai-watchtower — Product + Technical Spec

## 1) Product definition

**Problem**
AI news is high volume, uneven quality, and often duplicated across sources. Lynn wants a daily, high-signal digest that highlights what matters and why, with traceability back to original sources.

**Primary output**
- A **GitHub Pages static site** containing a daily digest and archives.

**Primary user**
- Lynn (single-user system, initially).

**Success criteria (MVP)**
- Daily digest is published reliably (even with partial upstream failures).
- Entries are deduplicated well enough to avoid obvious repeats.
- Classification is consistent and explainable.
- AI usage is constrained, cached, and auditable.

## 2) Core concepts

**Item**
- A normalized unit of news/updates derived from one or more raw feed entries (sources).

**Source**
- A feed and its items (RSS/Atom/JSON feed preferred). The same Item can have multiple Sources.

**Digest**
- A daily page summarizing the most important Items for a date (local day boundary is configurable).

## 3) Functional requirements

### 3.1 Ingestion
- Support RSS/Atom (and optionally JSON Feed) ingestion.
- Poll sources on schedule (daily MVP; optional more frequent later).
- Store raw payloads (for debugging + provenance).
- Respect basic politeness:
  - conditional requests (ETag/Last-Modified) where supported
  - rate limiting / backoff per host

### 3.2 Normalization
- Canonicalize URLs:
  - drop common tracking params (e.g., `utm_*`, `ref`, `source`)
  - normalize scheme/host casing, remove fragments where appropriate
- Parse/normalize timestamps; store in UTC, keep original.
- Extract plain-text snippet from content fields; optionally fetch full article HTML **only** when needed for summarization.
- Generate stable fingerprints (hashes) for exact matching.

### 3.3 Deduplication
Deterministic-first, with AI only for edge cases:
- Exact dedup:
  - same canonical URL
  - same feed GUID
  - same normalized title + published date bucket (configurable)
- Similarity dedup (deterministic heuristics):
  - text similarity on normalized title + snippet (e.g., simhash)
  - cluster into “dedup groups” with thresholds
- AI-assisted tie-break:
  - only when similarity is in an “uncertain band” and the decision affects digest quality

### 3.4 Classification
Classify each Item into:
- **Impact areas**: `model`, `product`, `tooling`, `career`
- **Impact level**: `low`, `medium`, `high`
- **Topics/tags**: small controlled vocabulary + optional freeform tags

Rules-first:
- Deterministic rules for common cases (e.g., “release notes”, “security advisory”, “new model”).
- AI used for ambiguous cases and “why it matters” phrasing.

### 3.5 Summarization (AI-assisted)
For digestable output, AI produces:
- 1–2 sentence summary
- key takeaways (bulleted)
- “why it matters” (tailored to Lynn, but without inventing facts)
- extracted entities (company, model names, product names) when possible

All AI output must:
- be returned as strict JSON
- cite source URLs (from the stored provenance list)
- avoid hallucinations: “unknown” is allowed and preferred to guessing

### 3.6 Publishing
Generate a static site that includes:
- Latest digest page (landing)
- Digest archive by day
- Item pages (optional MVP, but recommended for traceability)
- Source list page
- Taxonomy pages (tags/impact areas) (optional MVP)

Build output:
- `public/` is the static site artifact deployed by Pages.

## 4) Non-functional requirements

**Correctness + verifiability**
- Every published summary links back to the original source URLs.
- Store provenance for each field that came from:
  - ingestion normalization
  - deterministic rules
  - AI output (model/version/prompt hash)

**Idempotency**
- Re-running a day’s pipeline should not create duplicates.
- Unique constraints and “upsert” semantics in SQLite.

**Reliability**
- Partial failure tolerated:
  - a broken feed does not prevent publishing a digest
  - failures are logged and visible on a “Run report” page (optional MVP)

**Maintainability**
- Clear module boundaries: ingest / normalize / dedup / classify / summarize / publish.
- Configuration via versioned files in-repo (sources list, thresholds, tag vocab).

**Cost control**
- AI calls are:
  - minimized (only on ambiguous items)
  - cached by content hash
  - bounded (max tokens, max items/day)

## 5) Scheduling + operations (CI)

**Trigger**
- Scheduled pipeline (daily) plus manual trigger.

**Jobs**
- `pipeline`: run ingestion→publish; produce `public/`
- `pages`: publish `public/` as the Pages artifact

**Retry strategy**
- Per-source exponential backoff for transient failures.
- Global pipeline should still succeed if some sources fail (with warnings).

## 6) Security + privacy

- Do not store secrets in repo.
- AI API keys via CI variables.
- Store only necessary content; avoid personal data.
- User-agent identifies the project; obey robots and terms for fetched HTML.

## 7) MVP scope boundaries

Included:
- RSS/Atom ingest
- SQLite store with provenance
- Dedup + classification + summarization
- GitHub Pages site with digest + archive

Excluded (MVP):
- Telegram notifications
- Full-text crawling at scale
- User accounts / personalization UI
- Complex search (optional later: Lunr/mini search on generated JSON)
