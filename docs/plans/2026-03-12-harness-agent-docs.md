# Harness-Style Agent Docs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a concise repo-local `AGENTS.md`, supporting agent-facing docs, and lightweight checks so this repo follows harness-engineering-style guidance instead of relying on a long prompt blob.

**Architecture:** Keep the root `AGENTS.md` short and authoritative. Push volatile or detailed guidance into versioned docs under `docs/agent/`, and add one mechanical check script plus CI wiring so the structure stays enforceable.

**Tech Stack:** Markdown, TypeScript, Node 24, existing npm/GitHub Actions workflow

---

### Task 1: Define the repo-local agent documentation structure

**Files:**
- Create: `AGENTS.md`
- Create: `docs/agent/README.md`
- Create: `docs/agent/context-map.md`
- Modify: `README.md`

**Step 1: Write the target constraints in docs**

Document the intended split:
- short root entrypoint
- repo reading order
- no duplicated authority
- exact file links for deeper guidance

**Step 2: Verify the structure is minimal**

Check that each new doc has one clear purpose and does not restate architecture or workflow content already covered elsewhere in `docs/`.

### Task 2: Add task-specific guidance without re-creating a prompt blob

**Files:**
- Create: `docs/agent/workflows.md`
- Create: `docs/agent/testing.md`
- Create: `docs/agent/change-checklist.md`

**Step 1: Write terse workflow guidance**

Add observable steps for implementation, debugging, review, and docs-only changes.

**Step 2: Write verification guidance**

List exact commands and minimum expectations by change type.

**Step 3: Add a short checklist**

Keep the checklist fast to scan and directly testable.

### Task 3: Add a lightweight mechanical check

**Files:**
- Create: `scripts/check-agent-docs.ts`
- Modify: `package.json`
- Modify: `.github/workflows/pages.yml`

**Step 1: Write the failing check expectation**

The script should fail if:
- `AGENTS.md` is missing
- `AGENTS.md` grows past a reasonable length
- linked agent docs are missing

**Step 2: Implement the script**

Use repo-local paths only and print actionable failures.

**Step 3: Wire it into npm and CI**

Run the check before pipeline/site build in GitHub Actions.

### Task 4: Fix stale guidance exposed during the refactor

**Files:**
- Modify: `docs/mvp-plan.md`
- Modify: `README.md`

**Step 1: Remove stale deployment references**

The repo deploys with GitHub Actions and GitHub Pages, so old GitLab wording should be corrected where it is now inaccurate.

**Step 2: Link the new agent docs**

Make the repo entrypoints discoverable to humans and agents.

### Task 5: Create and verify the reusable skill

**Files:**
- Create: `/Users/lynn/.codex/skills/harness-agent-docs/SKILL.md`

**Step 1: Capture the reusable pattern**

Document when to use the skill, what shape the root `AGENTS.md` should have, how to split supporting docs, and what mechanical checks to add.

**Step 2: Pressure-test the skill**

Compare a baseline answer without the skill to a post-skill answer that reads the new skill. Confirm the skill pushes toward a short `AGENTS.md`, repo-local docs, and enforceable checks.

### Task 6: Verify the repo changes

**Files:**
- Test: `npm run check:agent-docs`
- Test: `npm test`

**Step 1: Run the new doc check**

Expect success with all required files present.

**Step 2: Run the existing test suite**

Confirm the refactor did not break current repo behavior.
