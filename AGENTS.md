# AGENTS.md

This file is the repo entrypoint for coding agents. Keep it short. Detailed guidance belongs in versioned repo docs, not in this file.

## Start Here

1. Read [README.md](README.md) for the product shape and command surface.
2. Use [docs/agent/context-map.md](docs/agent/context-map.md) to load the smallest relevant context.
3. Use [docs/agent/workflows.md](docs/agent/workflows.md) and [docs/agent/testing.md](docs/agent/testing.md) before claiming a change is complete.

## Core Invariants

- `artifacts/*.json` are the publish contract; the site should read artifacts, not invent parallel data paths.
- SQLite is the control plane, not the publish truth. Preserve deterministic rebuilds and provenance.
- Keep AI-assisted behavior schema-constrained, cited, and optional behind deterministic fallbacks.
- Reuse existing repo docs before creating new agent-only explanations.

Architecture references:
- [docs/architecture/artifact-first-architecture.md](docs/architecture/artifact-first-architecture.md)
- [docs/pipeline.md](docs/pipeline.md)
- [docs/data-model.md](docs/data-model.md)
- [docs/ai-usage.md](docs/ai-usage.md)

## Workflows

- Implementation, debugging, review, and docs-only flows: [docs/agent/workflows.md](docs/agent/workflows.md)
- Quick completion checks: [docs/agent/change-checklist.md](docs/agent/change-checklist.md)

## Verification

- Docs-only changes: `npm run check:agent-docs`
- Code or pipeline changes: `npm test`
- Changes affecting pipeline/site contracts: `npm run pipeline` and `npm run build`

If code, tests, and docs disagree, treat code and executable checks as the current reality, then update the docs in the same change.

## Maintenance Rules

- Keep this file under the repository line budget enforced by `npm run check:agent-docs`.
- Put stable repo-wide rules here; put detailed or volatile guidance in linked docs.
- Remove stale guidance when discovered. Outdated agent docs are worse than missing docs.
