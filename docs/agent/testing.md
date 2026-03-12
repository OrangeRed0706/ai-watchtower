# Testing

Use the smallest command set that proves the change.

## Commands

- Agent-doc structure: `npm run check:agent-docs`
- Unit and integration tests: `npm test`
- Full pipeline refresh: `npm run pipeline`
- Site build: `npm run build`

## Minimum verification by change type

| Change type | Minimum verification |
| --- | --- |
| `AGENTS.md` or `docs/agent/*` only | `npm run check:agent-docs` |
| CLI, pipeline, contracts, tests | `npm test` |
| Artifact contract, pipeline output, site data flow | `npm test`, `npm run pipeline`, `npm run build` |
| README or product docs with agent-doc changes | `npm run check:agent-docs` |

## Before claiming success

- The command you chose must actually run in this workspace.
- If a command could not run, say that explicitly.
- If docs changed behavior expectations, update the docs in the same change.
