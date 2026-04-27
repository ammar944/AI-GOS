# research-cross Spec

## Skill

`skills/research-cross/`

## GOAL

Produce a sourced cross-analysis card from completed research outputs: overlaps, contradictions, gaps, high-confidence themes, and provenance trails across the GTM research set.

## NON-GOALS

- Does not collect new web evidence, call external APIs, scrape pages, or inspect live SERPs.
- Does not resolve identity. `ingest-identity` owns canonical company and category.
- Does not create new market, ICP, competitor, offer, VoC, or keyword facts. The source skills own those.
- Does not generate positioning copy, media budgets, scripts, or launch plans. Synthesis and creative skills own downstream strategy and execution.
- Does not use missing upstream sections as evidence. Missing inputs must create `source_gaps` and readiness blockers.
- Does not write UI cards or Supabase rows directly. Runtime wiring and `present-workspace` own presentation.

## INPUT

- Upstream contract:
  - `research-worker/src/schemas/gtm/gtm-brief.ts`
  - `gtmBriefSchema`
- Runtime stage:
  - `synthesize-strategy` from `GTM_STAGE_KEYS` in `research-worker/src/schemas/gtm/gtm-run.ts`
- Required locked brief fields:
  - `fields.companyName`, `fields.companyUrl`, `fields.category`, `fields.productDescription`, `fields.targetCustomer`
  - `fields.goals`, `fields.campaignObjective`, `fields.expectedOutput`, `fields.targetMarket`
- Required prior skill outputs:
  - `ingest-identity`
  - `research-market`
  - `research-icp`
  - `research-offer`
  - `research-competitor`
  - `research-voc`
  - `research-keywords`
- Optional prior skill output:
  - none for Wave 2. This skill is blocked until all required Wave 1 and Wave 2 sibling research cards are present.
- Legacy runner inspected:
  - `research-worker/src/runners/synthesize.ts`
  - `research-worker/src/schemas/gtm/strategy-synthesis.ts`
  - `research-worker/src/schemas/gtm/research-sections.ts`

## OUTPUT

- Downstream consumers: `synthesize-positioning`, `synthesize-media-plan`, `synthesize-scripts`, and `present-workspace`.
- Zod schema reference: `skills/research-cross/schemas/output.ts`.
- Schema sketch:

```ts
const sourceSchema = z.object({
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

const provenanceSchema = z.object({
  skill: z.enum([
    'ingest-identity',
    'research-market',
    'research-icp',
    'research-offer',
    'research-competitor',
    'research-voc',
    'research-keywords',
  ]),
  output_path: z.string().min(1),
  evidence_id: z.string().min(1).optional(),
}).merge(sourceSchema);

const crossFindingSchema = z.object({
  finding: z.string().min(1),
  finding_type: z.enum(['overlap', 'contradiction', 'gap', 'theme', 'risk']),
  derived_from: z.array(provenanceSchema).min(2),
  evidence: z.array(sourceSchema.extend({
    claim: z.string().min(1),
  })).min(1),
});

const contradictionSchema = z.object({
  topic: z.string().min(1),
  conflict: z.string().min(1),
  sides: z.array(z.object({
    claim: z.string().min(1),
    provenance: provenanceSchema,
  })).min(2),
  resolution_needed: z.string().min(1),
});

const gapSchema = z.object({
  gap: z.string().min(1),
  blocked_downstream_decision: z.string().min(1),
  missing_from_skills: z.array(z.string().min(1)).min(1),
});

export const researchCrossOutputSchema = z.object({
  run_id: z.string().min(1),
  brief_snapshot_id: z.string().min(1),
  stage: z.literal('synthesize-strategy'),
  company_name: z.string().min(1),
  category: z.string().min(1),
  input_manifest: z.array(z.object({
    skill: z.string().min(1),
    status: z.enum(['present', 'missing', 'invalid']),
    generated_at: z.string().datetime().optional(),
  })).min(7),
  cross_findings: z.array(crossFindingSchema).min(1),
  contradictions: z.array(contradictionSchema),
  research_gaps: z.array(gapSchema),
  high_confidence_themes: z.array(crossFindingSchema),
  readiness_blockers: z.array(gapSchema),
  generated_at: z.string().datetime(),
});
```

Every cross finding references the input skills it derives from through `derived_from`. The skill may derive a finding, but the derivation must point back to sourced claims in the input cards.

## HYBRID CHOICE

`light` — this skill is a local synthesis pass over already-collected JSON outputs with Zod validation and provenance checks; it has no external API, cache, parser, renderer, or multi-fragment fan-in need.

## FILES TO CREATE

- `skills/research-cross/SKILL.md`
- `skills/research-cross/README.md`
- `skills/research-cross/package.json`
- `skills/research-cross/tsconfig.json`
- `skills/research-cross/schemas/input.ts`
- `skills/research-cross/schemas/output.ts`
- `skills/research-cross/scripts/validate.ts`
- `skills/research-cross/scripts/sanity-check.ts`
- `skills/research-cross/references/collector.md`
- `skills/research-cross/references/rules.md`
- `skills/research-cross/example/input.json`
- `skills/research-cross/example/output.json`

No `scripts/orchestrate.ts`, `merge-fragments.ts`, `generate-report.ts`, `assets/report-shell.html`, or screenshot script in Wave 2 unless implementation finds a real deterministic need and updates this spec first.

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Duplicate only the schema primitives needed for `GtmBrief`, source fields, prior skill output summaries, and the cross-analysis output contract.
- No external collection. The collector may read only the locked brief snapshot and required prior skill output JSON.
- Keep from `research-worker/src/runners/synthesize.ts`: cross-section comparison, missing-section penalties, readiness framing, and strategic narrative input shape.
- Drop from `research-worker/src/runners/synthesize.ts`: platform recommendations, budget allocation, readiness scores, model-generated priorities, and any new unsourced claim.
- Every `cross_findings[*].derived_from` must name at least two input skills. Single-source observations belong in the source skill, not here.
- Contradictions must include both sides and their exact provenance. Do not resolve the conflict unless an input card already contains the resolution.
- Readiness blockers are allowed because this is a synthesis skill, but each blocker must cite the missing input or contradictory sourced claims.
- Missing required skill output fails the run. It does not produce a partial cross-analysis card.

## STEPS

1. Read `research-worker/src/runners/synthesize.ts`, `research-worker/src/schemas/gtm/strategy-synthesis.ts`, and stage key `synthesize-strategy`.
   - Verify: implementation notes list every legacy path inspected.
2. Define `schemas/input.ts` with `run_id`, `brief_snapshot_id`, locked `GtmBrief`, and all seven required prior skill outputs.
   - Verify: `example/input.json` fails when any required skill output is missing.
3. Define `schemas/output.ts` with `researchCrossOutputSchema` from this spec.
   - Verify: every derived finding has at least two provenance entries and each provenance entry has `source_url` and `retrieved_at`.
4. Write `references/rules.md` and `references/collector.md`.
   - Verify: rules forbid new research and every instruction maps to one output key.
5. Write `SKILL.md` with trigger, boundaries, tools, workflow, schema references, and hard constraints.
   - Verify: SKILL.md stays under 500 lines.
6. Write `scripts/validate.ts` and `scripts/sanity-check.ts`.
   - Verify: missing inputs, single-source findings, unsourced provenance, and readiness scores fail.
7. Add realistic fixture files and run skill-local checks.
   - Verify: fixtures use real URLs and ISO timestamps inherited from input cards; check, validate, and sanity-check pass.

## VERIFY

```bash
cd skills/research-cross
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

Expected result:

- TypeScript compiles with no errors.
- `example/input.json` includes all required prior skill outputs.
- `example/output.json` matches `researchCrossOutputSchema`.
- Sanity-check exits 0 without `ALLOW_SUSPECT`.

## CONFORMANCE TESTS

- `missing-required-input`: remove `research_voc` from `example/input.json`; `npm run validate` must fail before output validation.
- `single-source-finding`: set a cross finding to derive from only `research-market`; `npm run sanity-check` must fail.
- `missing-source-url`: remove `source_url` from one provenance entry; `npm run validate` must fail with the object path.
- `missing-retrieved-at`: remove `retrieved_at` from one evidence claim; `npm run validate` must fail with the object path.
- `new-research-rejection`: add `tool_calls_used`, `provider_status`, or an external query log to output; Zod must reject the unknown key.
- `readiness-score-rejection`: add `overallScore`, `priority`, or numeric confidence fields; Zod must reject the unknown key.
- `no-outside-imports`: scan `skills/research-cross/**/*.ts` for imports beginning with `../..`, `@/`, `src/`, `research-worker/`, or another `skills/` path; the check must fail if any exist.

## WAVE

Wave number: `2`.

## DEPENDENCIES

- Required upstream skills:
  - `ingest-identity`
  - `research-market`
  - `research-icp`
  - `research-offer`
  - `research-competitor`
  - `research-voc`
  - `research-keywords`
- Required non-skill upstream state:
  - locked GTM brief snapshot from `lock-brief`
- Optional upstream skills:
  - none
- Blocked by:
  - all required Wave 1 and Wave 2 sibling skills must have valid outputs before this skill runs.
