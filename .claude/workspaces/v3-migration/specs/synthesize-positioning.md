# synthesize-positioning Spec

## Skill

`skills/synthesize-positioning/`

## GOAL

Produce a sourced positioning synthesis for the locked GTM brief: positioning statement, ranked value props, narrative arc, status-quo contrast, and message angles grounded in upstream research.

## NON-GOALS

- Does not collect new market, ICP, offer, keyword, or VoC evidence. Research skills own collection.
- Does not build paid channel plans. `synthesize-media-plan` owns channel mix, phases, and campaign structure.
- Does not write ad scripts. `synthesize-scripts` owns ICM scripts and line-level provenance.
- Does not keep legacy `platformRecommendations`, `readinessScorecard`, or launch task lists from `research-worker/src/runners/synthesize.ts`.
- Does not write Supabase rows or workspace UI cards directly. Runtime wiring and `present-workspace` own presentation.

## INPUT

- Upstream contract:
  - `research-worker/src/schemas/gtm/gtm-brief.ts`
  - `gtmBriefSchema`
- Runtime stage:
  - `synthesize-strategy` from `GTM_STAGE_KEYS` in `research-worker/src/schemas/gtm/gtm-run.ts`
- Current placeholder schema to replace during implementation:
  - `research-worker/src/schemas/gtm/strategy-synthesis.ts`
- Required locked brief fields:
  - `fields.companyName`, `fields.companyUrl`, `fields.category`, `fields.productDescription`, `fields.targetCustomer`
  - `fields.primaryIcpDescription`, `fields.icpPains`, `fields.buyingTriggers`, `fields.currentAlternative`, `fields.icpObjections`
  - `fields.corePromise`, `fields.uniqueEdge`, `fields.differentiation`, `fields.commonObjections`, `fields.keyPromises`
- Optional locked brief fields:
  - `fields.market`, `fields.industryVertical`, `fields.geography`, `fields.tone`, `fields.forbiddenClaims`
  - `fields.testimonials`, `fields.caseStudies`, `fields.metrics`, `fields.claims`, `fields.topCompetitors`, `fields.alternatives`
- Required prior skill output:
  - `ingest-identity`, `research-icp`, `research-offer`, `research-cross`
- Optional prior skill output:
  - `research-voc`, `research-market`

## OUTPUT

- Downstream consumers: `synthesize-media-plan`, `synthesize-scripts`, and `present-workspace`.
- Zod schema reference: `skills/synthesize-positioning/schemas/output.ts`.
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
    'ingest-identity',
    'research-icp',
    'research-offer',
    'research-cross',
    'research-voc',
    'research-market',
    'gtm-brief',
  ])).min(1),
  evidence: z.array(sourcedClaimSchema).min(1),
});

const rankedValuePropSchema = derivedClaimSchema.extend({
  rank: z.number().int().min(1).max(7),
  icp_fit_reason: derivedClaimSchema,
  objection_addressed: derivedClaimSchema.optional(),
});

const narrativeArcSchema = z.object({
  old_way: derivedClaimSchema,
  cost_of_old_way: derivedClaimSchema,
  new_way: derivedClaimSchema,
  proof_bridge: z.array(derivedClaimSchema),
  closing_frame: derivedClaimSchema,
});

export const synthesizePositioningOutputSchema = z.object({
  run_id: z.string().min(1),
  brief_snapshot_id: z.string().min(1),
  stage: z.literal('synthesize-strategy'),
  company_name: z.string().min(1),
  category: z.string().min(1),
  positioning_statement: derivedClaimSchema,
  one_line_promise: derivedClaimSchema,
  ranked_value_props: z.array(rankedValuePropSchema).min(3).max(7),
  narrative_arc: narrativeArcSchema,
  status_quo_contrast: z.array(derivedClaimSchema).min(2).max(5),
  message_angles: z.array(derivedClaimSchema).min(3).max(8),
  claims_not_allowed: z.array(derivedClaimSchema),
  generated_at: z.string().datetime(),
});
```

Every synthesis field uses `derived_from`. Every evidence item uses `source_url` and `retrieved_at`.

## HYBRID CHOICE

`light` - research inputs can be transformed into a positioning statement and narrative frame with prompt references plus Zod validation; no cache, parser, renderer, or multi-fragment merge is needed.

## FILES TO CREATE

- `skills/synthesize-positioning/SKILL.md`
- `skills/synthesize-positioning/README.md`
- `skills/synthesize-positioning/package.json`
- `skills/synthesize-positioning/tsconfig.json`
- `skills/synthesize-positioning/schemas/input.ts`
- `skills/synthesize-positioning/schemas/output.ts`
- `skills/synthesize-positioning/scripts/validate.ts`
- `skills/synthesize-positioning/scripts/sanity-check.ts`
- `skills/synthesize-positioning/references/collector.md`
- `skills/synthesize-positioning/references/rules.md`
- `skills/synthesize-positioning/example/input.json`
- `skills/synthesize-positioning/example/output.json`

No `scripts/orchestrate.ts`, `merge-fragments.ts`, `generate-report.ts`, or assets in Wave 3 unless implementation finds a deterministic need and updates this spec first.

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Duplicate the brief, source, and output primitives needed for conformance.
- Do not emit unsourced category claims, competitor claims, pricing claims, performance claims, or customer quotes.
- Do not produce launch plans, budgets, channel choices, scripts, or keyword plans.
- Do not keep legacy readiness scores from `research-worker/src/runners/synthesize.ts`; no LLM scores.
- Every synthesis object must include `derived_from` with at least one upstream skill or `gtm-brief`.
- Every evidence object must include `source_url` and `retrieved_at`.
- If upstream evidence conflicts, emit the more specific claim and record the losing claim in `claims_not_allowed` when it would create a false promise.
- Forbidden claims from `fields.forbiddenClaims` must never appear in output copy.
- Missing evidence becomes an empty array or omitted optional field. No placeholder text.

## STEPS

1. Read `research-worker/src/runners/synthesize.ts`, `research-worker/src/schemas/gtm/strategy-synthesis.ts`, `research-worker/src/schemas/gtm/gtm-brief.ts`, and `research-worker/src/schemas/gtm/gtm-run.ts`.
   - Verify: implementation notes list all inspected paths and call out that `strategy-synthesis.ts` is currently placeholder-only.
2. Define `schemas/input.ts` with `run_id`, `brief_snapshot_id`, locked `GtmBrief`, and required upstream outputs for identity, ICP, offer, and cross-analysis.
   - Verify: input rejects missing required upstream outputs.
3. Define `schemas/output.ts` from this spec.
   - Verify: every field carrying a claim contains `derived_from`, `source_url`, and `retrieved_at` through evidence.
4. Write `references/rules.md` with positioning boundaries, status-quo contrast rules, forbidden-claim handling, and legacy field drops.
   - Verify: rules ban `platformRecommendations`, scores, budgets, and script copy.
5. Write `references/collector.md` for the synthesis prompt.
   - Verify: every prompt section maps to exactly one output key.
6. Write `SKILL.md` with trigger, required inputs, workflow, and hard output contract.
   - Verify: SKILL.md stays under 500 lines and names no forbidden imports.
7. Add examples and run skill-local checks.
   - Verify: examples include real source URLs, ISO timestamps, and no placeholder evidence.

## VERIFY

```bash
cd skills/synthesize-positioning
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

Expected result:

- TypeScript compiles with no errors.
- `example/input.json` validates against the locked brief plus upstream output contract.
- `example/output.json` validates against `synthesizePositioningOutputSchema`.
- Sanity-check rejects unsourced and untraced claims.

## CONFORMANCE TESTS

- `missing-source-url`: remove `source_url` from a value-prop evidence item; `npm run validate` must fail with the object path.
- `missing-retrieved-at`: remove `retrieved_at` from `positioning_statement.evidence[0]`; `npm run validate` must fail with the object path.
- `missing-derived-from`: remove `derived_from` from `one_line_promise`; `npm run validate` must fail.
- `legacy-platform-recommendations`: add `platformRecommendations` to the output; Zod must reject the unknown key.
- `forbidden-claim-leak`: place a forbidden brief claim inside `message_angles`; `npm run sanity-check` must fail.
- `value-prop-floor`: set `ranked_value_props` below 3 items; `npm run sanity-check` must fail.
- `no-outside-imports`: scan `skills/synthesize-positioning/**/*.ts` for imports beginning with `../..`, `@/`, `src/`, `research-worker/`, or another `skills/` path; the check must fail if any exist.

## WAVE

Wave number: `3`.

## DEPENDENCIES

- Required upstream skills:
  - `ingest-identity`
  - `research-icp`
  - `research-offer`
  - `research-cross`
- Required non-skill upstream state:
  - locked GTM brief snapshot from `lock-brief`
- Optional upstream skills:
  - `research-voc`
  - `research-market`
- Blocked by:
  - replacing the placeholder `strategySynthesisOutputSchema` when this skill is wired.
