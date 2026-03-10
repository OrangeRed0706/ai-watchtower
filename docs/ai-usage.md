# AI usage — deterministic vs AI-assisted, prompts, guardrails

## Principle
Use deterministic code for everything that can be made correct and verifiable. Use AI only for tasks that require fuzzy judgment or synthesis, and constrain it with schemas, caching, and fallbacks.

## Deterministic tasks (no AI)

- Fetching feeds and parsing RSS/Atom
- Canonicalizing URLs and stripping tracking params
- Timestamp normalization
- Hashing/fingerprinting
- Deduplication (exact match + similarity heuristics)
- Rule-based classification (when rules confidently apply)
- Digest assembly scoring/ranking (deterministic)
- Site generation and publishing
- Provenance recording, logging, retries, idempotent DB writes

## AI-assisted tasks (allowed)

1) **Summarization**
- Produce concise summary, takeaways, and “why it matters”.

2) **Ambiguous classification refinement**
- Assign impact area/level when rules are inconclusive.

3) **Dedup tie-break (rare)**
- Decide if two near-duplicate candidates should be merged, only within an “uncertain band”.

## Guardrails

**Hard constraints**
- AI output must be valid JSON matching a strict schema.
- AI must not introduce facts not supported by the provided text.
- AI must reference source URLs from the provided provenance list.
- AI calls are budgeted:
  - max items/day
  - max tokens/item
  - max total tokens/day

**Caching**
- Key by (`model`, `prompt_hash`, `input_hash`) where `input_hash` derives from normalized text.
- Reuse summaries across reruns unless input changes.

**Fallback behavior**
- If AI fails (timeouts, invalid JSON, hallucination detected):
  - fallback summary: title + 1 sentence derived from snippet (deterministic) + source links
  - classification fallback: `impact_level=low`, `impact_area=tooling` (or `unknown`) with rationale “insufficient confidence”

## Prompt design guidance

### Common input format
Provide AI with:
- `item_title`
- `item_text` (normalized; truncated with clear “TRUNCATED” marker)
- `source_urls` (array)
- `constraints` (no external knowledge; return JSON only)

### Output schema (summarization)
Example schema shape (exact JSON Schema to be implemented later):
- `summary`: string (1–2 sentences)
- `takeaways`: string[] (2–5 bullets)
- `why_it_matters`: string (1 short paragraph)
- `impact_area`: one of `model|product|tooling|career`
- `impact_level`: one of `low|medium|high`
- `tags`: string[] (0–8)
- `entities`: { `type`: string, `name`: string }[]
- `citations`: string[] (subset of `source_urls`)
- `uncertainties`: string[] (optional; list what’s unknown)

### Anti-hallucination tactics
- Explicitly instruct:
  - “Use only provided text.”
  - “If missing, say ‘unknown’.”
  - “Do not guess versions/dates unless present.”
- Add a verifier step (deterministic) that flags:
  - missing citations
  - claims containing numbers/versions not present in input

### Repair prompt (single retry)
If JSON parsing fails, send:
- the invalid output
- the schema requirements
- instruction: “Return corrected JSON only.”

## Cost controls (practical)
- Summarize only items selected for the digest (or above an impact threshold).
- Truncate inputs to a token budget; prefer feed content before HTML fetch.
- Batch requests where provider supports it, but keep per-item caching keys.

## Model/provider abstraction (implementation guidance)
- Keep AI provider behind an interface:
  - `summarize(item) -> SummaryJSON`
  - `classify(item) -> ClassificationJSON`
  - `dedup_tiebreak(a,b) -> MergeDecisionJSON`
- Log:
  - model name/version
  - prompt hash
  - input hash
  - token usage (if available)

