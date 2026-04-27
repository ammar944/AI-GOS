# synthesize-media-plan Spec

## Skill

`skills/synthesize-media-plan/`

## GOAL

Produce a sourced multi-phase paid media plan for the locked GTM brief: strategy frame, channel mix, audience-campaign matrix, creative angle system, sales-process guidance, industry benchmarks, rollout phases, and strategy snapshot.

## NON-GOALS

- Does not create positioning from scratch. `synthesize-positioning` owns positioning statement and narrative frame.
- Does not collect ICP, offer, keyword, competitor, or VoC evidence. Research skills own collection.
- Does not write finished ad scripts. `synthesize-scripts` owns script copy.
- Does not output retargeting, `formatSpecs`, `kpis`, or `cacFramework`; these were removed from the legacy media-plan contract.
- Does not publish numeric forecasts such as expected lead count, expected CAC, or expected revenue.
- Does not write Supabase partial rows. Runtime wiring owns persistence.

## INPUT

- Upstream contract:
  - `research-worker/src/schemas/gtm/gtm-brief.ts`
  - `gtmBriefSchema`
- Runtime stage:
  - `generate-media-plan` from `GTM_STAGE_KEYS` in `research-worker/src/schemas/gtm/gtm-run.ts`
- Current placeholder schema to replace during implementation:
  - `research-worker/src/schemas/gtm/media-plan.ts`
- Required locked brief fields:
  - `fields.companyName`, `fields.companyUrl`, `fields.category`, `fields.productDescription`, `fields.targetCustomer`
  - `fields.primaryIcpDescription`, `fields.jobTitles`, `fields.awarenessLevel`, `fields.icpPains`, `fields.buyingTriggers`
  - `fields.corePromise`, `fields.firstValueMoment`, `fields.activationEvent`, `fields.salesMotion`, `fields.gtmMotion`
  - `fields.conversionPath`, `fields.salesHandoff`, `fields.monthlyAdBudget`, `fields.avgAcv`, `fields.pricingModel`, `fields.salesCycleLength`
- Optional locked brief fields:
  - `fields.channels`, `fields.channelBudgetSplit`, `fields.whatIsWorking`, `fields.whatIsNotWorking`
  - `fields.currentCac`, `fields.monthlyRevenue`, `fields.marginAssumptions`, `fields.compliance`, `fields.brandGeography`
- Required prior skill output:
  - `synthesize-positioning`, `research-icp`, `research-offer`, `research-keywords`
- Optional prior skill output:
  - `research-competitor`, `research-voc`, `research-market`

## OUTPUT

- Downstream consumers: `synthesize-scripts`, `present-workspace`, and workspace media-plan cards.
- Zod schema reference: `skills/synthesize-media-plan/schemas/output.ts`.
- Schema sketch:

```ts
const sourceSchema = z.object({
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

const sourcedClaimSchema = sourceSchema.extend({
  claim: z.string().min(1),
});

const derivedClaimSchema = z.object({
  value: z.string().min(1),
  derived_from: z.array(z.enum([
    'synthesize-positioning',
    'research-icp',
    'research-offer',
    'research-keywords',
    'research-competitor',
    'research-voc',
    'research-market',
    'gtm-brief',
  ])).min(1),
  evidence: z.array(sourcedClaimSchema).min(1),
});

const campaignSchema = z.object({
  platform: z.enum(['meta', 'google', 'linkedin', 'youtube', 'tiktok', 'reddit', 'other']),
  name: z.string().min(1),
  objective: derivedClaimSchema,
  audience: derivedClaimSchema,
  budget_share_pct: z.number().min(0).max(100),
  single_campaign_rationale: derivedClaimSchema.optional(),
});

const rolloutPhaseSchema = z.object({
  phase: z.number().int().min(1).max(4),
  name: z.string().min(1),
  duration: z.string().min(1),
  objectives: z.array(derivedClaimSchema).min(1),
  campaigns: z.array(campaignSchema).max(2),
  decision_gate: derivedClaimSchema,
  google_phase_out_reason: derivedClaimSchema.optional(),
});

const benchmarkSchema = z.object({
  metric: z.string().min(1),
  range: sourcedClaimSchema,
  interpretation: derivedClaimSchema,
  levers_to_move_it: z.array(derivedClaimSchema).length(2),
});

export const synthesizeMediaPlanOutputSchema = z.object({
  run_id: z.string().min(1),
  brief_snapshot_id: z.string().min(1),
  stage: z.literal('generate-media-plan'),
  company_name: z.string().min(1),
  strategic_frame: z.object({
    business_model: derivedClaimSchema,
    awareness_level: derivedClaimSchema,
    sales_cycle_ceiling: derivedClaimSchema,
    in_market_tier_mix: derivedClaimSchema,
  }),
  channel_mix: z.array(derivedClaimSchema).min(1).max(3),
  audience_campaign_matrix: z.array(campaignSchema).min(1),
  creative_angle_system: z.array(derivedClaimSchema).min(3).max(8),
  sales_process_guidance: z.array(derivedClaimSchema).min(1),
  industry_benchmarks: z.array(benchmarkSchema).max(2),
  rollout_phases: z.array(rolloutPhaseSchema).min(2).max(4),
  strategy_snapshot: z.array(derivedClaimSchema).min(3).max(6),
  validation_warnings: z.array(z.string()),
  generated_at: z.string().datetime(),
});
```

Every plan recommendation uses `derived_from`. Every factual claim and benchmark uses `source_url` and `retrieved_at`.

## HYBRID CHOICE

`heavy` - the legacy runner has block generation, fabricated-claim sweeping, baseline metric injection, layout rules, qualitative reframe rules, budget gates, retargeting checks, benchmark gates, and snapshot consistency checks that must move into deterministic scripts.

## FILES TO CREATE

- `skills/synthesize-media-plan/SKILL.md`
- `skills/synthesize-media-plan/README.md`
- `skills/synthesize-media-plan/package.json`
- `skills/synthesize-media-plan/tsconfig.json`
- `skills/synthesize-media-plan/schemas/input.ts`
- `skills/synthesize-media-plan/schemas/output.ts`
- `skills/synthesize-media-plan/scripts/validate.ts`
- `skills/synthesize-media-plan/scripts/sanity-check.ts`
- `skills/synthesize-media-plan/scripts/orchestrate.ts`
- `skills/synthesize-media-plan/scripts/validate-budget-gates.ts`, `validate-removed-fields.ts`, `validate-snapshot.ts`
- `skills/synthesize-media-plan/references/block-prompts.md`, `guardrails.md`, `rules.md`
- `skills/synthesize-media-plan/example/input.json`
- `skills/synthesize-media-plan/example/output.json`

No `formatSpecs`, `kpis`, `cacFramework`, retargeting references, report renderer, or assets in Wave 3.

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Duplicate the schema primitives, budget gates, and removed-field checks needed for conformance.
- No retargeting or remarketing language anywhere in output unless a future spec adds an explicit confirmed-pool input.
- Do not include `formatSpecs`, `kpis`, or `cacFramework` in schemas, fixtures, references, or examples.
- Campaigns are capped at 2 per phase regardless of budget.
- If `awareness_level` is `unaware`, Google must be phased out of Phase 1 for that unaware audience and the plan must state why.
- Under $5k monthly budget: one platform, one campaign, one primary tier, no phase-1 budget bar.
- $5k to $15k monthly budget: max 2 platforms and max 2 campaigns per phase.
- Every channel must trace to ICP attention, keyword demand, competitor ad evidence, positioning, or brief constraints.
- Industry benchmarks are max 2 and must include interpretation plus exactly 2 process-side levers.
- Empty arrays are allowed for benchmarks when evidence does not support them.

## STEPS

1. Read `research-worker/src/runners/media-plan.ts`, `research-worker/src/contracts.ts`, `research-worker/src/validators/media-plan.ts`, `research-worker/src/schemas/gtm/media-plan.ts`, and `research-worker/src/schemas/gtm/gtm-run.ts`.
   - Verify: implementation notes list all inspected paths and call out removed legacy fields.
2. Define `schemas/input.ts` with locked brief, required upstream outputs, optional competitor/VoC/market outputs, and current marketing activity fields.
   - Verify: input rejects missing positioning, ICP, offer, or keyword outputs.
3. Define `schemas/output.ts` from this spec with no removed fields.
   - Verify: unknown keys are rejected and every recommendation includes `derived_from`.
4. Write `references/guardrails.md` from the media-plan legacy decisions.
   - Verify: guardrails include no retargeting, no `formatSpecs`, no `kpis`, no `cacFramework`, max 2 campaigns per phase, Google out of Phase 1 for unaware audiences, and budget concentration.
5. Write `scripts/orchestrate.ts` to run block-style generation, then deterministic gates.
   - Verify: orchestrator writes one final output and fails loudly with run id and failing gate.
6. Write deterministic validators for removed fields, campaign caps, budget gates, channel grounding, benchmark shape, and snapshot consistency.
   - Verify: each validator has a named fixture mutation that fails.
7. Add examples and run skill-local checks.
   - Verify: output contains no removed fields and all factual claims carry sources.

## VERIFY

```bash
cd skills/synthesize-media-plan
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

Expected result: TypeScript compiles, examples validate, removed-field gates pass, and the orchestrator fails loudly on any gate violation.

## CONFORMANCE TESTS

- `no-retargeting`: add `retargeting`, `remarketing`, `pixel audience`, or `visitor retarget` to any output string; `npm run sanity-check` must fail.
- `no-format-specs`: add `formatSpecs` under `creative_angle_system`; `npm run validate` must fail.
- `no-kpis`: add `kpis` under `industry_benchmarks` or top level; `npm run validate` must fail.
- `no-cac-framework`: add `cacFramework`; `npm run validate` must fail.
- `campaign-cap`: add 3 campaigns to any rollout phase; `npm run sanity-check` must fail.
- `unaware-google-phase-one`: set awareness to `unaware` and include Google in Phase 1 without `google_phase_out_reason`; `npm run sanity-check` must fail.
- `missing-derived-from`: remove `derived_from` from a campaign objective; `npm run validate` must fail.

## WAVE

Wave number: `3`.

## DEPENDENCIES

- Required upstream skills:
  - `synthesize-positioning`
  - `research-icp`
  - `research-offer`
  - `research-keywords`
- Required non-skill upstream state:
  - locked GTM brief snapshot from `lock-brief`
- Optional upstream skills:
  - `research-competitor`
  - `research-voc`
  - `research-market`
- Blocked by:
  - replacing the placeholder `mediaPlanOutputSchema` when this skill is wired.
