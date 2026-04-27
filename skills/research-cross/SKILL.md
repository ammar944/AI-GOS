---
name: research-cross
description: Use when running AIGOS cross-analysis synthesis for a locked GTM brief after ingest-identity, research-market, research-icp, research-offer, research-competitor, research-voc, and research-keywords have produced valid sourced outputs. The skill compares completed cards and returns sourced overlaps, contradictions, gaps, themes, and readiness blockers without collecting new evidence.
---

# Section 10 - Cross-Analysis Synthesis

## Trigger

`@research-cross { "run_id": "...", "brief_snapshot_id": "...", "stage": "synthesize-strategy", "gtm_brief": { ... }, "ingest_identity": { ... }, "research_market": { ... }, "research_icp": { ... }, "research_offer": { ... }, "research_competitor": { ... }, "research_voc": { ... }, "research_keywords": { ... } }`

## What it does

Takes a sealed locked GTM brief and all seven required upstream research outputs, then returns a sourced cross-analysis card for `synthesize-strategy`: overlaps, contradictions, research gaps, high-confidence themes, and readiness blockers. It is a synthesis pass only. It never collects new facts and never creates a partial card when a required upstream output is missing.

## Boundaries

This skill does not resolve identity, collect market data, research competitors, mine Voice of Customer, collect keywords, write positioning, allocate budget, create scripts, render UI, or persist rows. Adjacent skills own those jobs:

- `ingest-identity`: canonical company, domain, category, core keywords, and negative keywords.
- `research-market`: category and market context.
- `research-icp`: buyer personas, pains, triggers, job titles, and search intent.
- `research-offer`: offer, funnel, proof, objection, and activation evidence.
- `research-competitor`: competitor set, alternatives, pricing, ads, reviews, and comparison evidence.
- `research-voc`: customer language, objections, reviews, and category Voice of Customer.
- `research-keywords`: demand intent, keyword clusters, and SERP intent evidence.
- `synthesize-positioning`, `synthesize-media-plan`, `synthesize-scripts`: downstream strategy and creative.

## Workflow

1. Parse the input against `schemas/input.ts`.
2. Read `references/rules.md` and `references/collector.md`.
3. Confirm all seven required upstream skill outputs are present and valid.
4. Compare the upstream claims for overlaps, contradictions, gaps, themes, and risks.
5. Write a JSON object matching `schemas/output.ts`.
6. Run `npm run validate`.
7. Run `npm run sanity-check <output.json>`.
8. Return the validated JSON to the caller.

## Tools

- File read tools: read the locked brief and upstream output JSON supplied for the run.
- Bash gates: `npm run validate`, `npm run sanity-check <output.json>`, and `npm run check`.
- File write tools: write only inside the run directory or this skill folder when updating fixtures.

Do not use web search, browser collection, external APIs, provider logs, ad tools, keyword tools, or scraping tools from this skill. Upstream skills own evidence collection.

## Hard constraints

1. Missing required upstream output fails the run before output validation.
2. Every `cross_findings` and `high_confidence_themes` item must derive from at least two distinct upstream skills.
3. Every provenance and evidence object must include `source_url` and `retrieved_at`.
4. Contradictions must include both sides and exact provenance. Do not resolve conflicts unless an input card already contains the resolution.
5. No new research, new facts, strategy recommendations, platform recommendations, budget allocation, scripts, or launch plans.
6. No readiness scores, numeric priorities, numeric confidence fields, provider/tool logs, query logs, or unknown top-level output fields.
7. Do not write placeholders: `unknown`, `TBD`, `n/a`, scaffold text, `Not verified`, empty strings, or sample filler.
8. Keep this skill self-contained. Do not import from `src/`, `research-worker/`, root `lib/`, or another skill.

## Output

The output schema is `researchCrossOutputSchema` in `schemas/output.ts`.

Top-level fields:

- `run_id`
- `brief_snapshot_id`
- `stage: "synthesize-strategy"`
- `company_name`
- `category`
- `input_manifest`
- `cross_findings`
- `contradictions`
- `research_gaps`
- `high_confidence_themes`
- `readiness_blockers`
- `generated_at`

Every factual nested object uses the shared source primitive:

```ts
{
  source_url: string;
  retrieved_at: string;
}
```

## Legacy paths inspected

- `research-worker/src/runners/synthesize.ts`
- `research-worker/src/schemas/gtm/strategy-synthesis.ts`
- `research-worker/src/schemas/gtm/research-sections.ts`
- `research-worker/src/schemas/gtm/gtm-run.ts`

Kept from the legacy runner: cross-section comparison, missing-section penalties, readiness framing, and strategic narrative input shape. Dropped: platform recommendations, budget allocation, readiness scores, model-generated priorities, and new unsourced claims.

## Verification gate

Before declaring the skill output usable:

```bash
npm run check
npm run validate
npm run sanity-check example/output.json
```

All commands must pass without `ALLOW_SUSPECT=1`.
