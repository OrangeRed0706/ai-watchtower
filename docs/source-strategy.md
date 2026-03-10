# Source strategy

## Objectives
- Maximize **signal-to-noise**.
- Favor **official** and **primary** sources.
- Prefer sources with stable RSS/Atom feeds.
- Keep the initial list small; expand only when source quality is proven.

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

Note: feed URLs should be validated during implementation; treat this as a concrete starting set. If a URL is wrong or missing, implementation should use feed discovery (HTML `<link rel="alternate" …>`), well-known paths (e.g., `/feed/`, `/rss.xml`), and/or documented vendor feeds.

### Official labs / vendors
- OpenAI (blog + product updates) — feed URL TBD (discover/confirm)
- Anthropic (news/blog) — feed URL TBD (discover/confirm)
- Google (DeepMind / Google AI blog) — feed URL TBD (discover/confirm)
- Microsoft (AI / Azure AI updates) — feed URL TBD (discover/confirm)
- Meta AI (research/blog) — feed URL TBD (discover/confirm)
- NVIDIA (developer/blog, CUDA/AI announcements) — feed URL TBD (discover/confirm)
- Apple (machine learning / research news) — feed URL TBD (discover/confirm)
- Amazon (AWS AI / Bedrock updates) — feed URL TBD (discover/confirm)

### Developer platforms / releases
- GitHub Blog — likely RSS: `https://github.blog/feed/`
- Hugging Face Blog — likely RSS: `https://huggingface.co/blog/feed.xml`
- PyTorch Blog — likely RSS: `https://pytorch.org/blog/feed.xml`
- TensorFlow Blog (optional; lower priority) — likely RSS: `https://blog.tensorflow.org/feeds/posts/default?alt=rss`
- ONNX (optional) — use GitHub releases RSS for the repo(s) of interest

### Research / publication streams (high volume; use filters)
- arXiv categories (RSS): `http://export.arxiv.org/rss/cs.CL`, `http://export.arxiv.org/rss/cs.LG`, `http://export.arxiv.org/rss/cs.AI`
- Papers With Code (select pages if RSS exists) (optional)

### Standards / policy (selective)
- NIST (AI risk management / relevant publications)
- EU AI Act-related official updates (where feed exists)
- UK / US agency AI policy updates (only official pages with feeds)

## Minimal “source spec” template (for `sources.yml`)

Each source entry should be structured like:
- `id`: stable identifier
- `name`
- `feed_url`
- `site_url` (optional)
- `category`: `official|research|releases|policy|community`
- `priority`: `1..5` (5 = most important)
- `fetch_policy`: `rss_only|allow_html_fetch`
- `dedup_hints` (optional): host-specific canonicalization notes
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
