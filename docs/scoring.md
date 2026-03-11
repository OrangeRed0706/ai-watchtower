# Deterministic candidate scoring (v1)

This project intentionally starts with **deterministic, inspectable heuristics** before adding AI summarization.

The output of `npm run ingest` writes per-item fields to `artifacts/ingested.json`:
- `score`: integer “worth reading” rank
- `scoreReasons[]`: explainable contributions (key + delta + optional note)

The Eleventy site exposes this as **Digest candidates (pre-summary)** at `/candidates/`.

## What scoring is (and isn’t)

Scoring is used to pick **candidates** for later steps. It is not:
- a final digest selection
- deduplicated across sources
- classified into impact areas/levels
- summarized

## Signals used (v1)

Each item’s score is the sum of:

1) **Source policy**
- `tier` bonus:
  - `primary`: +30
  - `official`: +20
  - `reference`: +14
  - `secondary`: +6
- `priority` base:
  - `priority` is `0..100` (defaults to `50` if missing)
  - contribution is `round(priority * 0.8)`

2) **Recency**
- Based on `publishedAt` (fallback `updatedAt`)
- Piecewise bonus (hours old):
  - ≤24h: +30
  - ≤72h: +22
  - ≤168h: +14
  - ≤336h: +8
  - ≤720h: +3
  - missing timestamp: −8

3) **Title keywords**
Positive examples:
- release/changelog (+12–14)
- announcement/launch/introducing (+10)
- security/CVE (+14)
- breaking/deprecation/migration (+10)
- pricing/cost/quota (+10)

Negative examples (light penalties):
- roundup/weekly/newsletter (−6)
- webinar/meetup/conference/podcast (−5)

4) **URL/path hints**
Examples:
- `security` (+10), `releases` (+8), `changelog` (+6)

5) **Category hints** (light)
- e.g., “Model”, “Product”, “Tooling/Frameworks”, “Policy/Safety” (+4–6)

## Why this exists

Before AI summarization, scoring provides:
- a compact “what’s worth reading” shortlist
- transparency for debugging source expansion (which sources dominate, why)
- deterministic behavior that can be regression-tested later

## Next steps beyond scoring

To turn candidates into a daily digest:
1. Cross-source deduplication + clustering
2. Classification (rules-first, then AI assist for ambiguous cases)
3. Diversity controls (per-source caps, avoid single-topic dominance)
4. AI summarization and synthesis into a small final digest with provenance links
