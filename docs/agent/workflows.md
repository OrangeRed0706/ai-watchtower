# Workflows

Use these flows to keep changes observable and verifiable.

## Implementation or behavior change

1. Read [context-map.md](/Users/lynn/StudyProject/ai-watchtower/docs/agent/context-map.md) and the smallest relevant domain docs.
2. Confirm the behavior and artifact boundary you are changing before editing.
3. Make the code and doc changes together if the public behavior or workflow changed.
4. Run the minimum verification from [testing.md](/Users/lynn/StudyProject/ai-watchtower/docs/agent/testing.md).
5. Finish with [change-checklist.md](/Users/lynn/StudyProject/ai-watchtower/docs/agent/change-checklist.md).

## Debugging or unexpected behavior

1. Reproduce the issue first.
2. Identify whether the problem is in pipeline code, artifact generation, or site rendering.
3. Change the smallest layer that explains the failure.
4. Re-run the command or test that reproduced the issue before broader verification.

## Docs-only or repo-instructions change

1. Prefer editing existing docs over adding new files.
2. Keep `AGENTS.md` short and move detail into linked docs only when needed.
3. Fix stale or contradictory guidance exposed by the change.
4. Run `npm run check:agent-docs`.

## Review mindset

When reviewing, prioritize:
- broken invariants
- stale or contradictory docs
- missing verification
- changes that introduce a second source of truth
