# research-offer Spec

## Skill

`skills/research-offer/`

## GOAL

Produce a sourced offer diagnostic for the locked GTM brief: offer clarity, first-value path, activation friction, pricing reality, proof, value props, and public objections that could limit conversion.

## NON-GOALS

- Does not resolve company identity. `ingest-identity` owns canonical company name, domain, category, core keywords, and negative keywords.
- Does not size the market or define category maturity. `research-market` owns category framing, market sizing signals, trends, and adjacent categories.
- Does not research competitors from scratch. `research-competitor` owns competitor pricing, reviews, ads, and share of voice.
- Does not mine broad category Voice of Customer. `research-voc` owns Reddit, HN, review mining, and objection evidence across the category.
- Does not generate ad copy, guarantees, scripts, or positioning statements. `synthesize-positioning` and `synthesize-scripts` own downstream copy.
- Does not write UI cards or Supabase rows directly. Runtime wiring and `present-workspace` own presentation.

## INPUT

- Upstream contract:
  - `research-worker/src/schemas/gtm/gtm-brief.ts`
  - `gtmBriefSchema`
- Runtime stage:
  - `research-offer-funnel` from `GTM_STAGE_KEYS` in `research-worker/src/schemas/gtm/gtm-run.ts`
- Required locked brief fields:
  - `fields.companyName`, `fields.companyUrl`, `fields.category`, `fields.productDescription`, `fields.targetCustomer`
  - `fields.corePromise`, `fields.firstValueMoment`, `fields.activationEvent`, `fields.cta`
  - `fields.packaging`, `fields.pricingModel`, `fields.pricingTiers`, `fields.targetPlan`
- Optional locked brief fields:
  - `fields.useCases`, `fields.coreDeliverables`, `fields.retentionDrivers`, `fields.conversionPath`, `fields.landingPages`
  - `fields.salesMotion`, `fields.gtmMotion`, `fields.avgAcv`, `fields.acv`, `fields.salesCycleLength`, `fields.salesCycle`
  - `fields.testimonials`, `fields.caseStudies`, `fields.logos`, `fields.metrics`, `fields.claims`
  - `fields.commonObjections`, `fields.keyPromises`, `fields.whatIsWorking`, `fields.whatIsNotWorking`
- Required prior skill output: `ingest-identity` output when available. Use canonical company, domain, category, core keywords, and negative keywords.
- Optional prior skill output: `research-market` output when available. Use category framing and demand context only; do not require it for correctness.

## OUTPUT

- Downstream consumers: `research-cross`, `synthesize-positioning`, `synthesize-media-plan`, `synthesize-scripts`, and `present-workspace`.
- Zod schema reference: `skills/research-offer/schemas/output.ts`.
- Schema sketch:

```ts
const sourceSchema = z.object({
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

const sourcedClaimSchema = sourceSchema.extend({
  claim: z.string().min(1),
});

const sourcedValueSchema = sourceSchema.extend({
  label: z.string().min(1),
  value: z.string().min(1),
});

const pricingSignalSchema = sourceSchema.extend({
  plan_name: z.string().min(1).optional(),
  price_text: z.string().min(1),
  billing_period: z.string().min(1).optional(),
  caveats: z.array(z.string().min(1)),
});

const offerPathSchema = z.object({
  promise: z.array(sourcedClaimSchema),
  cta: z.array(sourcedClaimSchema),
  first_value_path: z.array(sourcedClaimSchema),
  activation_friction: z.array(sourcedClaimSchema),
});

const publicObjectionSchema = sourceSchema.extend({
  objection: z.string().min(1),
  evidence_type: z.enum(['pricing', 'proof', 'clarity', 'implementation', 'risk', 'alternative']),
});

export const researchOfferOutputSchema = z.object({
  run_id: z.string().min(1),
  brief_snapshot_id: z.string().min(1),
  stage: z.literal('research-offer-funnel'),
  company_name: z.string().min(1),
  offer_name: z.string().min(1).optional(),
  category: z.string().min(1),
  offer_path: offerPathSchema,
  value_props: z.array(sourcedValueSchema),
  proof_assets: z.array(sourcedClaimSchema),
  pricing_signals: z.array(pricingSignalSchema),
  packaging_notes: z.array(sourcedClaimSchema),
  public_objections: z.array(publicObjectionSchema),
  source_gaps: z.array(z.object({
    topic: z.enum(['pricing', 'proof', 'activation', 'objections', 'packaging']),
    reason: z.string().min(1),
    attempted_sources: z.array(z.string().min(1)),
  })),
  generated_at: z.string().datetime(),
});
```

Every factual item uses `source_url` and `retrieved_at`. Brief-stated inputs can guide search, but the output must cite public artifacts before treating them as external facts.

## HYBRID CHOICE

`light` — this skill is a collection and structuring pass plus Zod validation; it has no parser, screenshot renderer, ad cache, deterministic name matching, or multi-fragment merge requirement.

## FILES TO CREATE

- `skills/research-offer/SKILL.md`
- `skills/research-offer/README.md`
- `skills/research-offer/package.json`
- `skills/research-offer/tsconfig.json`
- `skills/research-offer/schemas/input.ts`
- `skills/research-offer/schemas/output.ts`
- `skills/research-offer/scripts/validate.ts`
- `skills/research-offer/scripts/sanity-check.ts`
- `skills/research-offer/references/collector.md`
- `skills/research-offer/references/rules.md`
- `skills/research-offer/example/input.json`
- `skills/research-offer/example/output.json`

No `scripts/orchestrate.ts`, `merge-fragments.ts`, `generate-report.ts`, `assets/report-shell.html`, screenshot script, or ad-library collection in Wave 1.

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Duplicate only the schema primitives needed for `GtmBrief`, source fields, and the offer output contract.
- Facts only. No scores, ICE ranking, action plans, copy generation, or launch verdict.
- Claims about pricing, value props, proof, CTAs, activation, packaging, and objections require `source_url` and `retrieved_at`.
- First-party pages are preferred for offer, pricing, CTA, proof, and packaging claims.
- Public sales decks, docs, help pages, pricing pages, product pages, changelogs, review pages, and search results are allowed sources.
- If verified pricing is unavailable, set `pricing_signals` to an empty array and add a `source_gaps[]` entry. Do not infer pricing from category norms.
- Do not analyze client ad creatives. Existing behavior in `research-worker/src/runners/offer.ts` delegates that to competitor intel.
- Respect negative keywords from `ingest-identity`; do not include unrelated entities that share the same name.
- External fetch/search failures must throw with provider, query, status, and run id.

## STEPS

1. Read `research-worker/src/runners/offer.ts`, `research-worker/src/prompts/runners/offer-system.md`, `research-worker/src/contracts.ts`, and `research-worker/src/schemas/gtm/research-sections.ts`.
   - Verify: implementation notes list every legacy path inspected.
2. Define `schemas/input.ts` with `run_id`, `brief_snapshot_id`, locked `GtmBrief`, required `ingest_identity`, and optional `research_market`.
   - Verify: fixture input validates without outside imports.
3. Define `schemas/output.ts` with `researchOfferOutputSchema` from this spec.
   - Verify: every factual nested object includes `source_url` and `retrieved_at`.
4. Write `references/rules.md` and `references/collector.md`.
   - Verify: first-party pricing collection happens before broader search when a pricing URL or company URL exists.
5. Write `SKILL.md` with trigger, boundaries, tools, workflow, schema references, and hard constraints.
   - Verify: SKILL.md names no forbidden imports and stays under 500 lines.
6. Write `scripts/validate.ts` and `scripts/sanity-check.ts`.
   - Verify: malformed output, missing sources, placeholders, generated copy, scores, and unsupported pricing fail.
7. Add realistic fixture files and run skill-local checks.
   - Verify: fixtures use real URLs and ISO timestamps; check, validate, and sanity-check pass.

## VERIFY

```bash
cd skills/research-offer
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

Expected result:

- TypeScript compiles with no errors.
- `example/input.json` matches the input schema.
- `example/output.json` matches `researchOfferOutputSchema`.
- Sanity-check exits 0 without `ALLOW_SUSPECT`.

## CONFORMANCE TESTS

- `missing-source-url`: remove `source_url` from a value prop; `npm run validate` must fail with the object path.
- `missing-retrieved-at`: remove `retrieved_at` from a pricing signal; `npm run validate` must fail with the object path.
- `pricing-gap-required`: set `pricing_signals` to an empty array and omit a `source_gaps` entry for `pricing`; `npm run sanity-check` must fail.
- `no-score-fields`: add `overallScore`, `painRelevance`, or `iceScore`; Zod must reject the unknown key.
- `no-generated-copy`: add `generatedOfferStatements` or ad headline fields; Zod must reject the unknown key.
- `placeholder-rejection`: set any sourced claim to `unknown`, `TBD`, `n/a`, or an empty string; `npm run sanity-check` must fail.
- `no-outside-imports`: scan `skills/research-offer/**/*.ts` for imports beginning with `../..`, `@/`, `src/`, `research-worker/`, or another `skills/` path; the check must fail if any exist.

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
