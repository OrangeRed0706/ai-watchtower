---
layout: layouts/base.njk
title: About
permalink: /about/index.html
---

## What this is

`ai-watchtower` is a personal “AI news intelligence” project: ingest a curated set of high-signal sources, deduplicate and classify items, then publish a daily briefing as a **GitHub Pages** static site.

## Current state (this repo)

This site is a **static MVP** built with **Eleventy**. When `npm run ingest` has generated `artifacts/ingested.json` (and `npm run artifacts` has produced derived publish artifacts),
the primary browsing flow is driven by real ingested entries with deterministic processing:

- Home page with the latest daily candidate shortlist
- Archive of daily candidate pages (not AI summarized yet)
- Dedup groups (cross-source clustering)
- Candidate scoring + reasons
- Sources list
- Minimal styling and navigation
- GitLab Pages-compatible build output in `public/`

## Next state (implementation)

The next phase is AI summarization + synthesis (still with strict provenance) described in `docs/`, producing compact human-readable digests.

## AI assistance disclosure (target behavior)

Per the spec, AI usage is constrained and auditable:

- Deterministic rules first (dedup + classification where possible)
- AI only for ambiguous judgment and for digest summaries
- Strict structured output (JSON), cached by content hash
- Always link back to original source URLs (provenance)
