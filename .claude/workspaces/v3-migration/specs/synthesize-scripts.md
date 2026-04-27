# synthesize-scripts Spec

## Skill

`skills/synthesize-scripts/`

## GOAL

Produce a sourced ICM-structured ad script pack for the locked GTM brief: 60/30/10 hook, middle, and CTA scripts with per-line provenance.

## NON-GOALS

- Does not create positioning. `synthesize-positioning` owns the narrative frame and value props.
- Does not collect VoC, ICP, or offer evidence. Research skills own collection.
- Does not build the media plan. `synthesize-media-plan` owns channel and phase decisions.
- Does not keep the old Supabase script-pack write path or realtime callbacks from `src/app/api/scripts/generate/route.ts`.
- Does not emit ungrounded proof, made-up testimonials, fake metrics, or copied competitor hooks.
- Does not write workspace UI or persist script packs directly.

## INPUT

- Upstream contract:
  - `research-worker/src/schemas/gtm/gtm-brief.ts`
  - `gtmBriefSchema`
- Runtime stage:
  - `generate-scripts` from `GTM_STAGE_KEYS` in `research-worker/src/schemas/gtm/gtm-run.ts`
- Current placeholder schema to replace during implementation:
  - `research-worker/src/schemas/gtm/script-pack.ts`
- Current frontend schema to preserve where useful:
  - `src/lib/scripts/schemas.ts`
- Required locked brief fields:
  - `fields.companyName`, `fields.companyUrl`, `fields.category`, `fields.productDescription`, `fields.targetCustomer`
  - `fields.primaryIcpDescription`, `fields.awarenessLevel`, `fields.icpPains`, `fields.buyingTriggers`, `fields.icpObjections`
  - `fields.corePromise`, `fields.keyPromises`, `fields.commonObjections`, `fields.tone`, `fields.forbiddenClaims`
  - `fields.testimonials`, `fields.caseStudies`, `fields.metrics`, `fields.claims`, `fields.styleReferences`
- Optional locked brief fields:
  - `fields.brandPositioning`, `fields.compliance`, `fields.brandGeography`, `fields.cta`, `fields.conversionPath`
- Required prior skill output:
  - `research-voc`, `research-icp`, `research-offer`, `synthesize-positioning`
- Optional prior skill output:
  - `synthesize-media-plan`, `research-competitor`, `research-keywords`

## OUTPUT

- Downstream consumers: script workspace, `present-workspace`, and script regeneration tools.
- Zod schema reference: `skills/synthesize-scripts/schemas/output.ts`.
- Schema sketch:

```ts
const sourceSchema = z.object({
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

const sourcedClaimSchema = sourceSchema.extend({
  claim: z.string().min(1),
});

const derivedLineSchema = z.object({
  text: z.string().min(1),
  role: z.enum(['hook', 'middle', 'cta']),
  derived_from: z.array(z.enum([
    'research-voc',
    'research-icp',
    'research-offer',
    'synthesize-positioning',
    'synthesize-media-plan',
    'research-competitor',
    'research-keywords',
    'gtm-brief',
  ])).min(1),
  evidence: z.array(sourcedClaimSchema).min(1),
});

const scriptSchema = z.object({
  id: z.string().min(1),
  awareness_level: z.enum(['unaware', 'problem', 'solution', 'product', 'mostAware']),
  in_market_tier: z.enum(['in-market', 'needs-convinced', 'cold-mass']),
  platform: z.enum(['meta', 'google', 'linkedin']),
  format: z.enum(['video', 'static', 'email']),
  angle: z.enum(['painPoint', 'outcome', 'socialProof', 'curiosity', 'urgency', 'identity', 'contrarian']),
  framework: z.string().min(1),
  duration: z.enum(['10s', '30s', '60s']),
  hook: derivedLineSchema,
  middle: z.array(derivedLineSchema).min(1),
  cta: derivedLineSchema,
  hook_variants: z.array(derivedLineSchema).max(5),
  objection_handled: derivedLineSchema.optional(),
  flagged_claims: z.array(z.object({
    claim: z.string().min(1),
    reason: z.string().min(1),
  })),
  quality_gate: z.object({
    passed: z.boolean(),
    violations: z.array(z.string()),
    auto_fixes: z.number().int().min(0),
  }),
});

export const synthesizeScriptsOutputSchema = z.object({
  run_id: z.string().min(1),
  brief_snapshot_id: z.string().min(1),
  stage: z.literal('generate-scripts'),
  company_name: z.string().min(1),
  scripts: z.array(scriptSchema).min(9).max(15),
  dynamic_creative_sets: z.array(z.object({
    platform: z.enum(['meta', 'google', 'linkedin']),
    script_ids: z.array(z.string().min(1)).min(1),
  })),
  matrix_warnings: z.array(z.string()),
  style_references_used: z.array(sourcedClaimSchema),
  generated_at: z.string().datetime(),
});
```

Every script line uses `derived_from`. Every factual claim supporting a line uses `source_url` and `retrieved_at`.

## HYBRID CHOICE

`heavy` - the existing ICM pipeline uses deterministic matrix planning, claim extraction, post-processing, text quality gates, deduping, and platform character checks that must stay outside the prompt.

## FILES TO CREATE

- `skills/synthesize-scripts/SKILL.md`
- `skills/synthesize-scripts/README.md`
- `skills/synthesize-scripts/package.json`
- `skills/synthesize-scripts/tsconfig.json`
- `skills/synthesize-scripts/schemas/input.ts`
- `skills/synthesize-scripts/schemas/output.ts`
- `skills/synthesize-scripts/scripts/validate.ts`
- `skills/synthesize-scripts/scripts/sanity-check.ts`
- `skills/synthesize-scripts/scripts/orchestrate.ts`
- `skills/synthesize-scripts/scripts/build-matrix.ts`, `extract-claims.ts`, `quality-gate.ts`
- `skills/synthesize-scripts/references/icm-rules.md`, `copy-rules.md`, `platform-limits.json`, `kill-list.json`
- `skills/synthesize-scripts/example/input.json`
- `skills/synthesize-scripts/example/output.json`

No Supabase write scripts, realtime callbacks, or imports from the legacy `research-worker/src/scripts/` pipeline.

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Duplicate the ICM planner, claim extractor, platform limits, kill list, and quality-gate primitives needed for conformance.
- Script pack must contain 9 to 15 scripts, with 3 scripts per selected awareness tier when generating the full pack.
- Each script must have clear 60/30/10 structure: hook, middle, CTA. Duration may be `10s`, `30s`, or `60s`, but the logical sections remain.
- Each hook, middle line, CTA, and hook variant must include `derived_from` and at least one sourced evidence item.
- Do not fabricate proof points, quotes, metrics, or customer outcomes.
- Do not copy competitor hooks. Competitor hooks can only appear as counter-positioning evidence.
- Do not use forbidden claims from `fields.forbiddenClaims`.
- Quality gate must remove em dashes and flag banned phrases, template openers, rule-of-three phrasing, corporate filler, chatbot closers, and platform character-limit failures.
- Output may include `flagged_claims` for unsupported ideas, but flagged claims must not appear in finished copy.

## STEPS

1. Read `research-worker/src/scripts/pipeline.ts`, `research-worker/src/scripts/types.ts`, `research-worker/src/scripts/stages/01-plan/planner.ts`, `research-worker/src/scripts/stages/02-claims/claim-extractor.ts`, `research-worker/src/scripts/stages/03-write/creative-writer.ts`, `research-worker/src/scripts/stages/05-quality-gate/quality-gate.ts`, `src/lib/scripts/schemas.ts`, and `research-worker/src/schemas/gtm/script-pack.ts`.
   - Verify: implementation notes list inspected paths and call out that `script-pack.ts` is placeholder-only.
2. Define `schemas/input.ts` with locked brief, required upstream outputs, optional media plan, optional competitor/keyword context, style references, proof points, and brand voice notes.
   - Verify: input rejects missing VoC, ICP, offer, or positioning outputs.
3. Define `schemas/output.ts` from this spec.
   - Verify: every line-level object has `derived_from`, `source_url`, and `retrieved_at`.
4. Port deterministic planning into `scripts/build-matrix.ts`.
   - Verify: matrix covers required awareness tiers, rotates platforms/formats, and rejects duplicate angles inside a tier.
5. Port claim extraction into `scripts/extract-claims.ts`.
   - Verify: extracted claims preserve source URL, retrieval timestamp, upstream skill name, and source path.
6. Port quality checks into `scripts/quality-gate.ts`.
   - Verify: em dashes are fixed, platform limits fail when exceeded, and banned phrases are reported.
7. Write `SKILL.md` and prompt references for ICM writing.
   - Verify: prompt requires line-level provenance and forbids unsourced proof.
8. Add examples and run skill-local checks.
   - Verify: examples use real source URLs, ISO timestamps, and quality-gate metadata.

## VERIFY

```bash
cd skills/synthesize-scripts
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

Expected result: TypeScript compiles, examples validate, every script line has provenance and quality metadata, and the orchestrator fails loudly on matrix, provenance, or quality-gate violations.

## CONFORMANCE TESTS

- `missing-source-url`: remove `source_url` from `scripts[0].hook.evidence[0]`; `npm run validate` must fail.
- `missing-retrieved-at`: remove `retrieved_at` from a middle-line evidence item; `npm run validate` must fail.
- `missing-derived-from`: remove `derived_from` from any CTA; `npm run validate` must fail.
- `unproven-proof`: place a testimonial or result metric in copy without matching evidence; `npm run sanity-check` must fail.
- `forbidden-claim-leak`: place a forbidden brief claim in hook, middle, CTA, or hook variants; `npm run sanity-check` must fail.
- `quality-gate-dash`: insert an em dash into script copy; quality gate must auto-fix it or fail if auto-fix is disabled.
- `platform-limit`: exceed a platform field character limit; `npm run sanity-check` must fail with script id and field.

## WAVE

Wave number: `3`.

## DEPENDENCIES

- Required upstream skills:
  - `research-voc`
  - `research-icp`
  - `research-offer`
  - `synthesize-positioning`
- Required non-skill upstream state:
  - locked GTM brief snapshot from `lock-brief`
- Optional upstream skills:
  - `synthesize-media-plan`
  - `research-competitor`
  - `research-keywords`
- Blocked by:
  - replacing the placeholder `scriptPackOutputSchema` when this skill is wired.
