---
name: chat-refine
description: >
  Post-research refinement chat — edits already-rendered research cards, answers
  section-specific follow-up questions, and proposes profile updates from
  existing evidence. Does not dispatch new research.
version: 0.1.0
---

# chat-refine

> **Status**: Implemented 2026-04-28. Prompt-complete local invocation contract. Claude writes the run output; deterministic validation and sanity gates remain the source of truth.

## What this skill does

Given a sealed post-research workspace payload, produces a typed chat-refinement output for the Journey workspace: a concise answer, zero or more proposed card edits, zero or more proposed onboarding/profile field updates, and any blocking warnings. The agent phase interprets the user request against already-rendered cards and existing research evidence, then writes `<runDir>/output.json`. The deterministic tail validates the file against the local output schema and runs the sanity gates.

This skill is interaction-layer work only. It does not collect new market facts, run competitor research, scrape URLs, change upstream skill outputs, or persist to Supabase by itself. The caller owns applying accepted edits through the workspace UI.

## Trigger

```
/chat-refine <input-spec>
```

Invoke when the user is already looking at Journey research output and asks to:

- edit wording, values, bullets, stats, headlines, or table/list items in a specific visible card
- explain, compare, challenge, or deepen a completed research section using the evidence already in view
- regenerate a narrow fragment of a card from existing sourced material
- propose an onboarding/profile field update after the user explicitly asks for it
- summarize what changed after an edit proposal

Do not invoke for:

- first-pass company ingestion (`ingest-identity`, `ingest-url`, `ingest-docs`, `ingest-fathom`)
- net-new market, ICP, competitor, VoC, keyword, offer, media-plan, or script research
- broad strategy synthesis across all sections (`research-cross`, `synthesize-positioning`, `synthesize-media-plan`, `synthesize-scripts`)
- UI rendering or Supabase write-back plumbing (`present-workspace`)
- any request that needs fresh external facts not already present in the provided payload

If the user asks for new research, stop and route to the appropriate research skill instead of trying to answer from memory.

## Tools used

- `Read(<runDir>/input.json)` — read the sealed invocation payload.
- `Read(skills/chat-refine/references/rules.md)` — load hard constraints before producing output.
- `Read(skills/chat-refine/references/collector.md)` — load the collector prompt for the agent phase.
- `Read(skills/chat-refine/schemas/output.zod.ts)` — output schema source of truth when present.
- `Read(skills/chat-refine/schemas/output.ts)` — compatibility fallback only when `output.zod.ts` is not present in the current checkout.
- `Write(<runDir>/output.json)` — write the complete schema-shaped output.
- `Bash(npm run validate -- <runDir>/output.json)` — run the schema gate.
- `Bash(npm run sanity-check -- <runDir>/output.json)` — run the integrity gate.

No web search, browser scraping, Firecrawl, Perplexity, ad-library calls, research-worker dispatch, live Supabase writes, or provider log reads are permitted inside this skill.

## Workflow

1. **Receive** — read `<runDir>/input.json`. Parse the user message, current section, card context, research-result context, profile context, and any explicit target card or field.
2. **Preflight** — fail before writing a normal refinement output if there is no completed research result or no visible/current card context. There is nothing to refine.
3. **Load contract** — read `references/rules.md`, `references/collector.md`, and the local output schema. The schema wins over examples, prose, and prior memory.
4. **Classify request** — choose exactly one primary intent: read-only answer, card edit proposal, profile update proposal, narrow fragment regeneration, or blocked/out-of-scope request.
5. **Collect from supplied context** — use only the provided cards, research results, uploaded-document excerpts, meeting insights, and profile fields. Preserve card IDs, section keys, field names, and content shapes exactly.
6. **Produce output** — write `<runDir>/output.json` matching the local output schema. Do not include unknown top-level fields. Do not write placeholder values to satisfy shape.
7. **Validate** — run `npm run validate -- <runDir>/output.json`. Fix schema failures by editing `output.json`, not by weakening the schema.
8. **Sanity-check** — run `npm run sanity-check -- <runDir>/output.json`. Fix integrity failures by narrowing or blocking the proposal, not by bypassing the gate.
9. **Present** — return the validated JSON path and a short human summary. The caller or UI handles user approval, card overlays, and persistence.

Stop after three consecutive failures in any tool, file, validation, or generation step and ask the caller for direction. Do not retry indefinitely.

## Schema reference

- Input: `schemas/input.zod.ts` or `schemas/input.ts` in this skill folder when present.
- Output: `schemas/output.zod.ts` or `schemas/output.ts` in this skill folder when present.
- Collector prompt: `references/collector.md`.
- Hard rules: `references/rules.md`.
- Fixtures: `example/input.json`, `example/output.json` when present.

The output schema is the source of truth. If the schema is missing from the checkout, do not invent a substitute contract. Report the missing file as a blocker.

Expected output concepts, subject to the schema's exact field names:

- run identity: `run_id`, current section, generated timestamp
- request classification: mode/intent, target card/field if any
- assistant response: concise user-facing answer grounded in provided context
- card edit proposals: card id, field path, complete new value, explanation, before/after snapshot when the schema supports it
- profile update proposals: allowed onboarding field key, proposed value, reason, and user-approval requirement
- citations/provenance: card IDs and any source URLs already present in supplied research evidence
- warnings/blockers: missing context, ambiguous target, out-of-scope fresh research, or unsupported field shape

## Hard constraints

- Post-research only. Do not dispatch, run, or simulate new research.
- The user must explicitly ask for an edit before an edit proposal is produced.
- Edits are surgical: change only the requested card and requested field.
- Preserve card IDs, section keys, card types, and existing content shapes.
- For stat-grid cards, use dot notation for stat fields when the schema or caller expects it, e.g. `stats.Category`.
- For list fields, output the complete updated array, not a patch fragment.
- For object fields, output the complete updated object unless the schema explicitly supports patch operations.
- Profile updates are proposals only. They require user approval and must use allowed onboarding field keys from the local contract.
- Cite existing card IDs for factual claims. If source URLs exist in the supplied evidence, preserve them. If no evidence supports a claim, say so instead of inventing it.
- No LLM-scored metrics, fabricated statistics, invented pricing, invented market data, or unsourced company facts.
- Empty proposals are valid when the right answer is a read-only response or a blocked request.
- Self-contained: no imports from `src/`, `research-worker/`, root `lib/`, or another skill.

## Output

Write exactly one JSON file at `<runDir>/output.json`. It must validate against the local output schema and pass the local sanity-check. The JSON represents a refinement result, not a rendered UI:

- read-only answers explain or challenge existing cards without changing state
- edit proposals are previewable and reversible until the user accepts them
- profile updates are proposals, not writes
- blockers explain why the request cannot be fulfilled from supplied evidence

Never write HTML from this skill unless a future local schema and script explicitly require it.
