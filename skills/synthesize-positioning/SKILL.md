---
name: synthesize-positioning
description: Use when creating AIGOS v3 positioning synthesis from a locked GTM brief and completed upstream research. Produces sourced positioning, value props, narrative arc, status-quo contrast, message angles, and blocked claims for the synthesize-strategy stage.
---

# synthesize-positioning

## Trigger

`@synthesize-positioning { "run_id": "...", "brief_snapshot_id": "...", "stage": "synthesize-strategy", "gtm_brief": { ... } }`

## What it does

Takes a sealed locked GTM brief plus upstream outputs from `ingest-identity`, `research-icp`, `research-offer`, and `research-cross`, then produces a sourced positioning synthesis for `synthesize-strategy`. The output includes the positioning statement, one-line promise, ranked value props, narrative arc, status-quo contrast, message angles, and blocked claims.

## Boundaries

This skill does not collect new research, size the market, build channel plans, write ad scripts, create keyword plans, produce budgets, score readiness, render UI, or persist data. Adjacent skills own those jobs:

- `research-icp`: persona, pain, trigger, objection, and search-intent evidence.
- `research-offer`: offer, promise, proof, funnel, and objection evidence.
- `research-cross`: cross-section evidence and conflict detection.
- `research-voc`: optional customer language evidence.
- `research-market`: optional category framing.
- `synthesize-media-plan`: channel mix, campaign phases, launch sequencing, and budgets.
- `synthesize-scripts`: ICM scripts and line-level provenance.
- `present-workspace`: workspace presentation.

## Workflow

1. Parse the input against `schemas/input.ts`.
2. Read `references/rules.md` and `references/collector.md`.
3. Use only the locked brief and upstream outputs. Do not browse for new facts.
4. Convert evidence into synthesis objects that preserve `derived_from`.
5. Write a JSON object matching `schemas/output.ts`.
6. Run `npm run validate`.
7. Run `npm run sanity-check <output.json>`.
8. Return the validated JSON to the caller.

## Tools

- File read tools: inspect the locked input, upstream research artifacts, `references/rules.md`, and `references/collector.md`.
- File write tools: write only the run output JSON or this skill folder when updating fixtures.
- `Bash(npm run validate)` and `Bash(npm run sanity-check <output.json>)`: deterministic gates.

## Hard constraints

1. Keep this skill self-contained. Do not import from `src/`, `research-worker/`, root `lib/`, or another skill.
2. Every synthesis object must include `derived_from` with at least one upstream skill or `gtm-brief`.
3. Every evidence item must include `source_url` and `retrieved_at`.
4. Do not emit unsourced category, competitor, pricing, performance, or customer-quote claims.
5. Do not emit legacy `platformRecommendations`, `readinessScorecard`, launch plans, scores, budgets, scripts, keyword plans, or channel choices.
6. Forbidden claims from `fields.forbiddenClaims` must not appear in output copy.
7. If evidence conflicts, use the more specific sourced claim and put the unsafe or unsupported pattern in `claims_not_allowed`.
8. If evidence is missing, omit the optional object or use an empty array where the schema allows it. Never write `unknown`, `TBD`, `n/a`, scaffold text, or placeholders.

## Output

The output schema is `synthesizePositioningOutputSchema` in `schemas/output.ts`.

Top-level fields:

- `run_id`
- `brief_snapshot_id`
- `stage: "synthesize-strategy"`
- `company_name`
- `category`
- `positioning_statement`
- `one_line_promise`
- `ranked_value_props`
- `narrative_arc`
- `status_quo_contrast`
- `message_angles`
- `claims_not_allowed`
- `generated_at`

Every nested synthesis object uses this provenance shape:

```ts
{
  value: string;
  derived_from: Array<
    | "ingest-identity"
    | "research-icp"
    | "research-offer"
    | "research-cross"
    | "research-voc"
    | "research-market"
    | "gtm-brief"
  >;
  evidence: Array<{
    claim: string;
    source_url: string;
    retrieved_at: string;
  }>;
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
