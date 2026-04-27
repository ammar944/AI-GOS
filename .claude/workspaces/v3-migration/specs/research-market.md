# research-market Spec

## Skill

`skills/research-market/`

## GOAL

Finish the existing market/category skill so it produces a sourced market research card for the locked GTM brief: category framing, TAM context, direct or proxy market signals, trends, adjacent categories, demand drivers, buying triggers, adoption barriers, and source gaps.

## NON-GOALS

- Does not resolve company identity. `ingest-identity` owns canonical company name, domain, category, core keywords, and negative keywords.
- Does not research buyer personas or job titles. `research-icp` owns persona anchors, awareness stages, search intent, and buying committee notes.
- Does not research direct competitors. `research-competitor` owns competitor lists, pricing, reviews, ads, and share of voice.
- Does not mine deep customer quotes or broad objection evidence. `research-voc` owns category-scoped VoC.
- Does not diagnose the product offer. `research-offer` owns first-value path, pricing reality, proof, packaging, and offer objections.
- Does not write UI cards or Supabase rows directly. Runtime wiring and `present-workspace` own presentation.

## INPUT

- Upstream contract:
  - `research-worker/src/schemas/gtm/gtm-brief.ts`
  - `gtmBriefSchema`
- Runtime stage:
  - `research-market-category` from `GTM_STAGE_KEYS` in `research-worker/src/schemas/gtm/gtm-run.ts`
- Required locked brief fields:
  - `fields.companyName`, `fields.companyUrl`, `fields.category`, `fields.market`, `fields.industryVertical`
  - `fields.geography`, `fields.productDescription`, `fields.targetCustomer`, `fields.primaryIcpDescription`
- Optional locked brief fields:
  - `fields.useCases`, `fields.corePromise`, `fields.companySize`, `fields.buyingCommittee`, `fields.buyingTriggers`
  - `fields.icpPains`, `fields.currentAlternative`, `fields.awarenessLevel`, `fields.salesMotion`, `fields.gtmMotion`
  - `fields.topCompetitors`, `fields.knownCompetitors`, `fields.alternatives`, `fields.categoryFrames`
- Required prior skill output: `ingest-identity` output. Use canonical company, domain, category, core keywords, negative keywords, and identity exclusions.
- Optional prior skill output: none required.

## OUTPUT

- Downstream consumers: `research-icp`, `research-cross`, `research-keywords`, `synthesize-positioning`, `synthesize-media-plan`, and `present-workspace`.
- Zod schema reference: `skills/research-market/schemas/output.ts`.
- Schema sketch:

```ts
const sourceSchema = z.object({
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
  source_title: z.string().min(1).optional(),
  publisher: z.string().min(1).optional(),
});

const sourcedClaimSchema = sourceSchema.extend({
  claim: z.string().min(1),
  evidence_quote: z.string().min(1).optional(),
});

const marketSizeSignalSchema = sourceSchema.extend({
  label: z.enum(['sam', 'estimated_sam', 'proxy_estimate', 'tam_context']),
  market_scope: z.string().min(1),
  value: z.string().min(1),
  geography: z.string().min(1).optional(),
  period: z.string().min(1).optional(),
  basis: z.enum([
    'direct_market_report',
    'company_count_proxy',
    'buyer_count_proxy',
    'spend_proxy',
    'parent_market_context',
  ]),
  caveats: z.array(z.string().min(1)),
});

export const researchMarketOutputSchema = z.object({
  run_id: z.string().min(1),
  brief_snapshot_id: z.string().min(1),
  stage: z.literal('research-market-category'),
  source_company_name: z.string().min(1),
  market_scope: z.object({
    subject_company: z.string().min(1),
    category: z.string().min(1),
    geography: z.string().min(1).optional(),
    buyer_context: z.string().min(1).optional(),
    excluded_scopes: z.array(z.string().min(1)),
  }),
  category_definition: sourcedClaimSchema.extend({
    category_name: z.string().min(1),
    definition: z.string().min(1),
    adjacent_categories: z.array(z.string().min(1)),
  }),
  market_size_signals: z.array(marketSizeSignalSchema),
  category_maturity: sourcedClaimSchema.extend({
    maturity: z.enum(['emerging', 'growing', 'mature', 'saturated', 'unknown']),
    observable_signals: z.array(z.string().min(1)),
  }),
  timing_signals: z.array(sourcedClaimSchema),
  demand_drivers: z.array(sourcedClaimSchema),
  buying_triggers: z.array(sourcedClaimSchema),
  adoption_barriers: z.array(sourcedClaimSchema),
  adjacent_categories: z.array(sourcedClaimSchema),
  source_gaps: z.array(z.object({
    topic: z.enum(['market_size', 'category_definition', 'maturity', 'timing', 'demand_driver', 'barrier']),
    reason: z.string().min(1),
    attempted_queries: z.array(z.string().min(1)),
  })),
  generated_at: z.string().datetime(),
});
```

The current implementation already has richer fields and legacy projection fields. The finish pass should keep those fields while locking the same source rule: every factual claim has `source_url` and `retrieved_at`.

## HYBRID CHOICE

`light` — market context is a collection and schema-validation pass; the finish spec should add discipline around existing files, not add more fan-in, rendering, screenshot, or parser work.

## FILES TO CREATE

ALREADY EXISTS:

- `skills/research-market/SKILL.md`
- `skills/research-market/README.md`
- `skills/research-market/package.json`
- `skills/research-market/tsconfig.json`
- `skills/research-market/schemas/input.ts`
- `skills/research-market/schemas/output.ts`
- `skills/research-market/scripts/validate.ts`
- `skills/research-market/scripts/sanity-check.ts`
- `skills/research-market/references/collector.md`
- `skills/research-market/references/rules.md`
- `skills/research-market/example/output.json`

TO ADD OR HARDEN:

- `skills/research-market/example/input.json`
- Replace stub sections in `skills/research-market/SKILL.md`.
- Lock `stage: 'research-market-category'` in output schema or runtime wrapper.
- Ensure `ingest_identity` is required by `schemas/input.ts`.
- Add no-outside-import and no-placeholder checks to `scripts/sanity-check.ts`.
- Add conformance fixtures for missing sources, parent-market misuse, and scaffold output.

No new `scripts/orchestrate.ts`, `merge-fragments.ts`, `generate-report.ts`, screenshot script, or report assets in the Wave 1 finish pass. Existing files can stay for compatibility, but completion should not depend on adding more heavy pipeline surface.

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Duplicate only the schema primitives needed for `GtmBrief`, source fields, and the market output contract.
- Facts only. No strategy recommendations, campaign plans, or positioning rewrites.
- No LLM scores, confidence percentages, or false precision.
- Market-size values stay strings with scope, period, geography when available, and caveats.
- Parent-market figures must use `label: 'tam_context'`, `basis: 'parent_market_context'`, and a caveat saying the figure is broader than the direct niche.
- Claims about category definition, maturity, timing, demand drivers, buying triggers, barriers, pain points, and opportunities require `source_url` and `retrieved_at`.
- If no defensible sizing exists, leave `market_size_signals` empty and add a `source_gaps[]` entry for `market_size`.
- Keep competitor-specific facts out of this skill except broad category intensity signals.
- External fetch/search failures must throw with provider, query, status, and run id.

## STEPS

1. Read `research-worker/src/runners/industry.ts`, `research-worker/src/prompts/runners/industry-system.md`, `research-worker/src/contracts.ts`, and `research-worker/src/schemas/gtm/research-sections.ts`.
   - Verify: implementation notes list every legacy path inspected.
2. Read the current partial skill files: `skills/research-market/SKILL.md`, `schemas/input.ts`, `schemas/output.ts`, `scripts/validate.ts`, `scripts/sanity-check.ts`, `scripts/orchestrate.ts`, `references/collector.md`, and `references/rules.md`.
   - Verify: notes mark each file as ALREADY EXISTS or TO ADD.
3. Update `schemas/input.ts` to require `ingest_identity` and the locked brief snapshot fields needed for category scope.
   - Verify: `example/input.json` validates without outside imports.
4. Keep the existing rich output schema, but add a stage literal or equivalent runtime guard for `research-market-category`.
   - Verify: every factual nested object includes `source_url` and `retrieved_at`.
5. Replace the stub sections in `SKILL.md` with trigger, boundaries, tools, workflow, schema references, and hard constraints.
   - Verify: SKILL.md stays under 500 lines and names no forbidden imports.
6. Harden `scripts/sanity-check.ts`.
   - Verify: scaffold seed output fails without `ALLOW_SUSPECT`, parent-market misuse fails, and empty market sizing requires a source gap.
7. Add realistic `example/input.json` and conformance fixtures.
   - Verify: check, validate, and sanity-check pass on the non-scaffold fixture.

## VERIFY

```bash
cd skills/research-market
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
```

Expected result:

- TypeScript compiles with no errors.
- `example/input.json` matches the input schema.
- `example/output.json` matches the market output schema.
- Sanity-check exits 0 without `ALLOW_SUSPECT`.
- Scaffold seed output from `scripts/orchestrate.ts` fails sanity-check unless explicitly bypassed for a dev run.

## CONFORMANCE TESTS

- `missing-source-url`: remove `source_url` from `category_definition`; `npm run validate` must fail with the object path.
- `missing-retrieved-at`: remove `retrieved_at` from a `market_size_signals` item; `npm run validate` must fail with the object path.
- `market-size-gap-required`: set `market_size_signals` to an empty array and omit a `source_gaps` entry for `market_size`; `npm run sanity-check` must fail.
- `tam-context-caveat`: set a parent-market signal to `label: 'sam'` or omit the parent-market caveat; `npm run sanity-check` must fail.
- `scaffold-output-rejected`: run the current seed-only path without collector evidence; `npm run sanity-check` must fail unless `ALLOW_SUSPECT=1`.
- `placeholder-rejection`: set `source_company_name`, `market_scope.category`, or a market-size value to `unknown`, `TBD`, `n/a`, or scaffold text; `npm run sanity-check` must fail.
- `no-outside-imports`: scan `skills/research-market/**/*.ts` for imports beginning with `../..`, `@/`, `src/`, `research-worker/`, or another `skills/` path; the check must fail if any exist.

## WAVE

Wave number: `1`.

## DEPENDENCIES

- Required upstream skills:
  - `ingest-identity`
- Required non-skill upstream state:
  - locked GTM brief snapshot from `lock-brief`
- Optional upstream skills:
  - none
- Blocked by:
  - none for Wave 1 spec execution.
