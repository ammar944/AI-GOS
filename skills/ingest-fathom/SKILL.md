---
name: ingest-fathom
description: >
  Fathom meeting ingestion - given a Fathom recording, extracts sourced sales-call intelligence with speaker-attributed transcript evidence for AIGOS brief enrichment.
version: 0.1.0
---

# ingest-fathom

> **Status**: Implemented 2026-04-28 - prompt-complete, schema-first, deterministic validation gate active.

## What this skill does

Given a Fathom recording identifier, recording URL, or sealed input payload, produces a typed `IngestFathomOutput` for the AIGOS `enrich-brief` stage. The output is a meeting evidence block: speakers, call type, business health, pains, budget signals, competitor mentions, buying triggers, objections, ICP signals, current marketing, goals, action items, decisions, and notable Voice-of-Customer quotes.

This is an ingestion skill, not a strategy skill. It extracts only what the recording transcript and metadata explicitly say. Downstream research and synthesis skills decide what the evidence means.

## Trigger

```bash
/ingest-fathom <input-spec>
```

Invoke when: attaching a Fathom sales, discovery, demo, strategy, kickoff, review, or follow-up call to a GTM Brief; enriching a brief with customer language; extracting call evidence for Voice of Customer, objections, ICP, offer, competitor, or media-plan work.

Do not invoke for: uploaded transcript files (use `ingest-docs`), company identity resolution (use `ingest-identity`), market research (use `research-market`), competitor research (use `research-competitor`), or synthesis/recommendations.

## Input handling

The source of truth is `schemas/input.ts` (`ingestFathomInputSchema`).

Preferred input is a sealed JSON object or a path to JSON:

```json
{
  "run_id": "run_2026_04_27_wave4_fathom",
  "recording_id": "rec_9f4b2c8a7e1d43f0",
  "brief_id": "brief_aigos_demo_001",
  "client_id": "client_northstar_ops",
  "meeting_type_hint": "discovery",
  "title": "Northstar Ops paid media discovery call"
}
```

If the user supplies only a Fathom share URL or recording id, normalize it into the schema before collection:

- `run_id`: generate a local run id such as `ingest_fathom_YYYYMMDDHHMMSS`.
- `recording_id`: use the explicit id or extract the terminal share id from the Fathom URL.
- `meeting_type_hint`: include only if the user supplied it or the recording metadata explicitly states it.
- `title`: include only if the user supplied it or Fathom metadata explicitly states it.

If `recording_id` cannot be determined, stop and ask for a valid Fathom recording id or sealed input. Do not invent one.

## Run artifacts

For local slash-command execution, use a per-run directory:

```text
skills/ingest-fathom/.runs/<run_id>/
  input.json
  output.json
```

Write only run artifacts in that directory unless the caller gives an explicit output path. Do not write to app, worker, database, or another skill folder.

## Tools used

- Fathom recording fetcher, browser session, or caller-supplied transcript packet - retrieve the recording metadata and transcript.
- `references/rules.md` - non-negotiable extraction and source rules.
- `references/collector.md` - main collection prompt and field-by-field mapping.
- File write tool - write `<runDir>/input.json` and `<runDir>/output.json`.
- `Bash(npm run validate -- <output.json>)` - Zod schema gate.
- `Bash(npm run sanity-check -- <output.json>)` - deterministic integrity gate.

If Fathom access fails, raise an explicit error including provider (`fathom`), `recording_id`, `run_id`, response status or failure reason, and whether the transcript or metadata fetch failed. Do not fabricate an empty passing output.

## Workflow

1. **Receive** - parse or normalize the invocation into `schemas/input.ts`.
2. **Prepare run directory** - write the sealed `input.json` for traceability.
3. **Fetch recording** - retrieve Fathom metadata and transcript using the available runtime wrapper, browser session, or caller-provided transcript packet.
4. **Verify source packet** - require a recording URL, retrieval timestamp, speaker labels when available, and transcript text or segments.
5. **Collect** - follow `references/collector.md` and extract only sourced facts from transcript or metadata.
6. **Assemble output** - write one JSON object matching `schemas/output.ts` to `<runDir>/output.json`.
7. **Validate** - run `npm run validate -- <runDir>/output.json`.
8. **Sanity-check** - run `npm run sanity-check -- <runDir>/output.json`.
9. **Present** - return the validated JSON path and a concise summary of what was extracted.

## Schema reference

- Input: `schemas/input.ts` (`ingestFathomInputSchema`)
- Output: `schemas/output.ts` (`ingestFathomOutputSchema`)
- Collection prompt: `references/collector.md`
- Deterministic rules: `references/rules.md`
- Fixture: `example/input.json`, `example/output.json`

## Hard constraints

- Facts only. No inferred decisions, budgets, goals, action items, speakers, competitor sentiment, objections, or outcomes.
- Every factual claim must include `source_url` and `retrieved_at`.
- Transcript-derived claims use the Fathom recording URL as `source_url`.
- Transcript evidence must keep speaker attribution. Include timestamps when available.
- Pain points, budget signals, competitor mentions, buying triggers, objections, goals, decisions, and action items require direct transcript quote evidence.
- Budget signals require exact quote evidence. Do not round, normalize, estimate, convert, or infer budget.
- Empty arrays are valid. Sparse sourced output is better than dense fake output.
- Never write placeholders: `unknown`, `TBD`, `n/a`, `not found`, scaffold text, TODO text, empty strings, or sample filler.
- Do not use external web research to fill missing call facts. This skill only ingests the recording.
- Do not write database rows, meeting status flags, `business_profile_documents`, `journey_sessions`, or Supabase records.
- Keep the skill self-contained. Do not import from the app source tree, worker source tree, root libraries, or another skill.

## Output contract

The final artifact is one JSON object matching `ingestFathomOutputSchema`.

Required top-level values:

```json
{
  "run_id": "run_xxx",
  "stage": "enrich-brief",
  "ingest_kind": "fathom",
  "recording_id": "rec_xxx",
  "recording_url": "https://fathom.video/share/...",
  "call_type": "discovery",
  "speakers": [],
  "pain_points": [],
  "budget_signals": [],
  "competitor_mentions": [],
  "buying_triggers": [],
  "objections": [],
  "icp_signals": {},
  "current_marketing": { "channels": [], "evidence": [] },
  "goals_and_outcomes": { "success_metrics": [], "evidence": [] },
  "action_items": [],
  "decisions": [],
  "notable_quotes": [],
  "generated_at": "2026-04-28T00:00:00.000Z"
}
```

Every sourced fact uses:

```json
{
  "value": "Exact sourced fact",
  "source_url": "https://fathom.video/share/...",
  "retrieved_at": "2026-04-28T00:00:00.000Z"
}
```

Transcript quote evidence extends sourced facts with:

```json
{
  "value": "Direct quote",
  "source_url": "https://fathom.video/share/...",
  "retrieved_at": "2026-04-28T00:00:00.000Z",
  "speaker": "Speaker Name",
  "timestamp": "00:12:31"
}
```

Optional fields should be omitted when not sourced. Required arrays should be empty when no valid evidence exists. Required objects should be present with only sourced optional fields and required arrays.

## Verification gate

Before declaring the skill output usable:

```bash
cd skills/ingest-fathom
npm run check
npm run validate -- <output.json>
npm run sanity-check -- <output.json>
```

For fixture verification:

```bash
cd skills/ingest-fathom
npm test
```
