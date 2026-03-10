# Site information architecture (GitLab Pages)

## Goals
- Make the latest digest immediately visible.
- Support quick scanning and drilling down to sources.
- Keep pages lightweight and static-hosting friendly.

## MVP pages

### `/` (Home)
- Latest digest headline + date
- “Top items” list (ordered, with impact area + level badges)
- Links to:
  - archive
  - sources
  - about

### `/digests/`
- Archive index (reverse chronological)
- Month grouping (optional)

### `/digests/YYYY-MM-DD/`
- Daily digest page
- Sections:
  - High impact
  - Medium impact
  - Low impact (optional; can collapse)
- Each entry shows:
  - title
  - 1–2 sentence summary
  - why it matters
  - tags/impact labels
  - source links (canonical + alternates)

### `/sources/`
- List of configured sources
- Status hints (optional MVP):
  - last successful fetch date
  - error rate badge (later)

### `/about/`
- What this is, what sources are included, and how to interpret summaries.
- Disclosure of AI assistance + guardrails.

## Optional (post-MVP) pages

### `/items/<id>/`
- Item detail:
  - merged sources
  - raw timestamps
  - classification rationale
  - provenance summary

### `/tags/` and `/tags/<tag>/`
- Tag index and pages.

### `/runs/` and `/runs/<id>/`
- Pipeline run reports (failures, AI budget usage).

## Navigation components (MVP)
- Top nav: Home, Archive, Sources, About
- Digest pages: previous/next day links

## Static-site implementation notes
- Prefer generating Markdown/JSON content into a `site-content/` folder.
- Site generator reads `site-content/` and builds into `public/`.
- All links should be relative and compatible with GitLab Pages base paths.

