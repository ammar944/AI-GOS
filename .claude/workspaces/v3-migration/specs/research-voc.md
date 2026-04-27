# research-voc Spec

## Skill

`skills/research-voc/`

## GOAL

Produce a sourced category voice-of-customer card for the locked GTM brief: raw problem-space language, workarounds, frustrations, desired outcomes, and status-quo complaints that are not tied to named competitors.

## NON-GOALS

- Does not resolve company identity. `ingest-identity` owns canonical company name, domain, category, core keywords, and negative keywords.
- Does not research competitor reviews, competitor complaints, pricing, ads, positioning, or share of voice. `research-competitor` owns that.
- Does not size the market or define demand drivers. `research-market` owns that.
- Does not produce persona strategy, ad hooks, messaging recommendations, or scripts. Synthesis and creative skills own those.
- Does not accept product-specific review mining. Review sites can only be used when the thread is category/problem-space discussion and does not name a competitor from the exclusion set.
- Does not write UI cards or Supabase rows directly. Runtime wiring and `present-workspace` own presentation.

## INPUT

- Upstream contract:
  - `research-worker/src/schemas/gtm/gtm-brief.ts`
  - `gtmBriefSchema`
- Runtime stage:
  - `research-voc` from `GTM_STAGE_KEYS` in `research-worker/src/schemas/gtm/gtm-run.ts`
- Required locked brief fields:
  - `fields.companyName`, `fields.companyUrl`, `fields.category`, `fields.productDescription`, `fields.targetCustomer`
  - `fields.primaryIcpDescription`, `fields.icpPains`, `fields.currentAlternative`, `fields.buyingTriggers`, `fields.icpObjections`
  - `fields.topCompetitors`, `fields.knownCompetitors`, `fields.alternatives`
- Optional locked brief fields:
  - `fields.market`, `fields.industryVertical`, `fields.geography`, `fields.useCases`, `fields.corePromise`
  - `fields.categoryFrames`, `fields.lossReasons`, `fields.competitorStrengths`, `fields.commonObjections`, `fields.keyPromises`
- Required prior skill output: `ingest-identity` output. Use canonical category, core keywords, and negative keywords.
- Optional prior skill output: `research-market` output. Use category definition, pains, demand drivers, and adoption barriers when present.
- Optional prior skill output: `research-competitor` output. Use `competitor_set` only to populate the exclusion list.
- Legacy runner inspected:
  - No `research-worker/src/runners/*voc*` runner exists.
  - Adjacent overlap path inspected: `research-worker/src/runners/competitors.ts`.
  - Competitor exclusion contract inspected: `skills/research-competitor/schemas/output.ts`.

## OUTPUT

- Downstream consumers: `research-cross`, `synthesize-positioning`, `synthesize-scripts`, and `present-workspace`.
- Zod schema reference: `skills/research-voc/schemas/output.ts`.
- Schema sketch:

```ts
const sourceSchema = z.object({
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

const sourcedClaimSchema = sourceSchema.extend({
  claim: z.string().min(1),
});

const vocQuoteSchema = sourceSchema.extend({
  quote: z.string().min(1),
  source_platform: z.enum(['reddit', 'hacker_news', 'forum', 'blog_comment', 'community', 'review_site', 'other']),
  problem_space: z.string().min(1),
  speaker_context: z.string().min(1).optional(),
  theme: z.string().min(1),
});

const workaroundSchema = sourceSchema.extend({
  workaround: z.string().min(1),
  pain_it_reveals: z.string().min(1),
  quote: z.string().min(1).optional(),
});

const exclusionSchema = z.object({
  term: z.string().min(1),
  source: z.enum(['research-competitor', 'brief', 'ingest-identity']),
  reason: z.string().min(1),
});

export const researchVocOutputSchema = z.object({
  run_id: z.string().min(1),
  brief_snapshot_id: z.string().min(1),
  stage: z.literal('research-voc'),
  company_name: z.string().min(1),
  category: z.string().min(1),
  exclusion_terms: z.array(exclusionSchema).min(1),
  category_pain_language: z.array(vocQuoteSchema).min(1),
  status_quo_frustrations: z.array(vocQuoteSchema),
  workarounds: z.array(workaroundSchema),
  desired_outcomes: z.array(sourcedClaimSchema),
  objection_language: z.array(vocQuoteSchema),
  source_gaps: z.array(z.object({
    topic: z.enum(['reddit', 'hacker_news', 'forum', 'review_site', 'community']),
    reason: z.string().min(1),
    attempted_queries: z.array(z.string().min(1)),
  })),
  rejected_competitor_matches: z.array(sourceSchema.extend({
    rejected_term: z.string().min(1),
    matched_competitor: z.string().min(1),
  })),
  generated_at: z.string().datetime(),
});
```

Every quote, complaint, workaround, outcome, rejection, and source-gap claim uses `source_url` + `retrieved_at`. The schema rejects output where any quote or claim contains a competitor name from `exclusion_terms`.

## HYBRID CHOICE

`heavy` — this skill needs deterministic competitor-name exclusion, source-platform filtering, quote hygiene, and rejection logging before the output can be trusted.

## FILES TO CREATE

- `skills/research-voc/SKILL.md`
- `skills/research-voc/README.md`
- `skills/research-voc/package.json`
- `skills/research-voc/tsconfig.json`
- `skills/research-voc/schemas/input.ts`
- `skills/research-voc/schemas/output.ts`
- `skills/research-voc/scripts/validate.ts`
- `skills/research-voc/scripts/sanity-check.ts`
- `skills/research-voc/scripts/orchestrate.ts`
- `skills/research-voc/scripts/build-exclusions.ts`
- `skills/research-voc/scripts/filter-competitor-leakage.ts`
- `skills/research-voc/references/collector.md`
- `skills/research-voc/references/rules.md`
- `skills/research-voc/example/input.json`
- `skills/research-voc/example/output.json`

No `generate-report.ts`, `assets/report-shell.html`, or screenshot script in Wave 2 unless implementation finds a real presentation need and updates this spec first.

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Duplicate only the schema primitives needed for `GtmBrief`, source fields, identity output, optional market output, optional competitor output, and VoC output.
- Category-scoped only. Search for problem-space language such as "how do teams handle X", "frustrated with X", "manual workaround for X", and "alternatives to the status quo"; do not search for named products.
- Build `exclusion_terms` from `research-competitor.competitor_set[*].name`, brief competitor fields, known alternatives, the subject company name, and identity negative keywords.
- Reject any quote, claim, workaround, or source title that contains an exclusion term after case folding and punctuation removal.
- Review sites are allowed only when the page discusses category or status quo patterns without naming a competitor from the exclusion list.
- Keep from `research-worker/src/runners/competitors.ts`: review-source skepticism and compact evidence handling.
- Drop from competitor behavior: competitor-specific review mining, target competitor names, ad libraries, pricing pages, and positioning moves.
- If no category-safe VoC sources remain after filtering, emit empty arrays plus `source_gaps`; do not backfill with competitor review quotes.

## STEPS

1. Confirm there is no legacy `research-worker/src/runners/*voc*` runner; inspect `research-worker/src/runners/competitors.ts` only for overlap boundaries.
   - Verify: implementation notes record the missing VoC runner and the adjacent competitor path inspected.
2. Define `schemas/input.ts` with `run_id`, `brief_snapshot_id`, locked `GtmBrief`, required `ingest_identity`, optional `research_market`, and optional `research_competitor`.
   - Verify: `example/input.json` validates without outside imports.
3. Define `scripts/build-exclusions.ts`.
   - Verify: competitor names, known alternatives, subject company, and negative keywords become normalized exclusion terms.
4. Define `schemas/output.ts` with `researchVocOutputSchema` and competitor-leakage refinement.
   - Verify: every factual nested object includes `source_url` and `retrieved_at`.
5. Write `scripts/filter-competitor-leakage.ts` and `scripts/sanity-check.ts`.
   - Verify: matching quotes move to `rejected_competitor_matches` or fail before final validation.
6. Write `references/rules.md`, `references/collector.md`, and `SKILL.md`.
   - Verify: rules forbid product-specific review mining and SKILL.md stays under 500 lines.
7. Add realistic fixture files and run skill-local checks.
   - Verify: fixtures use real URLs and ISO timestamps; check, validate, and sanity-check pass.

## VERIFY

```bash
cd skills/research-voc
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

Expected result:

- TypeScript compiles with no errors.
- `example/input.json` matches the input schema.
- `example/output.json` matches `researchVocOutputSchema`.
- `orchestrate` builds the exclusion list before output validation.
- Sanity-check exits 0 without `ALLOW_SUSPECT`.

## CONFORMANCE TESTS

- `missing-source-url`: remove `source_url` from one VoC quote; `npm run validate` must fail with the object path.
- `missing-retrieved-at`: remove `retrieved_at` from one workaround; `npm run validate` must fail with the object path.
- `competitor-name-leakage`: add a quote containing a competitor name from `exclusion_terms`; `npm run sanity-check` must fail and name the matched competitor.
- `subject-company-leakage`: add a quote containing the subject company name; `npm run sanity-check` must fail.
- `product-review-rejection`: add a review-site quote tied to a named product; `npm run sanity-check` must fail unless the product is absent from the normalized text.
- `placeholder-rejection`: set any sourced claim to `unknown`, `TBD`, `n/a`, or an empty string; `npm run sanity-check` must fail.
- `no-outside-imports`: scan `skills/research-voc/**/*.ts` for imports beginning with `../..`, `@/`, `src/`, `research-worker/`, or another `skills/` path; the check must fail if any exist.

## WAVE

Wave number: `2`.

## DEPENDENCIES

- Required upstream skills:
  - `ingest-identity`
- Required non-skill upstream state:
  - locked GTM brief snapshot from `lock-brief`
- Optional upstream skills:
  - `research-market`
  - `research-competitor`
- Blocked by:
  - none for Wave 2 spec execution. Quality improves when `research-competitor` has already supplied a competitor set for exclusions.
