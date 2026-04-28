---
name: synthesize-positioning
description: Use when creating AIGOS v3 positioning synthesis from a locked GTM brief and completed upstream research. Produces sourced positioning, value props, narrative arc, status-quo contrast, message angles, and blocked claims for the synthesize-strategy stage.
---

# Section 11 - Positioning Synthesis

## Trigger

`@synthesize-positioning { "run_id": "...", "brief_snapshot_id": "...", "stage": "synthesize-strategy", "gtm_brief": { ... }, "ingest_identity": { ... }, "research_icp": { ... }, "research_offer": { ... }, "research_cross": { ... } }`

Optional upstream sections: `research_voc` and `research_market`.

## What It Does

Transforms a locked GTM brief and completed upstream research into a sourced positioning synthesis for the AIGOS `synthesize-strategy` stage. The agent synthesizes the strategy; TypeScript validates schema shape, provenance coverage, placeholder rejection, forbidden-claim leaks, legacy field removal, and folder portability.

The output is the bridge between research and downstream planning. It gives later skills a stable strategic frame: positioning statement, one-line promise, ranked value props, narrative arc, status-quo contrast, message angles, and claim guardrails. It does not create media plans, scripts, budgets, channel choices, or launch tasks.

## Boundaries

This skill does not collect new research, browse the web, size the market, recommend platforms, build channel plans, write finished ad copy, produce keyword plans, create budgets, score readiness, render reports, persist Supabase rows, or modify runtime wiring. Adjacent skills own those jobs:

- `ingest-identity`: canonical company identity, domain, category, and keyword boundaries.
- `research-icp`: persona, pain, trigger, objection, attention, and current-alternative evidence.
- `research-offer`: offer, promise, proof, funnel, conversion path, and objection evidence.
- `research-cross`: cross-section synthesis, contradiction detection, proof gaps, and safe intersections.
- `research-voc`: optional customer language, objection language, review language, and first-person phrasing evidence.
- `research-market`: optional category, market frame, alternatives, and trend evidence.
- `synthesize-media-plan`: channel mix, campaign phases, audience-campaign matrix, sales process, and budgets.
- `synthesize-scripts`: finished ICM scripts and line-level provenance.
- `present-workspace`: workspace presentation and UI-ready formatting.

## Workflow

1. Parse the sealed input against `schemas/input.ts`.
2. Read `references/rules.md` and `references/collector.md`.
3. Build a source ledger from the locked GTM brief and upstream outputs.
4. Use only supplied evidence. Do not browse, fetch, infer from memory, or reuse facts from another run.
5. Convert the strongest supported intersections into JSON matching `schemas/output.ts`.
6. Write the run output as `output.json` in the caller-provided run directory, or update `example/output.json` only when maintaining the fixture.
7. Run `npm run validate` to validate the example fixture, or `npm run validate -- <output.json>` for a run artifact.
8. Run `npm run sanity-check <output.json> -- --input <input.json>` when validating a run artifact. For the fixture, run `npm run sanity-check example/output.json`.
9. Return only the validated JSON object to the caller.

## Tools

- File read tools: inspect the sealed input, upstream research artifacts, `references/rules.md`, `references/collector.md`, and the local schemas.
- File write tools: write only the run output JSON, or this skill folder when maintaining the skill.
- `Bash(npm run check)`, `Bash(npm run validate)`, and `Bash(npm run sanity-check <output.json>)`: deterministic gates.

Do not use `web_search`, browser inspection, Firecrawl, Perplexity, external APIs, root app imports, worker imports, or sibling skill imports for this synthesis.

## Hard Constraints

1. Keep the skill self-contained. Do not import from `src/`, `research-worker/`, root `lib/`, or another skill.
2. The output schema is the source of truth: `synthesizePositioningOutputSchema` in `schemas/output.ts`.
3. Top-level `run_id`, `brief_snapshot_id`, and `stage` must exactly match the input.
4. Top-level `company_name` and `category` must come from `gtm_brief.fields.companyName.value` and `gtm_brief.fields.category.value`.
5. Every nested synthesis object must include `derived_from` with at least one allowed source key.
6. Every nested synthesis object must include at least one evidence item.
7. Every evidence item must include a real `claim`, `source_url`, and `retrieved_at`.
8. Do not cite an input field as evidence unless that field has a usable source URL and retrieval timestamp, or an upstream output contains the same sourced claim.
9. Do not emit unsourced category, competitor, pricing, performance, numeric, benchmark, or customer-quote claims.
10. Forbidden claims from `gtm_brief.fields.forbiddenClaims` must not appear anywhere in output copy, including `claims_not_allowed`.
11. If evidence conflicts, use the more specific sourced claim and put the unsafe or unsupported pattern in `claims_not_allowed`.
12. If evidence is missing, omit the optional object or use an empty array where the schema allows it. Never write `unknown`, `TBD`, `n/a`, `none`, scaffold text, TODO text, or placeholders.
13. Do not emit legacy `platformRecommendations`, `readinessScorecard`, launch plans, scores, confidence ratings, budgets, scripts, keyword plans, or channel choices.

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

`ranked_value_props` adds:

- `rank`: integer from 1 to 7, with 1 as the strongest value prop.
- `icp_fit_reason`: sourced explanation of why the value prop maps to a pain, trigger, persona, current alternative, or objection.
- `objection_addressed`: optional sourced objection framing. Include it only when the input contains relevant objection evidence.

`narrative_arc` contains:

- `old_way`
- `cost_of_old_way`
- `new_way`
- `proof_bridge`
- `closing_frame`

## Synthesis Priorities

Prefer intersections that are supported by multiple upstream sections:

1. ICP pain or trigger plus offer proof.
2. Current alternative plus differentiation.
3. Objection plus proof or guardrail.
4. Category frame plus company identity.
5. Customer language plus product capability.
6. Cross-analysis conflict or proof gap plus downstream blocked claim.

Rank value props by evidence strength, ICP relevance, commercial specificity, objection pressure, and usefulness for downstream media planning. Do not rank by what sounds clever.

## Verification Gate

Before declaring the skill output usable:

```bash
npm run check
npm run validate
npm run sanity-check example/output.json
```

For a run artifact:

```bash
npm run validate -- <output.json>
npm run sanity-check <output.json> -- --input <input.json>
```

All commands must pass.
