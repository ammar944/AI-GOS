# Research Fabrication Fix — Baseline Metrics & Insufficient-Data Gating

## Summary

Kill the fabricated growth/LTV/CAC numbers in the strategic blueprint output. Two coordinated changes:

1. **Add an optional "Current Performance" field group** to the journey onboarding (4 fields) so clients who have historical metrics can provide them.
2. **When metrics are missing, the pipeline must emit explicit "insufficient data" states instead of inventing numbers.** This replaces today's behavior where a hardcoded retention-multiplier heuristic silently synthesizes LTV and the freeform strategic narrative produces growth claims with no guard.

After the fix, every number the user sees in the CAC model, sensitivity analysis, and strategic narrative will either trace to a user-provided baseline metric, a cited industry benchmark with attribution, or an explicit "insufficient data" state. No middle ground.

## Problem

The research pipeline fabricates economic projections in two linked failure modes.

### Failure mode 1: Structured fabrication (deterministic heuristic)

`src/lib/media-plan/validation.ts:1372` defines `estimateRetentionMultiplier()`, a hardcoded heuristic that returns 12 months for any monthly/subscription pricing, 2.5 years for annual, 10 for seat/usage, 1 for one-time, 8 as default. That multiplier is passed into `computeCACModel()` at line 220, where:

```ts
const estimatedLTV = Math.round(offerPrice * retentionMultiplier);
const ltvToCacRatio = targetCAC > 0 ? estimatedLTV / targetCAC : 0;
```

Every run produces an `estimatedLTV` that is literally `offerPrice × 12` (or whatever bucket matched), regardless of what the client's actual retention is. The same flows into `cacModelSchema` in `src/lib/media-plan/schemas.ts:548` (`estimatedLTV`) and line 551 (`ltvToCacRatio`), which then feed every downstream performance projection in the media plan. This is not a prompt problem — it is a deterministic code path that cannot produce an honest number.

A similar pattern lives in `src/lib/journey/schemas/icp-validation.ts:118-146`, where `sensitivityAnalysis.breakEven.maxCPLFor3xLTV` and `maxCAC` are derived from the same invented LTV.

### Failure mode 2: Freeform prose fabrication

`research-worker/src/runners/synthesize.ts:62-83` defines a `planningContext` object plus a freeform `strategicNarrative` string. The only numerical guardrail in the system prompt (line 118) constrains demo-page conversion rate estimates. Nothing prevents the model from writing sentences like "targeting 30% YoY growth" or "scale to $5M ARR in 18 months" in the strategic narrative, executive summary, or campaign phase descriptions. Those claims never trace to any data the user provided.

### Missing onboarding fields

`src/lib/journey/field-catalog.ts` collects `monthlyAdBudget`, `monthlyRevenueRange` (broad buckets), `payingCustomerCount`, `targetCpl`, `targetCac`, and pricing tiers. There is **no current CAC, current LTV, retention/churn, historical growth rate, historical conversion rates, or historical lead volume** in the catalog. There is no onboarding path for a client to provide the data that would let the pipeline compute honest economics.

## Goals

- Eliminate all fabricated LTV, CAC, retention multiplier, and growth-rate claims from research output.
- Give clients a place to enter historical metrics during the journey, if they have them.
- When metrics are missing, the output states "insufficient data" explicitly — in both structured fields and prose — rather than filling the gap silently.
- Preserve existing pipeline behavior for everything unrelated to economics. No regression in competitor intel, keyword intel, ad library analysis, or media plan budget math.

## Non-goals

- No retroactive regeneration. If a user adds baseline metrics after a research run, they re-run the journey. No incremental re-compute.
- No new onboarding wizard UI component. The new field group reuses `unified-field-review.tsx` by being added to `JOURNEY_FIELD_GROUPS`.
- No automatic LTV estimation from partial inputs. If the user provides retention but not LTV and not ARPU, LTV stays null. No `retention × ARPU` fallback.
- No changes to the old `/onboarding` wizard (`src/components/onboarding/step-budget-targets.tsx`) — that route is legacy and not in the production flow.
- No Playwright E2E. Fellow.ai manual re-run is the UI-level gate.

## Architecture

Five surfaces change. Data flows top-to-bottom:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ONBOARDING (journey review UI)                           │
│    New group "current-performance" rendered by              │
│    unified-field-review.tsx. 4 optional number fields.      │
│    Written to journey_sessions.business_snapshot            │
│    under a new baselineMetrics key.                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. DISPATCH (src/app/api/journey/dispatch/route.ts)         │
│    Forwards baselineMetrics into worker context.            │
│    No default-injection. If the snapshot has no             │
│    baselineMetrics, dispatch passes nothing.                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. RESEARCH WORKER (research-worker/)                       │
│    Runners that touch economics read context.baselineMetrics│
│    and either use the value or emit the insufficientData    │
│    branch. Affected:                                        │
│    - synthesize.ts  → planningContext + strategicNarrative  │
│    - icp.ts         → sensitivityAnalysis + breakEven       │
│    - media-plan.ts  → measurementGuardrails/cacModel block  │
│    Each runner gets a BASELINE METRICS DATA INTEGRITY       │
│    block injected into its system prompt, mirroring the     │
│    PRICING DATA INTEGRITY block in offer.ts.                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. DETERMINISTIC POST-PROCESS (src/lib/media-plan/)         │
│    validation.ts:                                           │
│    - DELETE estimateRetentionMultiplier                     │
│    - computeCACModel accepts nullable inputs, returns       │
│      cacModel + insufficientData[] instead of throwing      │
│    - NEW sweepFabricatedClaims() scrubs forbidden prose     │
│      patterns from narrative fields and returns stripped    │
│      text + list of removed fragments                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. UI RENDERING (src/components/workspace/)                 │
│    LTV/CAC/ratio cards render "Insufficient data" state     │
│    with CTA "Add baseline metrics → /profile" when any of   │
│    the relevant fields is null. Partial fills render the    │
│    known values normally; only the null cards show the      │
│    insufficient-data state.                                 │
└─────────────────────────────────────────────────────────────┘
```

### Design decisions with rationale

1. **Runner-level gating, not orchestrator-level.** Each affected runner owns its subset of `baselineMetrics`. Alternative was a central orchestrator guard, rejected because runners already own their domain — splitting the fabrication check from the runners that produce the fabrication creates two places to update for every future runner addition.

2. **Delete `estimateRetentionMultiplier`, do not deprecate.** A feature-flagged deprecation leaves a revival path. A negative-assertion test (`expect(validation).not.toHaveProperty('estimateRetentionMultiplier')`) makes removal load-bearing — any attempt to reintroduce the heuristic breaks CI.

3. **Nullable output schemas, not optional.** `z.number().nullable()` forces the runner to explicitly emit `null` when data is missing, which is auditable. `z.number().optional()` would let the runner silently omit the field and create ambiguity between "missing due to insufficient data" and "missing due to bug." Null = intentional, missing = bug.

4. **`insufficientData: string[]` sibling on schemas, not just nulls.** The UI needs to show users *which specific baseline metric* would unlock the card. `"estimatedLTV: no avgCustomerLtv provided"` becomes "Add your current LTV to unlock" in the UI. A silent null would not.

5. **Server-side fabrication sweep with test-harness backup.** The sweep runs in the validation layer at runtime as a safety net for prompt drift. A co-located test file (`sweep-fabricated-claims.test.ts`) has curated true-positive and true-negative matrices that grow over time from production strip logs.

## Field catalog changes

### New JourneyFieldDefinition entries

Appended to `JOURNEY_FIELDS` in `src/lib/journey/field-catalog.ts`:

```ts
{ key: 'currentCac', label: 'Current CAC',
  category: 'section-followup', section: 'offerAnalysis',
  collectionMode: 'manual', prefillVisible: false },
{ key: 'avgCustomerLtv', label: 'Avg Customer LTV',
  category: 'section-followup', section: 'offerAnalysis',
  collectionMode: 'manual', prefillVisible: false },
{ key: 'leadToCustomerRate', label: 'Lead → Customer %',
  category: 'section-followup', section: 'offerAnalysis',
  collectionMode: 'manual', prefillVisible: false },
{ key: 'last12MoGrowthRate', label: 'Last 12-Month Revenue Growth %',
  category: 'section-followup', section: 'offerAnalysis',
  collectionMode: 'manual', prefillVisible: false },
```

None carry `required: true` or `requiredGroup`. All are section-followups, not required blockers.

### New JOURNEY_ENRICHMENT_FIELD_METAS entries

```ts
{ key: 'currentCac', label: 'Current CAC',
  placeholder: '$450',
  helper: "What it currently costs you to acquire a customer.",
  rows: 1 },
{ key: 'avgCustomerLtv', label: 'Avg Customer LTV',
  placeholder: '$3,600',
  helper: "Lifetime revenue per customer. Leave blank if you're not sure.",
  rows: 1 },
{ key: 'leadToCustomerRate', label: 'Lead → Customer %',
  placeholder: '5',
  helper: 'Of every 100 leads, how many become paying customers?',
  rows: 1 },
{ key: 'last12MoGrowthRate', label: 'Last 12-Month Revenue Growth %',
  placeholder: '25',
  helper: "Leave blank if you don't track it. Used to gate growth-rate claims in the plan.",
  rows: 1 },
```

### New group appended to both JOURNEY_FIELD_GROUPS and PROFILE_FIELD_GROUPS

```ts
{
  id: 'current-performance',
  label: 'Current Performance (optional)',
  fieldKeys: ['currentCac', 'avgCustomerLtv', 'leadToCustomerRate', 'last12MoGrowthRate'],
}
```

Placement: appended after `goals-strategy` in both arrays.

`unified-field-review.tsx` and the profile page render the new group automatically. No new React component.

## Schema changes

### business_snapshot Zod schema

Add `baselineMetrics` as an optional nested object. Locate the existing business-snapshot Zod schema (expected path: `src/lib/journey/schemas/business-snapshot.ts` or nearby — verified during implementation):

```ts
baselineMetrics: z.object({
  currentCac: z.number().positive().nullable(),
  avgCustomerLtv: z.number().positive().nullable(),
  leadToCustomerRate: z.number().positive().nullable(), // percentage 0-100
  last12MoGrowthRate: z.number().nullable(),            // can be negative
}).partial().optional(),
```

No `.min()/.max()` on the inner numbers — the learned-patterns rule forbids them on Zod number fields passed to `generateObject`. Range enforcement happens in post-processing.

### cacModelSchema (src/lib/media-plan/schemas.ts)

Current nullable candidates at line 526-553:

```ts
leadToSqlRate: z.number().min(0).max(100).nullable(),
sqlToCustomerRate: z.number().min(0).max(100).nullable(),
expectedMonthlyLeads: z.number().nullable(),
expectedMonthlySQLs: z.number().nullable(),
expectedMonthlyCustomers: z.number().nullable(),
estimatedLTV: z.number().nullable(),
ltvToCacRatio: z.string().nullable(),
// NEW:
insufficientData: z.array(z.string()).optional()
  .describe('List of cac-model fields that were set to null because the required baseline metric was not provided. Example: ["estimatedLTV: no avgCustomerLtv provided"]'),
```

Note: keep the `.min(0).max(100)` on the rate fields — they are not passed through `generateObject` directly at this layer (the media-plan runner uses its own prompts and deterministic compute). Verify during implementation that no direct-to-Anthropic path hits this schema.

### sensitivityAnalysis (src/lib/journey/schemas/icp-validation.ts)

Lines 118-146. Each scenario becomes nullable:

```ts
sensitivityAnalysis: z.object({
  bestCase: z.object({ ... }).nullable(),
  baseCase: z.object({ ... }).nullable(),
  worstCase: z.object({ ... }).nullable(),
  breakEven: z.object({
    maxCPLFor3xLTV: z.number().nullable(),
    maxCAC: z.number().nullable(),
    minLeadToSqlRate: z.number().nullable(),
    budgetFloorForTesting: z.number().nullable(),
  }).nullable(),
  insufficientData: z.array(z.string()).optional(),
}).optional(),
```

### synthesisGenerateSchema (research-worker/src/runners/synthesize.ts)

Lines 62-70. `planningContext` gains a new `growthProjection` field:

```ts
planningContext: z.object({
  monthlyBudget: z.string().optional(),
  targetCpl: z.string().optional(),
  targetCac: z.string().optional(),
  estimatedDemoPageCvr: z.number().optional().describe(/* unchanged */),
  growthProjection: z.string().nullable().describe(
    'Single sentence describing growth expectations. MUST be null unless baselineMetrics.last12MoGrowthRate is provided. If provided, the sentence MUST cite the user-reported rate directly.'
  ),
  downstreamSequence: z.array(z.enum(['keywordIntel', 'mediaPlan'])),
}),
```

## Worker prompt changes

Each affected runner (`synthesize.ts`, `icp.ts`, `media-plan.ts` measurementGuardrails block) gets a new block injected into its system prompt. The block text is rendered by a new helper in the dispatch context builder that substitutes the actual values from `context.baselineMetrics`:

```
BASELINE METRICS DATA INTEGRITY (CRITICAL):
- The user has provided the following baseline metrics (may contain "NOT PROVIDED"):
  currentCac: {{value or "NOT PROVIDED"}}
  avgCustomerLtv: {{value or "NOT PROVIDED"}}
  leadToCustomerRate: {{value or "NOT PROVIDED"}}
  last12MoGrowthRate: {{value or "NOT PROVIDED"}}
- NEVER invent LTV, CAC, retention, customer count, or growth-rate numbers.
- For any computation that would require a NOT PROVIDED metric, output null
  for that field and add a string to insufficientData explaining which metric
  was missing. Example: "estimatedLTV: no avgCustomerLtv provided"
- You MAY state industry benchmarks (e.g., "B2B SaaS CAC typically $300-600")
  but must attribute them to a named source and must NOT frame them as
  projections for this client.
- NEVER state a YoY growth rate, ARR scaling target, or "reach $X in Y months"
  claim unless last12MoGrowthRate is PROVIDED AND you cite it directly.
  If last12MoGrowthRate is NOT PROVIDED, say "growth rate not tracked" and
  move on — do not replace it with a benchmark.
```

Injection points:

- `research-worker/src/runners/synthesize.ts` — added after the existing CVR guard at line 118. The existing CVR guard stays.
- `research-worker/src/runners/icp.ts` — added before SEGMENTS GUIDANCE at line 114.
- `research-worker/src/runners/media-plan.ts` — added to the `measurementGuardrails` block config, which is the block that generates `cacModel`.

The substitution helper lives in `research-worker/src/runner.ts` or a new `research-worker/src/baseline-metrics.ts` helper (verified during implementation).

## Validation layer changes

### src/lib/media-plan/validation.ts

**DELETE `estimateRetentionMultiplier`** (currently lines 1372-1379). No shim.

**Rewrite `computeCACModel` signature and logic** (currently line 220):

```ts
export interface CACModelInput {
  monthlyBudget: number;
  targetCPL: number | null;
  leadToCustomerRate: number | null; // 0-100
  currentCac: number | null;
  avgCustomerLtv: number | null;
}

export interface CACModelResult {
  cacModel: CACModel;
  insufficientData: string[];
}

export function computeCACModel(input: CACModelInput): CACModelResult {
  const insufficientData: string[] = [];
  const { monthlyBudget, targetCPL, leadToCustomerRate, currentCac, avgCustomerLtv } = input;

  // CPL path — still deterministic from budget, needed to drive leads count.
  const safeCPL = targetCPL && targetCPL > 0 ? targetCPL : null;
  const effectiveBudget = monthlyBudget * 0.80;
  const expectedMonthlyLeads = safeCPL ? Math.round(effectiveBudget / safeCPL) : null;
  if (!safeCPL) insufficientData.push('expectedMonthlyLeads: no targetCPL provided');

  // Conversion path — requires user-provided leadToCustomerRate.
  let expectedMonthlyCustomers: number | null = null;
  let leadToSqlRate: number | null = null;
  let sqlToCustomerRate: number | null = null;
  if (leadToCustomerRate && expectedMonthlyLeads) {
    expectedMonthlyCustomers = Math.max(1, Math.round(expectedMonthlyLeads * leadToCustomerRate / 100));
    // Split the single user rate across the two-stage schema via sqrt distribution.
    const stageRate = Math.sqrt(leadToCustomerRate / 100) * 100;
    leadToSqlRate = Math.round(stageRate * 10) / 10;
    sqlToCustomerRate = Math.round(stageRate * 10) / 10;
  } else {
    insufficientData.push('expectedMonthlyCustomers: no leadToCustomerRate provided');
  }

  // CAC — honors user-provided currentCac, never synthesizes.
  const targetCAC = currentCac ?? (expectedMonthlyCustomers ? Math.round(monthlyBudget / expectedMonthlyCustomers) : null);
  if (!currentCac && !targetCAC) insufficientData.push('targetCAC: no currentCac and no leadToCustomerRate');

  // LTV — user-provided only. No heuristic.
  const estimatedLTV = avgCustomerLtv ?? null;
  if (!estimatedLTV) insufficientData.push('estimatedLTV: no avgCustomerLtv provided');

  // Ratio — requires both.
  let ltvToCacRatio: string | null = null;
  if (estimatedLTV && targetCAC && targetCAC > 0) {
    const ratio = estimatedLTV / targetCAC;
    ltvToCacRatio = ratio >= 3
      ? `${ratio.toFixed(1)}:1 — Healthy`
      : ratio >= 1
        ? `${ratio.toFixed(1)}:1 — Below ideal (target >3:1)`
        : `${ratio.toFixed(1)}:1 — Unsustainable`;
  } else {
    insufficientData.push('ltvToCacRatio: requires both avgCustomerLtv and a resolvable CAC');
  }

  return {
    cacModel: {
      targetCAC,
      targetCPL: safeCPL,
      leadToSqlRate,
      sqlToCustomerRate,
      expectedMonthlyLeads,
      expectedMonthlySQLs: expectedMonthlyLeads && leadToSqlRate ? Math.round(expectedMonthlyLeads * leadToSqlRate / 100) : null,
      expectedMonthlyCustomers,
      estimatedLTV,
      ltvToCacRatio,
      insufficientData,
    },
    insufficientData,
  };
}
```

`buildPerformanceModel` and `pipeline.ts` call sites update to pass the new shape (line numbers verified during implementation — they will have drifted). `estimateRetentionMultiplier` import at `pipeline.ts` is removed. `index.ts` export of `estimateRetentionMultiplier` is removed. Any callers that previously passed `offerPrice` to the CAC model drop that argument.

**New `sweepFabricatedClaims` function** in the same file:

```ts
export function sweepFabricatedClaims(
  text: string,
  allowGrowthClaims: boolean,
  userGrowthRate: number | null,
): { clean: string; stripped: string[] } {
  const patterns: Array<{ name: string; re: RegExp; gated?: boolean }> = [
    { name: 'yoy_growth', re: /\d+\s*%\s*(?:YoY|year[- ]over[- ]year|annual(?:ized)?\s*growth)/gi, gated: true },
    { name: 'scale_to_arr', re: /scale\s+to\s+\$[\d.,]+\s*[MBK]?\s*(?:ARR|MRR|in revenue)?\s*(?:in|within|over)?\s*\d*\s*(?:months?|years?)?/gi },
    { name: 'grow_from_to', re: /grow(?:ing)?\s+(?:from|by)\s+\$[\d.,]+\s*[MBK]?\s+to\s+\$[\d.,]+\s*[MBK]?/gi },
    { name: 'reach_arr', re: /reach\s+\$[\d.,]+\s*[MBK]?\s+ARR/gi },
  ];
  let clean = text;
  const stripped: string[] = [];
  for (const p of patterns) {
    clean = clean.replace(p.re, (match) => {
      // If this pattern is gated and growth claims are allowed, keep the match
      // only if the sentence contains the user's exact reported number.
      if (p.gated && allowGrowthClaims && userGrowthRate !== null) {
        if (match.includes(String(Math.round(userGrowthRate)))) return match;
      }
      stripped.push(`${p.name}: ${match}`);
      return '[growth rate not tracked]';
    });
  }
  return { clean, stripped };
}
```

The sweep is applied by the media-plan pipeline to `executiveSummary.overview`, each `campaignPhases[].description`, and — via a new hook in synthesize post-processing — to `strategicNarrative`. Every strip is logged with the original text at `console.warn` level with a structured payload `{ runner, field, pattern, match }` so production strips can be grepped later.

## Dispatch wiring

`src/app/api/journey/dispatch/route.ts` passes `baselineMetrics` into the worker request body under `context.baselineMetrics` if the journey session's `business_snapshot` has the key. If absent, the field is simply not set — the worker handles `undefined` as "no data provided for any metric", which matches the all-null case and emits full insufficient-data state.

The dispatch context-builder helper (whichever file renders the context string for the worker runners) also injects the rendered `BASELINE METRICS DATA INTEGRITY` block into each affected runner's system prompt.

## UI rendering

When a workspace card's underlying `cacModel.estimatedLTV === null` (or any sibling), the card renders an insufficient-data state:

```
┌────────────────────────────────────┐
│  LTV : CAC Ratio                   │
│                                    │
│  Insufficient data                 │
│                                    │
│  Add your current LTV to unlock    │
│  → Update profile                  │
└────────────────────────────────────┘
```

The CTA link routes to `/profiles/[id]#current-performance` with a fragment navigation that scrolls the page to the new group and focuses the first empty field. No new design tokens; reuse existing empty-state patterns.

Partial fills: if `currentCac` is present but `avgCustomerLtv` is null, the CAC card shows the real number, the LTV card shows insufficient data, and the ratio card shows insufficient data.

## Testing strategy

All new tests are Vitest unit tests. AI calls are mocked — no Anthropic API in CI.

### 1. `src/lib/media-plan/__tests__/validation-cac-model.test.ts` (new)

- All null inputs → returns cacModel with `estimatedLTV=null`, `ltvToCacRatio=null`, `targetCAC=null`, `expectedMonthlyCustomers=null`; `insufficientData.length >= 3`.
- Only `currentCac=450` provided → `cacModel.targetCAC === 450`, LTV still null, ratio still null.
- All four metrics provided → deterministic math matches hand-calculated values; `insufficientData.length === 0`.
- `expect(validationModule).not.toHaveProperty('estimateRetentionMultiplier')` — the negative guard.

### 2. `src/lib/media-plan/__tests__/sweep-fabricated-claims.test.ts` (new)

- True-positive matrix (12+ sentences) all stripped. Examples:
  - `"Targeting 30% YoY growth through aggressive paid spend"`
  - `"Expected to scale to $5M ARR in 18 months"`
  - `"Grow from $500K to $2M ARR"`
  - `"Plan to reach $10M ARR"`
- True-negative matrix (12+ sentences) all pass. Examples:
  - `"Industry benchmark: B2B SaaS sees 20-35% annual growth per Gartner 2025"` — benchmark, cited
  - `"Scale winning ad sets after 7 days of sustained CPL"` — different "scale"
  - `"Reach 10M impressions monthly"` — no ARR
- `allowGrowthClaims=true` with `userGrowthRate=25`: `"Based on your reported 25% trailing growth"` passes; `"Targeting 40% growth"` still strips.

### 3. `src/lib/journey/__tests__/field-catalog.test.ts` (extend existing)

- `current-performance` group exists in both `JOURNEY_FIELD_GROUPS` and `PROFILE_FIELD_GROUPS`.
- Each of the 4 new keys has both a `JourneyFieldDefinition` entry and a `JOURNEY_ENRICHMENT_FIELD_METAS` entry.
- None are in `JOURNEY_REQUIRED_FIELD_KEYS` or `JOURNEY_PRICING_GROUP_KEYS`.

### 4. `src/lib/journey/__tests__/research-result-contract.test.ts` (extend existing)

- `cacModelSchema.parse` accepts nullable fields + `insufficientData` sibling.
- `sensitivityAnalysis` parses with all scenarios null.
- Legacy payloads (no `insufficientData` field) still parse — back-compat.

### 5. `src/app/api/journey/__tests__/dispatch-baseline-metrics.test.ts` (new)

- Mock the Railway worker HTTP call. Assert request body.
- Session with `baselineMetrics = { currentCac: 450, avgCustomerLtv: null, leadToCustomerRate: 5, last12MoGrowthRate: null }` → dispatch body contains `context.baselineMetrics` matching exactly.
- Session with no `baselineMetrics` → dispatch body has `context.baselineMetrics === undefined`.

### 6. `research-worker/src/runners/__tests__/synthesize-fabrication-regression.test.ts` (new)

- Mock the Anthropic call to return a recorded past output containing `"30% YoY growth"` and `"scale to $3M ARR in 18 months"`.
- After synthesize finishes and the sweep runs, `strategicNarrative` does not contain either phrase.
- `insufficientData` array contains an entry for growth-rate fabrication.

## Verification plan

Per the mandatory `verification.md` gate:

1. `npm run build` exits 0.
2. `npm run test:run -- src/lib/media-plan/__tests__/validation-cac-model.test.ts src/lib/media-plan/__tests__/sweep-fabricated-claims.test.ts src/lib/journey/__tests__/field-catalog.test.ts src/lib/journey/__tests__/research-result-contract.test.ts src/app/api/journey/__tests__/dispatch-baseline-metrics.test.ts` all pass; no existing test regresses.
3. `cd research-worker && npm run build` exits 0.
4. `cd research-worker && npx vitest run src/runners/__tests__/synthesize-fabrication-regression.test.ts` passes.
5. **Fellow.ai manual re-run** (canonical regression fixture per project memory):
   - **Run A**: submit Fellow.ai with no baseline metrics. Expected: the rendered cac-model card in the workspace shows "Insufficient data"; `strategicNarrative` contains no `\d+%\s*(YoY|growth)` or `\$.*ARR.*months?` matches; the `insufficientData` array on the media plan section is populated.
   - **Run B**: submit Fellow.ai with all 4 baseline metrics filled (currentCac=$450, avgCustomerLtv=$3600, leadToCustomerRate=5%, last12MoGrowthRate=25%). Expected: the cac-model card shows real numbers, the math is internally consistent (CAC × customers ≈ monthlyBudget × 0.8), and `strategicNarrative` may contain exactly one growth claim that cites "25%".
6. Read 10+ lines around each edit before marking done.
7. Trace one full field through the pipeline (example: `currentCac`): field-catalog → unified-field-review → business_snapshot storage → dispatch context → worker runner prompt → cacModel compute → UI render. Manual sanity check at each hop.

## Open questions at implementation time

These are judgment calls I do not need to lock down now but will surface during implementation:

- **Exact file path for the business-snapshot Zod schema.** I referenced `src/lib/journey/schemas/business-snapshot.ts`; the implementing session should grep to confirm the actual location. If the schema lives in a different file, the addition goes there instead.
- **Exact workspace card component path.** The UI section references "the card in `src/components/workspace/` that renders the performance model" without a filename. Locate during implementation and add the insufficient-data state in place.
- **Whether the `leadToSqlRate`/`sqlToCustomerRate` split (sqrt distribution) is the right mapping.** The alternative is to simply omit the two-stage funnel when the single-rate input is present and rename the field. Sqrt is the minimal-change path; revisit if product pushes back.
- **Where to inject the `BASELINE METRICS DATA INTEGRITY` block rendering helper.** `research-worker/src/runner.ts` vs a new `baseline-metrics.ts` helper. Code-smell judgment call during implementation.
- **`.min()/.max()` + `.nullable()` interaction on `cacModelSchema`.** The existing `leadToSqlRate` and `sqlToCustomerRate` fields already carry `.min(0).max(100)`. Before adding `.nullable()`, verify that `cacModelSchema` is not passed to `generateObject()` anywhere in the media-plan runner — otherwise the learned-pattern rule (Anthropic API rejects min/max on number fields) will bite. If it is passed to `generateObject`, either (a) drop `.min/.max` in favor of runtime validation, or (b) split the schema into a generation-schema and a post-validation-schema. The runner is `research-worker/src/runners/media-plan.ts`; grep for imports of `cacModelSchema` or the parent `mediaPlanSchema`.

## Out of scope (fast-follow candidates)

- Retroactive re-computation when metrics are added after a run.
- A "compare to industry benchmark" panel that shows the user how their metrics stack up.
- Collecting historical lead volume, churn rate, or separate lead-to-SQL / SQL-to-customer rates.
- Retiring or migrating the old `/onboarding` wizard.
