# research-icp Spec

## Skill

`skills/research-icp/`

## GOAL

Produce a sourced ICP research card for the locked GTM brief: buyer personas, job titles, awareness stages, search intent, buying triggers, pains, objections, and current alternatives.

## NON-GOALS

- Does not resolve company identity. `ingest-identity` owns canonical company name, domain, category, core keywords, and negative keywords.
- Does not size the market or define category maturity. `research-market` / `research-market-category` owns that.
- Does not research competitors. `research-competitor` owns competitor landscape, pricing, reviews, ads, and share of voice.
- Does not mine Reddit/HN/reviews for category Voice of Customer. `research-voc` owns category-scoped VoC.
- Does not generate positioning, media plans, or scripts. Synthesis skills own downstream strategy and creative output.
- Does not write UI cards or Supabase rows directly. Runtime wiring and `present-workspace` own presentation.

## INPUT

- Upstream contract:
  - `research-worker/src/schemas/gtm/gtm-brief.ts`
  - `gtmBriefSchema`
- Runtime stage:
  - `research-buyer-icp` from `GTM_STAGE_KEYS` in `research-worker/src/schemas/gtm/gtm-run.ts`
- Required locked brief fields:
  - `fields.companyName`, `fields.companyUrl`, `fields.category`, `fields.productDescription`, `fields.targetCustomer`
  - `fields.primaryIcpDescription`, `fields.jobTitles`, `fields.icpRoles`, `fields.companySize`, `fields.buyingCommittee`
  - `fields.buyingTriggers`, `fields.icpPains`, `fields.currentAlternative`, `fields.awarenessLevel`, `fields.icpObjections`
- Optional locked brief fields:
  - `fields.market`, `fields.industryVertical`, `fields.geography`, `fields.useCases`, `fields.corePromise`, `fields.firstValueMoment`
  - `fields.activationEvent`, `fields.salesMotion`, `fields.gtmMotion`, `fields.topCompetitors`, `fields.knownCompetitors`, `fields.alternatives`
  - `fields.commonObjections`, `fields.keyPromises`
- Required prior skill output: `ingest-identity` output when available. Use only canonical company, domain, category, core keywords, and negative keywords.
- Optional prior skill output: `research-market` output when available. Use category framing only; do not depend on it for correctness.

## OUTPUT

- Downstream consumers: `research-cross`, `synthesize-positioning`, `synthesize-media-plan`, and `present-workspace`.
- Zod schema reference: `skills/research-icp/schemas/output.ts`.
- Schema sketch:

```ts
const sourceSchema = z.object({
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

const sourcedClaimSchema = sourceSchema.extend({
  claim: z.string().min(1),
});

const personaAnchorSchema = z.object({
  persona_name: z.string().min(1),
  role_family: z.string().min(1),
  seniority: z.string().min(1).optional(),
  company_context: z.array(sourcedClaimSchema),
  pains: z.array(sourcedClaimSchema),
  triggers: z.array(sourcedClaimSchema),
  objections: z.array(sourcedClaimSchema),
  current_alternatives: z.array(sourcedClaimSchema),
});

const awarenessStageSchema = z.object({
  stage: z.enum(['unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware']),
  evidence: z.array(sourcedClaimSchema),
  message_implication: z.string().min(1),
});

const jobTitleSchema = sourceSchema.extend({
  title: z.string().min(1),
  department: z.string().min(1).optional(),
  seniority: z.string().min(1).optional(),
  buying_role: z.enum(['economic_buyer', 'champion', 'user', 'technical_evaluator', 'procurement', 'influencer']),
});

const searchIntentSchema = sourceSchema.extend({
  query_pattern: z.string().min(1),
  intent: z.enum(['problem', 'solution', 'category', 'competitor', 'implementation', 'pricing']),
  likely_persona: z.string().min(1),
});

export const researchIcpOutputSchema = z.object({
  run_id: z.string().min(1),
  brief_snapshot_id: z.string().min(1),
  stage: z.literal('research-buyer-icp'),
  company_name: z.string().min(1),
  category: z.string().min(1),
  persona_anchors: z.array(personaAnchorSchema).min(1),
  awareness_stages: z.array(awarenessStageSchema).min(1),
  job_titles: z.array(jobTitleSchema).min(1),
  search_intent: z.array(searchIntentSchema).min(1),
  buying_committee_notes: z.array(sourcedClaimSchema),
  exclusions: z.array(sourcedClaimSchema),
  generated_at: z.string().datetime(),
});
```

Every factual item uses `source_url` + `retrieved_at`. `message_implication` can be derived, but it must point back to evidence in the same awareness-stage object.

## HYBRID CHOICE

`light` — this skill is an LLM collection and structuring pass plus Zod validation; it has no ad cache, name matching, document parser, screenshot renderer, or multi-fragment merge requirement.

## FILES TO CREATE

- `skills/research-icp/SKILL.md`
- `skills/research-icp/README.md`
- `skills/research-icp/package.json`
- `skills/research-icp/tsconfig.json`
- `skills/research-icp/schemas/input.ts`
- `skills/research-icp/schemas/output.ts`
- `skills/research-icp/scripts/validate.ts`
- `skills/research-icp/scripts/sanity-check.ts`
- `skills/research-icp/references/collector.md`
- `skills/research-icp/references/rules.md`
- `skills/research-icp/example/input.json`
- `skills/research-icp/example/output.json`

No `scripts/orchestrate.ts`, `merge-fragments.ts`, `generate-report.ts`, `assets/report-shell.html`, or screenshot script in Wave 1 unless implementation finds a real deterministic need and updates this spec first.

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Duplicate only the schema primitives needed for `GtmBrief`, source fields, and the ICP output contract.
- Facts only. No recommendations, no campaign plan, no positioning rewrite.
- No LLM scores, confidence percentages, TAM estimates, or persona importance scores.
- Claims about titles, pains, triggers, objections, alternatives, and search intent require `source_url` and `retrieved_at`.
- Use company/category evidence from public pages, job posts, help docs, customer pages, integration pages, review snippets, or search results. Do not invent buyer language from the product description alone.
- If a field cannot be sourced, omit it or emit an empty array. Do not use placeholders such as `unknown`, `TBD`, or `n/a` inside sourced arrays.
- Respect negative keywords from `ingest-identity`; do not include unrelated entities that share the same name.
- External fetch/search failures must throw with provider, query, status, and run id.

## STEPS

1. Read `research-worker/src/runners/icp.ts` and the GTM stage key `research-buyer-icp`.
   - Verify: implementation notes list every legacy path inspected.
2. Define `schemas/input.ts` with `run_id`, `brief_snapshot_id`, locked `GtmBrief` fields, optional `ingest_identity`, and optional `research_market`.
   - Verify: `example/input.json` validates without outside imports.
3. Define `schemas/output.ts` with `researchIcpOutputSchema` from this spec.
   - Verify: every factual nested object includes `source_url` and `retrieved_at`.
4. Write `references/rules.md` and `references/collector.md`.
   - Verify: rules forbid placeholders and each prompt section maps to one output key.
5. Write `SKILL.md` with trigger, boundaries, tools, workflow, schema references, and hard constraints.
   - Verify: SKILL.md stays under 500 lines.
6. Write `scripts/validate.ts` and `scripts/sanity-check.ts`.
   - Verify: malformed output, missing sources, placeholders, empty persona anchors, and missing job titles fail.
7. Add realistic fixture files and run skill-local checks.
   - Verify: fixtures use real URLs and ISO timestamps; check, validate, and sanity-check pass.

## VERIFY

```bash
cd skills/research-icp
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

Expected result:

- TypeScript compiles with no errors.
- `example/input.json` matches the input schema.
- `example/output.json` matches `researchIcpOutputSchema`.
- Sanity-check exits 0 without `ALLOW_SUSPECT`.

## CONFORMANCE TESTS

- `missing-source-url`: remove `source_url` from a persona pain claim; `npm run validate` must fail with the object path.
- `missing-retrieved-at`: remove `retrieved_at` from a job title; `npm run validate` must fail with the object path.
- `placeholder-rejection`: set any sourced claim to `unknown`, `TBD`, `n/a`, or an empty string; `npm run sanity-check` must fail.
- `persona-anchor-floor`: set `persona_anchors` to an empty array; `npm run sanity-check` must fail.
- `job-title-floor`: set `job_titles` to an empty array; `npm run sanity-check` must fail.
- `no-outside-imports`: scan `skills/research-icp/**/*.ts` for imports beginning with `../..`, `@/`, `src/`, `research-worker/`, or another `skills/` path; the check must fail if any exist.
- `no-fabricated-metrics`: add a scored persona field such as `fit_score: 9`; Zod must reject the unknown key.

## WAVE

Wave number: `1`.

## DEPENDENCIES

- Required upstream skills:
  - `ingest-identity`
- Required non-skill upstream state:
  - locked GTM brief snapshot from `lock-brief`
- Optional upstream skills:
  - `research-market`
- Blocked by:
  - none for Wave 1 spec execution.
