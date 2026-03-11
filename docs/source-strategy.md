# Source strategy

## Objectives
- Maximize **signal-to-noise**.
- Favor **official** and **primary** sources.
- Prefer sources with stable RSS/Atom feeds.
- Keep the initial list small; expand only when source quality is proven.

## Working policy: tiers + priorities

Goal: we can ingest many raw sources, but the output shown to Lynn must stay compact.

Each source gets:
- `tier`: coarse trust/importance bucket
  - `primary`: release notes / changelogs / security advisories
  - `official`: official vendor or project blog/news
  - `reference`: standards/regulators/docs collections (selective)
  - `secondary`: rare, curated editorial sources (sparingly)
- `priority`: 0–100 importance within a tier (used as a deterministic ranking signal)
- `sourceType`: short label (`changelog`, `release_notes`, `vendor_blog`, …)
- `fetchPolicy`: currently `feed` (RSS/Atom) or `manual` (documented, not ingested yet)

## Inclusion criteria

Include sources that are:
- Official company/product blogs, release notes, changelogs
- Research org announcements (labs, benchmarks, model cards)
- Standards/regulatory bodies (relevant AI policy/standards)
- High-quality aggregations with strong editorial control (sparingly)

Exclude (MVP):
- Social media (X/LinkedIn/Reddit) ingestion
- Scraped news sites without feeds/permissions
- High-duplication “AI news” firehoses

## Categories

1) **Model releases / research**
- New model releases, evaluation reports, papers, model/system cards.

2) **Product updates**
- API changes, pricing, feature launches, deprecations.

3) **Tooling**
- Developer tools, frameworks, infra, deployment, safety tooling.

4) **Career / market impact**
- Hiring trends, role shifts, regulation affecting jobs (keep conservative).

## Initial candidate sources (seed list)

Note: any uncertain feed URL should be documented as `enabled: false` (do not guess and enable).

### Official labs / vendors
- OpenAI Blog — `https://openai.com/blog/rss.xml`
- AWS Machine Learning Blog — `https://aws.amazon.com/blogs/machine-learning/feed/`
- Anthropic News — no stable feed configured yet (documented but disabled)

### Developer platforms / releases
- GitHub Changelog — `https://github.blog/changelog/feed/`
- Hugging Face Blog — `https://huggingface.co/blog/feed.xml`
- PyTorch Blog — `https://pytorch.org/blog/feed.xml`
- GitHub release notes (Atom) for key SDKs:
  - `https://github.com/openai/openai-python/releases.atom`
  - `https://github.com/openai/openai-node/releases.atom`

### Research / publication streams (high volume; use filters)
- arXiv categories (RSS): `http://export.arxiv.org/rss/cs.CL`, `http://export.arxiv.org/rss/cs.LG`, `http://export.arxiv.org/rss/cs.AI`
- Papers With Code (select pages if RSS exists) (optional)

### Standards / policy (selective)
- NIST (AI risk management / relevant publications)
- EU AI Act-related official updates (where feed exists)
- UK / US agency AI policy updates (only official pages with feeds)

## Minimal “source spec” template (for `config/sources.json`)

Each source entry should be structured like:
- `id`: stable identifier
- `name`
- `feedUrl`
- `siteUrl` (optional)
- `category`: `official|research|releases|policy|community`
- `tier`: `primary|official|reference|secondary`
- `priority`: `0..100` (100 = most important)
- `fetchPolicy`: `feed|manual`
- `notes`: why included, what “good” looks like

## Source configuration requirements

Each configured source should define:
- `name`, `feed_url`, `site_url`
- `category`
- `priority` (affects digest inclusion when budget-limited)
- `fetch_policy`:
  - `rss_only` (default)
  - `allow_html_fetch` (only for a small subset of sources)
- `notes` (why included, what to watch for)

## Ongoing curation policy
- Track per-source “useful item rate” and error rate.
- Remove or demote sources that:
  - produce frequent duplicates
  - frequently break
  - are mostly low-impact
