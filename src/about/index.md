---
layout: layouts/base.njk
title: About
permalink: /about/index.html
---

## What this is

`ai-watchtower` is a personal “AI news intelligence” project: ingest a curated set of high-signal sources, deduplicate and classify items, then publish a daily digest as a **GitLab Pages** static site.

## Current state (this repo)

This site is a **static MVP demo** built with **Eleventy**, using **sample/mock data** to demonstrate:

- Home page with the latest digest
- Digest archive and daily digest pages
- Sources list
- Minimal styling and navigation
- GitLab Pages-compatible build output in `public/`

## Next state (implementation)

The next phase is the ingestion + normalization + dedup + classification + summarization pipeline described in `docs/`, producing real site content.

## AI assistance disclosure (target behavior)

Per the spec, AI usage is constrained and auditable:

- Deterministic rules first (dedup + classification where possible)
- AI only for ambiguous judgment and for digest summaries
- Strict structured output (JSON), cached by content hash
- Always link back to original source URLs (provenance)

