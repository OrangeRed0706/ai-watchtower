# ai-watchtower

AI news intelligence pipeline for Lynn.

## Current state (today)

- **Visible static site** built with **Eleventy (11ty)** driven by the latest ingestion snapshot when present
- Specs in `docs/` describing the intended ingestion → publish pipeline
- GitHub Pages workflow that builds the static site into `public/` (`.gitlab-ci.yml` also exists for optional GitLab Pages)
- **Phase 1 ingestion MVP**: `npm run ingest` writes to SQLite and exports `src/_data/ingested.json` (site renders it when present)
- **Deterministic candidate scoring (v1)**: `score` + `scoreReasons`
- **Deterministic dedup (v1)**: cross-source groups + canonical selection
- **Deterministic classification (v1)**: `impactArea`, `impactLevel`, `tags`, `reasons`
- Site views: `/digests/` (daily candidates), `/candidates/` (ranked shortlist), `/dedup/` (groups), `/items/` (raw entries)

The UI includes a prominent notice that the pipeline is still early and does not yet include AI summarization/synthesis.

**Goal**
- Ingest high-signal AI sources (RSS/blog/official updates).
- Normalize + deduplicate entries with deterministic logic.
- Classify entries into impact areas (model / product / tooling / career).
- Use AI **only** where fuzzy judgment is required (e.g., summarization, ambiguous classification).
- Generate a daily digest and publish it to a **GitLab Pages** static site.

**Non-goals (MVP)**
- No real-time alerting (Telegram may be added later).
- No social scraping or paywalled content crawling.
- No “AI everywhere” approach; deterministic first.

## Recommended MVP architecture

**Stack (recommended)**
- **Node.js (TypeScript)** for the pipeline (mature RSS/HTML tooling; easy CI).
- **SQLite** as the single durable store (idempotency, dedup, provenance, low cost).
- **Eleventy (11ty)** to build the static site from generated Markdown/JSON (simple, Node-aligned).

**Why Eleventy for MVP**
- Lowest complexity within a Node toolchain: content in Markdown, templates are straightforward, builds fast.
- “Static first” and GitLab Pages friendly.

**Alternatives (brief)**
- **Astro**: great DX + components, but heavier and unnecessary for a digest MVP.
- **Hugo**: very fast and simple, but introduces a second toolchain (Go) alongside Node pipeline.
- **Plain HTML**: minimal dependencies, but you’ll quickly re-invent templating, archives, and taxonomy pages.

## System overview (end-to-end)

1. **Ingest**: fetch feeds on a schedule; store raw items and fetch snapshots.
2. **Normalize**: canonicalize URLs, normalize timestamps, extract plain text.
3. **Deduplicate**: deterministic clustering (URL/GUID/exact hashes + similarity heuristics).
4. **Classify**: deterministic rules first; AI only for ambiguous cases.
5. **Summarize**: AI produces concise summaries + key takeaways in a strict JSON schema.
6. **Publish**: generate daily digest pages + archives; build to `public/` for GitLab Pages.

## Repo contents

- Site:
  - `src/`: Eleventy site source (templates + data views)
  - `eleventy.config.js`: Eleventy config (builds to `public/`)
  - `.gitlab-ci.yml`: GitLab Pages build + publish
  - `public/`: build output directory (generated; not committed)

- `docs/spec.md`: end-to-end product + technical spec
- `docs/mvp-plan.md`: phased plan, risks, acceptance criteria
- `docs/data-model.md`: proposed SQLite entities/tables and fields
- `docs/source-strategy.md`: source categories and candidate sources
- `docs/pipeline.md`: ingestion → publish flow with ops concerns
- `docs/site-ia.md`: GitLab Pages site information architecture
- `docs/ai-usage.md`: deterministic vs AI tasks, prompts, guardrails

## Operating model (target)

- Runs daily via **GitLab CI scheduled pipeline**.
- Produces a static site artifact in `public/`.
- Keeps costs low by:
  - minimizing AI calls (batching, caching, thresholds)
  - preferring deterministic heuristics
  - storing provenance to support debugging and trust

## Next step

Add AI summarization + synthesis (with strict provenance) to turn daily candidate pages into compact human-readable digests.

## Local development (static site)

Prereqs:
- Site build/dev: Node.js 18+ (recommended: 20+)
- Ingestion MVP: Node.js 24+ (uses `node:sqlite`)

- Install: `npm install`
- Ingest: `npm run ingest` (writes `.data/watchtower.sqlite`, exports `src/_data/ingested.json`)
- Build: `npm run build` (outputs to `public/`)
- Preview: `npm run dev` (Eleventy dev server)

See `docs/ingestion-mvp.md` for details and Phase 1 limitations.

### Notes on GitLab Pages base paths

GitLab Pages often serves project sites under a subpath (e.g. `/ai-watchtower/`). The Eleventy build supports this via `ELEVENTY_PATH_PREFIX`.

- In CI, `.gitlab-ci.yml` derives `ELEVENTY_PATH_PREFIX` from `CI_PAGES_URL`.
- Locally (optional), you can preview a prefixed build with: `ELEVENTY_PATH_PREFIX=/ai-watchtower/ npm run build`
