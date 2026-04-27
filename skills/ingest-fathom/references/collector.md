# Collector prompt - ingest-fathom

You are extracting sourced sales-call intelligence from a Fathom recording for the AIGOS `enrich-brief` stage. Return only data that maps to `schemas/output.ts`.

Every collection instruction maps to one output key.

## Input handling maps to `run_id`, `recording_id`, `recording_url`, `title`, `call_type`, `generated_at`

Use the runtime-supplied Fathom recording URL as the `source_url` for every transcript-derived claim. Use the recording fetch timestamp as `retrieved_at`. If a title is present in Fathom metadata, include it as `title`. Pick `call_type` only from explicit metadata or transcript context.

## Speaker mapping maps to `speakers`

Collect each explicitly identified speaker:

- `name`: the name or speaker label from Fathom.
- `role`: only if the transcript or metadata states the role.

Do not infer titles from context.

## Business health maps to `business_health_summary`

Include a concise summary only when the transcript explicitly discusses business health. Omit the field when it is not stated.

## Pain points map to `pain_points`

Collect explicit pains. Each entry needs:

- `pain`: the stated pain.
- `severity`: `critical`, `moderate`, or `minor` based only on stated urgency or impact.
- `evidence`: direct transcript quote with speaker attribution.

## Budget signals map to `budget_signals`

Collect exact spend, willingness to pay, pricing sensitivity, procurement limits, or budget cycle details. Every budget signal must include an exact quote. Do not round, normalize, estimate, or infer budget.

## Competitor mentions map to `competitor_mentions`

Collect named competitors or alternatives exactly as spoken. Each entry needs the spoken name, sentiment, optional context, and direct quote evidence.

## Buying triggers map to `buying_triggers`

Collect explicit triggers such as deadlines, internal initiatives, migration events, leadership pressure, bad performance, or upcoming launches. Each trigger needs direct quote evidence.

## Objections map to `objections`

Collect explicit objections and any explicit resolution. Each objection needs direct quote evidence. Omit resolution unless a speaker directly states it.

## ICP signals map to `icp_signals`

Collect only directly stated company size, buyer role, industry, decision process, and decision timeline. Omit fields that are not stated.

## Current marketing maps to `current_marketing`

Collect explicit channels, monthly spend, what works, and what fails. Keep `channels` and `evidence` as empty arrays if no current marketing details are present. Do not infer effectiveness.

## Goals and outcomes map to `goals_and_outcomes`

Collect primary goals, stated success metrics, and desired transformation. Include quote evidence for every included goal or outcome. Omit unstated fields.

## Action items map to `action_items`

Collect only explicit next steps. Each action item needs direct quote evidence. Include owner and due date only when stated.

## Decisions map to `decisions`

Collect only decisions explicitly made during the call. Each decision needs participants and direct quote evidence.

## Notable quotes map to `notable_quotes`

Collect speaker-attributed quotes that are valuable downstream for ICP, Voice of Customer, objections, offer, or competitor analysis.

## Final validation

Before returning output, run:

```bash
npm run validate
npm run sanity-check example/output.json
```

For a run artifact, replace `example/output.json` with the run output path.
