# Paid Media Plan Quality Hardening Design

## Goal

Make `positioningPaidMediaPlan` both rerunnable after the current live blocker and closer to the internal media-plan bar: source-backed, execution-ready, budget-consistent, and not just schema-shaped.

## Current State

The latest live paid-media run for `runId=0dc9720b-81a3-487f-ab1f-fac60329b25b` is still failed in Supabase. The latest section run is `55a61701-f975-412c-b46c-25320dc11e41`, and the error is:

`body.orderedMoves.moves[].learningPriority: must be a specific strategic judgment or explicit evidence gap, not a summary/restatement.`

The current checkout already has commit `f8f880f1`, which normalizes weak paid-media `learningPriority` values into explicit evidence-gap judgments before validation. That fix needs one authenticated post-fix rerun before it can be called live-proven.

The PMP validation worktree at `/Users/ammar/Dev-Projects/AI-GOS-pmp-validate` found a second class of issues: the plan can be strategically coherent while still failing a senior media-plan review. The weak points are spend math, empty creative-framework rows, bare competitor claims, generic funnel/channel advice, and incomplete source lineage for funnel/channel recommendations.

## Non-Goals

- Do not rebuild the whole paid-media product into the old 10-section `src/lib/media-plan/` pipeline.
- Do not add broad fresh web research to the paid-media capstone. Keep the
  existing bounded `keyword_ad_probe` contract unchanged for this patch; it is
  a two-call channel-truth probe already declared in the registry, not a new
  research surface.
- Do not change the six-section rollup count.
- Do not touch `research-worker/`; paid media runs in-process through the lab engine.
- Do not treat the validation rig alone as live proof. Supabase row status and matching section run status are authoritative.

## Architecture

Keep `positioningPaidMediaPlan` as a lab-engine synthesis capstone. It continues to read the six committed positioning artifacts, cross-section reasoning, onboarding economics, sales-process assets, and current funnel/channel inputs. The changes are limited to the production contract around the existing section:

- `src/lib/lab-engine/artifacts/schemas/paid-media-plan.ts` owns the shape and minimum validation.
- `src/lib/lab-engine/agents/run-section.ts` owns output normalization before strict parsing.
- `src/lib/lab-engine/skills/positioning-paid-media-plan/SKILL.md` owns the model-facing contract.
- `src/lib/lab-engine/fixtures/paid-media-plan-artifact.ts` and schema tests lock the behavior.
- `src/components/research-v2/section-renderers/paid-media-plan.tsx` renders any newly source-linked funnel/channel fields.

The design intentionally uses deterministic validators for production gates and prompt examples for generation quality. Validators should reject empty or generic output when the model could reasonably do better, but preserve honest gaps when the upstream evidence is absent.

## Contract Changes

### Source Lineage

`funnelIdeation.recommendations[]` and `channelSuggestions.suggestions[]` should carry `sourceUrl` like other synthesized paid-media items. This closes the gap where a recommendation can cite a section name but not point to a real source.

Compatibility: older persisted artifacts may lack `sourceUrl`. Renderer code should remain tolerant, but new generation and minimum validation should require real HTTP source URLs for new committed artifacts.

### Creative Framework

Each `creativeFramework.creatives[]` row must include type-appropriate fields:

- `unique-selling-point`: `uspSentence`
- `problem-solution-transformation`: `problem`, `solution`, `transformation`
- `objection-handling`: `objection`, `objectionAnswer`
- `founder-talking-head`: `founderScriptBeat`
- `product-demo`: at least `solution` or `transformation`

Each required field must be substantive, not a bare label.

### Spend Math

When numeric money siblings exist, validation should reconcile:

- `campaignOverview.dailySpendValue * 30` approximately equals `campaignOverview.monthlyBudgetValue`.
- `sum(audienceTypes.audiences[].dailyBudgetValue) * 30` approximately equals `campaignOverview.monthlyBudgetValue`.
- Each `campaignPhases.phases[].monthlyBudgetValue` approximately equals the overview monthly budget for that phase's month.

Use a small tolerance to avoid rounding failures. If numeric siblings are omitted because provenance is unknown, do not invent math.

### Provenance Normalization

If the normalizer defaults a money provenance field to `unknown`, it must not leave the paired numeric value in place. The schema already rejects `unknown` plus numeric values; the normalizer should avoid producing that invalid combination when the model omitted provenance.

### Competitor, Funnel, And Channel Quality

Minimum validation should catch the 1000x gate issues:

- Competitor review and marketing insights need specific signal, not generic claims.
- Funnel recommendations must name a buyer/segment and funnel stage, with a concrete opt-in-to-call path.
- Channel suggestions must name a specific asset, page, query, campaign, metric, or implementation target, and the recommendation must use an action verb.

These are heuristic validators, but they are targeted at production failure modes already observed in the PMP rig.

## Error Handling

Validation errors should stay actionable and path-specific, e.g.:

- `body.creativeFramework.creatives[0].uspSentence: required for unique-selling-point creative.`
- `body.audienceTypes.audiences: daily budgets must reconcile to monthly budget when numeric values are present.`
- `body.channelSuggestions.suggestions[1].recommendation: must name a specific asset or metric.`

The section may still commit as `needs_review` for evidence-support gaps, but it should not commit structurally empty creative, unreconciled spend math, or untraceable recommendations as clean paid-media output.

## Testing

Add focused tests in `src/lib/lab-engine/artifacts/schemas/__tests__/paid-media-plan.test.ts`:

- valid fixture still passes
- creative rows fail when type-specific fields are missing
- source URL is required by minimum validation for funnel/channel recommendations
- spend math fails when audience daily budgets do not reconcile
- unknown provenance plus numeric values is normalized or rejected as intended
- competitor/funnel/channel generic text fails

Update the fixture to satisfy the stronger bar.

Run focused tests first:

`npm run test:run -- src/lib/lab-engine/artifacts/schemas/__tests__/paid-media-plan.test.ts src/lib/lab-engine/agents/__tests__/run-section-corpus-only.test.ts src/components/research-v2/section-renderers/__tests__/paid-media-plan.test.tsx`

Then run the broader suite/build when the focused tests are green.

## Live Proof

After code and tests pass, run one authenticated paid-media rerun for:

`runId=0dc9720b-81a3-487f-ab1f-fac60329b25b`

Use `/api/research-v2/rerun-section` with:

```json
{
  "runId": "0dc9720b-81a3-487f-ab1f-fac60329b25b",
  "zone": "positioningPaidMediaPlan"
}
```

Proof requires a Supabase join where the current `research_artifact_sections.section_run_id` equals `research_section_runs.id`, and both rows show `complete` with null errors. Also verify:

- `data->>'sectionId' = positioningPaidMediaPlan`
- `jsonb_typeof(data->'body') = object`
- `sources` count is at least 5
- `counts_toward_rollup = false`

The live proof is not valid if an old `complete` artifact body remains while the current section row or section run is `error`.
