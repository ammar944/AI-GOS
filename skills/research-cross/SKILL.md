---
name: research-cross
description: Use when running AIGOS cross-analysis synthesis for a locked GTM brief after ingest-identity, research-market, research-icp, research-offer, research-competitor, research-voc, and research-keywords have produced valid sourced outputs. The skill compares completed cards and returns sourced overlaps, contradictions, gaps, themes, and readiness blockers without collecting new evidence.
---

# Section 10 - Cross-Analysis Synthesis

## Trigger

`@research-cross { "run_id": "...", "brief_snapshot_id": "...", "stage": "synthesize-strategy", "gtm_brief": { ... }, "ingest_identity": { ... }, "research_market": { ... }, "research_icp": { ... }, "research_offer": { ... }, "research_competitor": { ... }, "research_voc": { ... }, "research_keywords": { ... } }`

## What It Does

Turns a sealed locked GTM brief and seven completed upstream research outputs into a strict `synthesize-strategy` cross-analysis card. The card identifies repeated patterns, material contradictions, thin evidence areas, high-confidence themes, and blockers that downstream positioning, media-plan, script, and presentation skills must respect.

This is a synthesis-only skill. It reads supplied JSON cards, compares their sourced claims, preserves provenance, writes `output.json`, and runs deterministic validation. It does not browse, query providers, scrape pages, fill missing data, or create strategy recommendations.

## Required Inputs

The input must validate against `schemas/input.ts` before synthesis starts.

- `run_id`
- `brief_snapshot_id`
- `stage: "synthesize-strategy"`
- `gtm_brief`
- `ingest_identity`
- `research_market`
- `research_icp`
- `research_offer`
- `research_competitor`
- `research_voc`
- `research_keywords`

Each upstream output must include `skill`, `stage`, `output_path`, `generated_at`, and at least one sourced `key_claims` item. Missing or invalid upstream cards fail the run. Do not produce a partial output card.

## Boundaries

This skill does not resolve identity, define the category, validate personas, research offers, mine competitors, collect Voice of Customer, collect keyword data, write positioning, allocate budget, create scripts, render UI, or persist rows. Adjacent skills own those jobs:

- `ingest-identity`: canonical company, domain, category, core keywords, and negative keywords.
- `research-market`: category context, market framing, drivers, barriers, and market-level claims.
- `research-icp`: persona anchors, buyer pains, triggers, awareness, roles, and intent clues.
- `research-offer`: offer claims, funnel claims, proof, conversion path, objections, and activation evidence.
- `research-competitor`: competitor set, alternatives, pricing, ads, reviews, comparison evidence, and switching context.
- `research-voc`: raw customer language, category objections, status-quo frustration, desired outcomes, and objection evidence.
- `research-keywords`: demand-intent clusters, keyword opportunities, content gaps, negative keywords, and SERP intent evidence.
- `synthesize-positioning`: positioning statement, narrative frame, value props, status-quo contrast, and blocked claims.
- `synthesize-media-plan`: channel mix, campaign structure, rollout phases, and paid media strategy.
- `synthesize-scripts`: finished script concepts and line-level creative provenance.
- `present-workspace`: UI/report presentation of validated outputs.

## Workflow

1. Parse the input against `schemas/input.ts`.
2. Read `references/rules.md` and `references/collector.md`.
3. Build an `input_manifest` row for every required upstream skill.
4. Extract all upstream `key_claims`, plus specialized arrays such as `offer_claims`, `objection_evidence`, and `demand_intents` when present.
5. Group claims by business topic: category scope, target buyer, pain, trigger, offer promise, proof, competitor alternative, objection, demand intent, and downstream risk.
6. Create `cross_findings` only when at least two distinct upstream skills support the pattern or conflict.
7. Create `contradictions` only when two or more sourced upstream claims materially disagree.
8. Create `research_gaps` for missing or thin evidence that blocks a downstream decision.
9. Create `high_confidence_themes` for repeated sourced patterns that should anchor downstream synthesis.
10. Create `readiness_blockers` only for gaps or contradictions that make downstream positioning, media planning, scripts, or presentation unsafe.
11. Write JSON matching `schemas/output.ts`.
12. Run `npm run validate`.
13. Run `npm run sanity-check <output.json>`.
14. Return only the validated JSON artifact to the caller.

## Tools

- File read tools: inspect the locked input payload, upstream output JSON files when paths are available, `references/rules.md`, and `references/collector.md`.
- File write tools: write only the run `output.json` or this skill folder when maintaining fixtures.
- Bash gates: `npm run validate`, `npm run sanity-check <output.json>`, and `npm run check` when changing skill code or fixtures.

Do not use web search, browser collection, external APIs, provider logs, ad tools, keyword tools, scraper tools, or live page inspection from this skill. Any needed evidence must already exist inside the supplied upstream cards.

## Hard Constraints

1. Keep this skill self-contained. Do not import from `src/`, `research-worker/`, root `lib/`, or another skill.
2. Missing `ingest-identity`, `research-market`, `research-icp`, `research-offer`, `research-competitor`, `research-voc`, or `research-keywords` fails the run before output writing.
3. Every `cross_findings` and `high_confidence_themes` item must cite at least two distinct upstream skills in `derived_from`.
4. Every provenance and evidence object must include `source_url` and `retrieved_at`.
5. Contradictions must preserve all sides with exact provenance. Do not smooth over or silently resolve conflicting claims.
6. Do not create new market facts, pricing facts, competitor facts, customer quotes, metrics, recommendations, channel choices, budget allocations, scripts, or launch plans.
7. Do not emit readiness scores, numeric priorities, confidence percentages, provider/tool logs, query logs, raw API responses, or unknown top-level fields.
8. Do not write placeholders: `unknown`, `TBD`, `n/a`, `none`, empty strings, scaffold text, `Not verified`, `TODO`, or sample filler.
9. Research gaps and readiness blockers must point to missing inputs or contradictory sourced claims, not preferences.
10. `generated_at` must be an ISO datetime for the synthesis artifact, not copied blindly from an upstream card.

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

Every factual nested object uses this source primitive:

```ts
{
  source_url: string;
  retrieved_at: string;
}
```

Every provenance object uses:

```ts
{
  skill:
    | "ingest-identity"
    | "research-market"
    | "research-icp"
    | "research-offer"
    | "research-competitor"
    | "research-voc"
    | "research-keywords";
  output_path: string;
  evidence_id?: string;
  source_url: string;
  retrieved_at: string;
}
```

## Output Key Discipline

- `input_manifest`: one row per required upstream skill with status `present`, `missing`, or `invalid`. In normal valid output all seven rows should be `present`.
- `cross_findings`: material overlaps, contradictions, gaps, themes, or risks derived from multiple upstream cards.
- `contradictions`: exact conflicts that downstream synthesis cannot safely decide without resolution.
- `research_gaps`: missing evidence or thin upstream coverage that blocks a named downstream decision.
- `high_confidence_themes`: repeated sourced patterns strong enough to anchor downstream positioning or planning.
- `readiness_blockers`: unresolved gaps or contradictions that make downstream output unsafe.

## Legacy Paths Inspected

- `research-worker/src/runners/synthesize.ts`
- `research-worker/src/schemas/gtm/strategy-synthesis.ts`
- `research-worker/src/schemas/gtm/research-sections.ts`
- `research-worker/src/schemas/gtm/gtm-run.ts`

Kept from the legacy runner: cross-section comparison, missing-section penalties, readiness framing, and strategic narrative input shape. Dropped: platform recommendations, budget allocation, readiness scores, model-generated priorities, and new unsourced claims.

## Verification Gate

Before declaring the skill output usable:

```bash
npm run check
npm run validate
npm run sanity-check example/output.json
```

All commands must pass without `ALLOW_SUSPECT=1`.
