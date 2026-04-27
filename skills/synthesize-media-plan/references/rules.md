# Rules - synthesize-media-plan

## Inspected References

- `.claude/workspaces/v3-migration/specs/synthesize-media-plan.md`
- `.claude/workspaces/v3-migration/SPEC_TEMPLATE.md`
- `skills/research-competitor/`
- `skills/research-icp/`
- `research-worker/src/runners/media-plan.ts`
- `research-worker/src/contracts.ts`
- `research-worker/src/validators/media-plan.ts`
- `research-worker/src/schemas/gtm/media-plan.ts`
- `research-worker/src/schemas/gtm/gtm-run.ts`

## Runtime Contract

- Stage key is `generate-media-plan`.
- Required prior outputs are positioning, ICP, offer, and keyword research.
- Optional prior outputs are competitor, Voice of Customer, and market research.
- Output is JSON only and must match `schemas/output.ts`.

## Removed Legacy Surface

Wave 3 keeps the media plan focused on strategy, channel mix, campaign structure, creative angles, sales process guidance, benchmarks, rollout phases, and strategy snapshot. Legacy creative-production details, broad metric lists, acquisition-cost frameworks, and numeric forecasts are excluded from this contract.

## Source Rules

- Every recommendation must have `derived_from`.
- Every recommendation must have evidence with `source_url` and `retrieved_at`.
- Use real source URLs.
- If evidence does not support a benchmark, use an empty benchmark array.
- Do not fill gaps with placeholders.

## Budget Rules

- Campaigns are capped at two per rollout phase.
- Under $5k monthly spend: one channel, one platform, and one campaign.
- $5k to $15k monthly spend: at most two platforms and at most two campaigns per phase.
- Concentrate spend before expanding platforms.
- Underpowered platform splits must become validation warnings or be removed.

## Awareness Rules

- For unaware audiences, Phase 1 should not use Google.
- If Google appears in Phase 1 for an unaware audience, the phase must include an explicit phase-out reason.
- Cold education should come through the primary acquisition campaign when budget is too small for multi-platform learning.

## Channel Grounding

Every channel must trace to at least one of:

- ICP attention evidence.
- Demand-intent or keyword evidence.
- Competitor ad evidence.
- Positioning strategy.
- Locked brief constraints.

## Benchmark Rules

- Use at most two industry benchmarks.
- Each benchmark needs interpretation.
- Each benchmark needs exactly two process-side levers.
- Process-side levers should address offer, sales, activation, onboarding, retention, handoff, or proof.
