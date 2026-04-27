# research-keywords Spec

## Skill

`skills/research-keywords/`

## GOAL

Produce a sourced demand-intent research card for the locked GTM brief: high-intent search queries, intent classes, content gaps, paid keyword opportunities, negative keywords, and provider coverage.

## NON-GOALS

- Does not resolve company identity. `ingest-identity` owns canonical company name, domain, category, core keywords, and negative keywords.
- Does not define market size, category maturity, or category pain points. `research-market` owns that.
- Does not validate buyer personas. `research-icp` owns persona, title, awareness, and buying-trigger evidence.
- Does not research competitor positioning or review complaints. `research-competitor` owns competitor landscape and competitor-specific review mining.
- Does not generate media budgets, campaign structure, ad copy, or launch plan. `synthesize-media-plan` and downstream creative skills own those.
- Does not write UI cards or Supabase rows directly. Runtime wiring and `present-workspace` own presentation.

## INPUT

- Upstream contract:
  - `research-worker/src/schemas/gtm/gtm-brief.ts`
  - `gtmBriefSchema`
- Runtime stage:
  - `research-demand-intent` from `GTM_STAGE_KEYS` in `research-worker/src/schemas/gtm/gtm-run.ts`
- Required locked brief fields:
  - `fields.companyName`, `fields.companyUrl`, `fields.category`, `fields.productDescription`, `fields.targetCustomer`
  - `fields.primaryIcpDescription`, `fields.jobTitles`, `fields.icpPains`, `fields.currentAlternative`, `fields.awarenessLevel`
  - `fields.goals`, `fields.campaignObjective`, `fields.targetMarket`
- Optional locked brief fields:
  - `fields.market`, `fields.industryVertical`, `fields.geography`, `fields.useCases`, `fields.corePromise`, `fields.cta`
  - `fields.topCompetitors`, `fields.knownCompetitors`, `fields.alternatives`, `fields.categoryFrames`
  - `fields.commonObjections`, `fields.keyPromises`, `fields.channels`, `fields.whatIsWorking`, `fields.whatIsNotWorking`
- Required prior skill output: `ingest-identity` output. Use canonical company, domain, category, core keywords, and negative keywords.
- Optional prior skill output: `research-market` output. Use category definition, demand drivers, buying triggers, and adoption barriers when present.
- Optional prior skill output: `research-icp` output. Use persona anchors, pains, objections, and search intent when present.
- Legacy runner inspected:
  - `research-worker/src/runners/keywords.ts`
  - `research-worker/src/skills/keyword-campaign-skill.ts`
  - `research-worker/src/schemas/gtm/research-sections.ts`

## OUTPUT

- Downstream consumers: `research-cross`, `synthesize-media-plan`, `synthesize-scripts`, and `present-workspace`.
- Zod schema reference: `skills/research-keywords/schemas/output.ts`.
- Schema sketch:

```ts
const sourceSchema = z.object({
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

const sourcedClaimSchema = sourceSchema.extend({
  claim: z.string().min(1),
});

const keywordMetricSchema = sourceSchema.extend({
  keyword: z.string().min(1),
  provider: z.enum(['spyfu', 'google_ads', 'searchapi', 'semrush', 'ahrefs', 'public_serp', 'none']),
  search_volume: z.string().min(1).optional(),
  cpc: z.string().min(1).optional(),
  competition: z.string().min(1).optional(),
  metric_status: z.enum(['verified', 'unavailable']),
});

const intentClusterSchema = z.object({
  cluster_name: z.string().min(1),
  intent: z.enum(['problem', 'category', 'solution', 'comparison', 'competitor', 'pricing', 'implementation', 'content_gap']),
  funnel_stage: z.enum(['problem_aware', 'solution_aware', 'product_aware', 'most_aware']),
  queries: z.array(keywordMetricSchema).min(1),
  evidence: z.array(sourcedClaimSchema).min(1),
});

const contentGapSchema = sourceSchema.extend({
  gap: z.string().min(1),
  observed_query: z.string().min(1),
  current_result_pattern: z.string().min(1),
  buyer_question: z.string().min(1),
});

const negativeKeywordSchema = sourceSchema.extend({
  keyword: z.string().min(1),
  reason: z.string().min(1),
});

export const researchKeywordsOutputSchema = z.object({
  run_id: z.string().min(1),
  brief_snapshot_id: z.string().min(1),
  stage: z.literal('research-demand-intent'),
  company_name: z.string().min(1),
  category: z.string().min(1),
  provider_status: z.array(sourcedClaimSchema),
  intent_clusters: z.array(intentClusterSchema).min(1),
  paid_keyword_opportunities: z.array(keywordMetricSchema),
  content_gaps: z.array(contentGapSchema),
  negative_keywords: z.array(negativeKeywordSchema),
  excluded_terms: z.array(negativeKeywordSchema),
  source_gaps: z.array(z.object({
    topic: z.enum(['volume', 'cpc', 'competition', 'serp', 'content_gap']),
    reason: z.string().min(1),
    attempted_queries: z.array(z.string().min(1)),
  })),
  generated_at: z.string().datetime(),
});
```

Every factual query, metric, gap, exclusion, and provider-status claim uses `source_url` + `retrieved_at`. Metrics are strings so the skill can state provider ranges without fake precision.

## HYBRID CHOICE

`heavy` — this skill needs deterministic keyword normalization, duplicate removal, provider-status gates, metric provenance checks, and paid-source fallback handling.

## FILES TO CREATE

- `skills/research-keywords/SKILL.md`
- `skills/research-keywords/README.md`
- `skills/research-keywords/package.json`
- `skills/research-keywords/tsconfig.json`
- `skills/research-keywords/schemas/input.ts`
- `skills/research-keywords/schemas/output.ts`
- `skills/research-keywords/scripts/validate.ts`
- `skills/research-keywords/scripts/sanity-check.ts`
- `skills/research-keywords/scripts/orchestrate.ts`
- `skills/research-keywords/scripts/normalize-keywords.ts`
- `skills/research-keywords/scripts/provider-gates.ts`
- `skills/research-keywords/references/collector.md`
- `skills/research-keywords/references/rules.md`
- `skills/research-keywords/example/input.json`
- `skills/research-keywords/example/output.json`

No `generate-report.ts`, `assets/report-shell.html`, or screenshot script in Wave 2 unless implementation finds a real presentation need and updates this spec first.

## CONSTRAINTS

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Duplicate only the schema primitives needed for `GtmBrief`, source fields, identity output, optional market output, optional ICP output, and keyword output.
- Keep from `research-worker/src/runners/keywords.ts`: provider-status honesty, no-tool fallback, top-level `keywordIntel` intent, and theme-based keyword grouping.
- Drop from `research-worker/src/runners/keywords.ts`: LLM priority scores, unsourced recommended budgets, forced campaign counts, and fake metric fallback values.
- If a paid provider is unavailable, mark metric fields unavailable and record a `source_gaps` entry. Do not emit `0`, `Not verified`, or guessed CPC as a factual metric.
- Normalize keywords by lowercasing, trimming, collapsing whitespace, and deduping exact normalized matches while preserving the first sourced spelling.
- Content gaps must come from observed SERP or public content patterns, not from the product description alone.
- External API failures must throw with provider, query, status, and run id.

## STEPS

1. Read `research-worker/src/runners/keywords.ts`, `research-worker/src/skills/keyword-campaign-skill.ts`, and stage key `research-demand-intent`.
   - Verify: implementation notes list every legacy path inspected.
2. Define `schemas/input.ts` with `run_id`, `brief_snapshot_id`, locked `GtmBrief`, required `ingest_identity`, optional `research_market`, and optional `research_icp`.
   - Verify: `example/input.json` validates without outside imports.
3. Define `schemas/output.ts` with `researchKeywordsOutputSchema` from this spec.
   - Verify: every factual nested object includes `source_url` and `retrieved_at`.
4. Write `scripts/normalize-keywords.ts` and `scripts/provider-gates.ts`.
   - Verify: duplicates collapse, unavailable providers produce `source_gaps`, and no metric is accepted without a provider source.
5. Write `references/rules.md` and `references/collector.md`.
   - Verify: each collection instruction maps to one output key.
6. Write `SKILL.md` with trigger, boundaries, tools, workflow, schema references, and hard constraints.
   - Verify: SKILL.md stays under 500 lines.
7. Add realistic fixture files and run skill-local checks.
   - Verify: fixtures use real URLs and ISO timestamps; check, validate, and sanity-check pass.

## VERIFY

```bash
cd skills/research-keywords
npm install
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

Expected result:

- TypeScript compiles with no errors.
- `example/input.json` matches the input schema.
- `example/output.json` matches `researchKeywordsOutputSchema`.
- `orchestrate` writes normalized output with no duplicate normalized keywords.
- Sanity-check exits 0 without `ALLOW_SUSPECT`.

## CONFORMANCE TESTS

- `missing-source-url`: remove `source_url` from one query metric; `npm run validate` must fail with the object path.
- `missing-retrieved-at`: remove `retrieved_at` from one content gap; `npm run validate` must fail with the object path.
- `metric-without-provider`: add `search_volume` or `cpc` while setting `metric_status: 'unavailable'`; `npm run sanity-check` must fail.
- `duplicate-normalized-keyword`: add `CRM  Software` and `crm software` in the same output; `npm run orchestrate -- example` must emit one canonical entry.
- `placeholder-rejection`: set any sourced claim to `unknown`, `TBD`, `n/a`, `Not verified`, or an empty string; `npm run sanity-check` must fail.
- `no-outside-imports`: scan `skills/research-keywords/**/*.ts` for imports beginning with `../..`, `@/`, `src/`, `research-worker/`, or another `skills/` path; the check must fail if any exist.
- `no-llm-scores`: add `priorityScore`, `confidence`, or `recommendedMonthlyBudget`; Zod must reject the unknown key.

## WAVE

Wave number: `2`.

## DEPENDENCIES

- Required upstream skills:
  - `ingest-identity`
- Required non-skill upstream state:
  - locked GTM brief snapshot from `lock-brief`
- Optional upstream skills:
  - `research-market`
  - `research-icp`
- Blocked by:
  - paid keyword provider choice for live metrics. The skill can still emit sourced public-SERP intent without paid metrics.
