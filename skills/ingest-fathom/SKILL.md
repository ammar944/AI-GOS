---
name: ingest-fathom
description: Use when ingesting a Fathom recording into AIGOS v3 brief enrichment, extracting sourced sales-call intelligence with explicit transcript quotes, speaker attribution, and deterministic validation.
---

# Section 02 - Fathom Meeting Ingestion

## Trigger
`@ingest-fathom { "run_id": "...", "recording_id": "...", "meeting_type_hint": "discovery" }`

## What it does
Takes a Fathom recording identifier and emits sourced sales-call intelligence for the `enrich-brief` stage. The output is a meeting evidence block for downstream brief, research, Voice of Customer, offer, competitor, and synthesis skills. Every factual claim carries `source_url` and `retrieved_at`, and transcript facts include explicit speaker-attributed quote evidence.

## Boundaries
This skill does not parse uploaded transcript files, run market research, generate strategy, write database rows, update meeting status flags, or render UI. It does not replace downstream research skills. Adjacent owners:

- `ingest-docs`: uploaded documents and plain transcript files.
- `ingest-identity`: canonical company, domain, category, and keyword anchors.
- `research-icp`, `research-offer`, `research-competitor`, `research-voc`, `research-cross`: downstream use of meeting evidence.
- Runtime wiring outside this skill owns Fathom credentials, recording fetch, persistence, and status updates.

## Workflow
1. Parse the request against `schemas/input.ts`.
2. Fetch the Fathom recording and transcript in the runtime wrapper, or receive the already fetched transcript from an approved wrapper.
3. Read `references/rules.md` and `references/collector.md`.
4. Extract only facts explicitly present in the transcript.
5. Write a JSON object matching `schemas/output.ts`.
6. Run `npm run validate`.
7. Run `npm run sanity-check <output.json>`.
8. Return only validated JSON to the caller.

## Tools
- Fathom recording fetcher supplied by the runtime wrapper.
- Transcript extraction model constrained by `references/collector.md`.
- `Bash(npm run validate)` and `Bash(npm run sanity-check <output.json>)` for deterministic gates.
- File write tools: write only run artifacts or files inside this skill folder.

## Hard constraints
1. Facts only. No inferred decisions, budgets, goals, action items, speakers, competitor sentiment, or objections.
2. Every factual claim must include `source_url` and `retrieved_at`.
3. Quotes are required for pain points, competitor mentions, buying triggers, objections, goals, decisions, and action items.
4. Budget signals require an exact quote. Never round, estimate, or infer budget.
5. Speaker attribution must stay explicit on every transcript quote.
6. Empty arrays are allowed. Never write placeholder strings such as missing-value labels, scaffold text, TODO text, or filler.
7. Keep this skill self-contained. Do not import from the app source tree, worker source tree, root libraries, or another skill.
8. Do not write database rows or meeting status flags.
9. Recording fetch errors must throw with provider, recording id, status, and run id.
10. Transcript extraction failures may preserve raw model text only in local run artifacts, never in final sourced output.

## Output
The output schema is `ingestFathomOutputSchema` in `schemas/output.ts`.

Top-level fields:

- `run_id`
- `stage: "enrich-brief"`
- `ingest_kind: "fathom"`
- `recording_id`
- `recording_url`
- `title`
- `call_type`
- `speakers`
- `business_health_summary`
- `pain_points`
- `budget_signals`
- `competitor_mentions`
- `buying_triggers`
- `objections`
- `icp_signals`
- `current_marketing`
- `goals_and_outcomes`
- `action_items`
- `decisions`
- `notable_quotes`
- `generated_at`

Every sourced fact uses:

```ts
{
  value: string;
  source_url: string;
  retrieved_at: string;
}
```

Transcript quotes add:

```ts
{
  speaker: string;
  timestamp?: string;
}
```

## Verification gate
Before declaring the skill output usable:

```bash
npm run check
npm run validate
npm run sanity-check example/output.json
```

All commands must pass.
