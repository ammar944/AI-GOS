---
name: synthesize-media-plan
description: Use when creating an AIGOS sourced paid media plan from a locked GTM brief after positioning, ICP, offer, and keyword research are available. Produces the `generate-media-plan` output and runs deterministic validation gates.
---

# Section 12 - Media Plan Synthesis

## Trigger

`@synthesize-media-plan { "run_id": "...", "brief_snapshot_id": "...", "stage": "generate-media-plan", "gtm_brief": { ... }, "synthesize_positioning": { ... }, "research_icp": { ... }, "research_offer": { ... }, "research_keywords": { ... } }`

## What It Does

Transforms a locked GTM brief and prior research into a sourced, multi-phase paid media plan: strategic frame, channel mix, audience-campaign matrix, creative angle system, sales-process guidance, industry benchmarks, rollout phases, and strategy snapshot. The agent synthesizes the plan; TypeScript validates schema shape, budget discipline, prohibited fields, source coverage, and snapshot consistency.

## Boundaries

This skill does not create positioning from scratch, collect ICP evidence, collect offer evidence, collect keyword evidence, write finished scripts, render reports, persist Supabase rows, or modify runtime wiring. Adjacent skills own those jobs:

- `synthesize-positioning`: positioning statement and narrative frame.
- `research-icp`: persona, pain, trigger, attention, and awareness evidence.
- `research-offer`: offer and conversion-path evidence.
- `research-keywords`: demand-intent and keyword evidence.
- `synthesize-scripts`: finished ad scripts.

## Workflow

1. Parse input against `schemas/input.ts`.
2. Read `references/rules.md`, `references/guardrails.md`, and `references/block-prompts.md`.
3. Produce JSON matching `schemas/output.ts`.
4. Run `npm run validate`.
5. Run `npm run sanity-check <output.json>`.
6. Run `npm run orchestrate -- <run_dir>` before returning a final artifact.

## Tools

- `web_search`: only to verify benchmark or platform evidence when upstream evidence is insufficient.
- Browser inspection tools: only to inspect source pages that become cited evidence.
- `Bash(npm run validate)`, `Bash(npm run sanity-check <output.json>)`, and `Bash(npm run orchestrate -- <run_dir>)`: deterministic gates.
- File writes: write only to the run directory or this skill folder when maintaining fixtures.

## Hard Constraints

1. Keep the skill self-contained. Do not import from `src/`, `research-worker/`, root `lib/`, or another skill.
2. Every recommendation must include `derived_from` and at least one sourced evidence claim with `source_url` and `retrieved_at`.
3. Do not emit numeric forecasts such as expected leads, expected acquisition cost, or expected revenue.
4. Campaigns are capped at two per rollout phase.
5. Under $5k monthly spend, concentrate on one platform and one campaign.
6. $5k to $15k monthly spend supports at most two platforms and at most two campaigns per phase.
7. For unaware audiences, Phase 1 must not use Google unless the plan explicitly says it is being phased out and why.
8. Use empty benchmark arrays when evidence does not support benchmarks.
9. Never use placeholder values such as unknown, TBD, n/a, scaffold text, or TODO text.
10. External fetch or search failures must throw with provider, query, status, and run id.

## Output

The output schema is `synthesizeMediaPlanOutputSchema` in `schemas/output.ts`.

Top-level fields:

- `run_id`
- `brief_snapshot_id`
- `stage: "generate-media-plan"`
- `company_name`
- `strategic_frame`
- `channel_mix`
- `audience_campaign_matrix`
- `creative_angle_system`
- `sales_process_guidance`
- `industry_benchmarks`
- `rollout_phases`
- `strategy_snapshot`
- `validation_warnings`
- `generated_at`

## Verification Gate

```bash
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

All commands must pass without override environment variables.
