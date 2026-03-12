# MVP Plan — Phases, Risks, Acceptance Criteria

## Scope boundary (what “MVP done” means)

MVP is complete when a scheduled CI run can ingest configured sources, deduplicate and classify items, produce a daily digest, and publish it to GitHub Pages with provenance links reliably and idempotently at low cost.

## Phase 0 — Repo + CI scaffolding

**Deliverables**
- Directory structure for pipeline outputs and site content.
- CI skeleton with:
  - scheduled pipeline support
  - a Pages deployment job publishing `public/`
- Config files (sources list, thresholds, tag vocabulary).

**Acceptance criteria**
- A CI pipeline can run end-to-end with placeholder data and produce a Pages artifact.
- No secrets committed; CI variables documented.

**Risks**
- Pages deployment conventions and artifacts must be correct.

## Phase 1 — Ingestion + storage

**Deliverables**
- RSS/Atom fetching with conditional requests.
- SQLite schema + migrations approach (simple sequential migrations).
- Raw payload persistence + per-run logs.

**Acceptance criteria**
- Adding a source results in new raw entries stored with timestamps and feed metadata.
- Re-running does not duplicate raw entries (unique constraints by feed + GUID/URL).
- Failures recorded with actionable error messages.

**Risks**
- Feeds vary widely; some omit GUIDs or stable URLs.

## Phase 2 — Normalization + dedup

**Deliverables**
- URL canonicalization and normalization.
- Deterministic dedup (exact + similarity heuristic).
- Dedup groups with explainable reasons.

**Acceptance criteria**
- Obvious duplicates across sources collapse into a single Item.
- Each Item retains a list of original source entries/URLs.
- Dedup decisions are stable across reruns.

**Risks**
- Over-dedup (merging distinct items) vs under-dedup (too many repeats).
  - Mitigation: conservative thresholds; expose “uncertain” band for review/AI tie-break.

## Phase 3 — Classification + AI summarization

**Deliverables**
- Rules-first classifier (deterministic).
- AI-assisted classifier/summarizer for ambiguous items only.
- Cache AI outputs by content hash; strict JSON schema validation.

**Acceptance criteria**
- For a given day, the digest includes:
  - impact areas + impact level
  - a short summary and “why it matters”
  - links to sources
- AI budget controls enforce daily max calls/items/tokens.
- Invalid AI output is rejected and retried with a repair prompt, then falls back safely.

**Risks**
- AI hallucinations.
  - Mitigation: schema + citations + “unknown” allowed + no external browsing.

## Phase 4 — Publish (site generation)

**Deliverables**
- Static site generator setup (recommended: Eleventy).
- Daily digest pages + archive.
- Source list page and basic tag/impact pages (optional MVP).

**Acceptance criteria**
- GitHub Pages site shows:
  - Latest digest (today)
  - Archive navigation
  - Each digest item links to its canonical source(s)
- Build is deterministic and repeatable from the DB snapshot.

**Risks**
- Keeping the site generator simple while supporting archives and taxonomy.

## Phase 5 (post-MVP) — Quality + visibility

**Candidates**
- Lightweight search over generated JSON.
- “Run report” page with warnings/errors and per-source status.
- Optional Telegram notifications for high-impact items only.
- Source health metrics and pruning.

## Cross-cutting concerns (all phases)

**Idempotency**
- Every stage is safe to rerun; uses upserts and unique constraints.

**Provenance**
- Store: input URLs, fetch times, hashes, normalization decisions, rule matches, AI prompt/version hashes.

**Cost control**
- Prefer deterministic summarization for very short items (e.g., release notes titles) and reserve AI for meaningful items.
