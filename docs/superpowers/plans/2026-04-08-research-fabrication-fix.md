# Research Fabrication Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kill fabricated LTV/CAC/growth numbers in the research pipeline by adding 4 optional baseline-metric onboarding fields, deleting the `estimateRetentionMultiplier` heuristic, and making all economic projections either trace to user-provided data or explicitly emit "insufficient data" states.

**Architecture:** Four new optional fields flow from the journey review UI into `business_snapshot`, forwarded via dispatch into the worker context. Runners read those metrics and either compute deterministically or emit nullable schema fields with an `insufficientData: string[]` sibling. A runtime `sweepFabricatedClaims()` scrubs forbidden prose patterns from narrative fields. The CAC model card in the workspace renders an "Insufficient data — add baseline metrics" panel when any key field is null.

**Tech Stack:** Next.js (Node runtime), Vitest, Zod, Vercel AI SDK v6, Anthropic SDK (research worker), Supabase, React + Tailwind.

**Spec:** `docs/superpowers/specs/2026-04-08-research-fabrication-fix-design.md`

---

## Pre-flight

- [ ] **Step 0.1: Create a working branch off the current branch**

```bash
git checkout -b fix/research-fabrication-baseline-metrics
```

Expected: branch created locally, `git status` shows existing uncommitted changes unchanged.

- [ ] **Step 0.2: Sanity-check that the build is green before any changes**

Run: `npm run build`
Expected: exit code 0. If it fails for reasons unrelated to this work, stop and report — do not start on top of a broken build.

- [ ] **Step 0.3: Sanity-check the worker builds**

Run: `cd research-worker && npm run build && cd ..`
Expected: exit code 0.

---

## Task 1: Field catalog — add 4 baseline metric fields and the new group

**Files:**
- Modify: `src/lib/journey/field-catalog.ts`
- Extend test: `src/lib/journey/__tests__/field-catalog.test.ts`

- [ ] **Step 1.1: Write the failing test — field definitions exist**

Add to `src/lib/journey/__tests__/field-catalog.test.ts` (append a new `describe` block):

```ts
import {
  JOURNEY_FIELDS,
  JOURNEY_ENRICHMENT_FIELD_METAS,
  JOURNEY_FIELD_GROUPS,
  PROFILE_FIELD_GROUPS,
  JOURNEY_REQUIRED_FIELD_KEYS,
  JOURNEY_PRICING_GROUP_KEYS,
  getJourneyFieldDefinition,
  getManualBlockerMeta,
} from '../field-catalog';

describe('Current Performance baseline-metric fields', () => {
  const BASELINE_KEYS = ['currentCac', 'avgCustomerLtv', 'leadToCustomerRate', 'last12MoGrowthRate'] as const;

  it.each(BASELINE_KEYS)('defines %s as a section-followup field', (key) => {
    const def = getJourneyFieldDefinition(key);
    expect(def).toBeDefined();
    expect(def?.category).toBe('section-followup');
    expect(def?.section).toBe('offerAnalysis');
    expect(def?.collectionMode).toBe('manual');
    expect(def?.prefillVisible).toBe(false);
  });

  it.each(BASELINE_KEYS)('gives %s a placeholder and helper via enrichment metas', (key) => {
    const meta = getManualBlockerMeta(key);
    expect(meta).toBeDefined();
    expect(meta?.placeholder).toBeTruthy();
    expect(meta?.helper).toBeTruthy();
    expect(meta?.rows).toBe(1);
  });

  it.each(BASELINE_KEYS)('never marks %s as required or in the pricing group', (key) => {
    expect(JOURNEY_REQUIRED_FIELD_KEYS.has(key)).toBe(false);
    expect(JOURNEY_PRICING_GROUP_KEYS.has(key)).toBe(false);
  });

  it('adds a current-performance group to JOURNEY_FIELD_GROUPS', () => {
    const group = JOURNEY_FIELD_GROUPS.find((g) => g.id === 'current-performance');
    expect(group).toBeDefined();
    expect(group?.label).toBe('Current Performance (optional)');
    expect(group?.fieldKeys).toEqual([...BASELINE_KEYS]);
  });

  it('adds a current-performance group to PROFILE_FIELD_GROUPS', () => {
    const group = PROFILE_FIELD_GROUPS.find((g) => g.id === 'current-performance');
    expect(group).toBeDefined();
    expect(group?.fieldKeys).toEqual([...BASELINE_KEYS]);
  });
});
```

- [ ] **Step 1.2: Run the test and confirm it fails**

Run: `npm run test:run -- src/lib/journey/__tests__/field-catalog.test.ts`
Expected: FAIL — `getJourneyFieldDefinition('currentCac')` returns `undefined`; the new group is missing.

- [ ] **Step 1.3: Add the 4 field definitions to JOURNEY_FIELDS**

Edit `src/lib/journey/field-catalog.ts`. Locate the closing `] as const;` of `JOURNEY_FIELDS` (around line 81). Add these four entries **before** the closing bracket:

```ts
{ key: 'currentCac', label: 'Current CAC', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'manual', prefillVisible: false },
{ key: 'avgCustomerLtv', label: 'Avg Customer LTV', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'manual', prefillVisible: false },
{ key: 'leadToCustomerRate', label: 'Lead → Customer %', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'manual', prefillVisible: false },
{ key: 'last12MoGrowthRate', label: 'Last 12-Month Revenue Growth %', category: 'section-followup', section: 'offerAnalysis', collectionMode: 'manual', prefillVisible: false },
```

- [ ] **Step 1.4: Add the 4 enrichment metas**

In the same file, locate `JOURNEY_ENRICHMENT_FIELD_METAS` (around line 174). Add these four entries **before** the closing `];`:

```ts
{
  key: 'currentCac',
  label: 'Current CAC',
  placeholder: '$450',
  helper: 'What it currently costs you to acquire a customer.',
  rows: 1,
},
{
  key: 'avgCustomerLtv',
  label: 'Avg Customer LTV',
  placeholder: '$3,600',
  helper: "Lifetime revenue per customer. Leave blank if you're not sure.",
  rows: 1,
},
{
  key: 'leadToCustomerRate',
  label: 'Lead → Customer %',
  placeholder: '5',
  helper: 'Of every 100 leads, how many become paying customers?',
  rows: 1,
},
{
  key: 'last12MoGrowthRate',
  label: 'Last 12-Month Revenue Growth %',
  placeholder: '25',
  helper: "Leave blank if you don't track it. Used to gate growth-rate claims in the plan.",
  rows: 1,
},
```

- [ ] **Step 1.5: Append the new group to both JOURNEY_FIELD_GROUPS and PROFILE_FIELD_GROUPS**

In the same file, locate `JOURNEY_FIELD_GROUPS` (around line 264). Append this entry **before** the closing `];`, after the `goals-strategy` entry:

```ts
{
  id: 'current-performance',
  label: 'Current Performance (optional)',
  fieldKeys: ['currentCac', 'avgCustomerLtv', 'leadToCustomerRate', 'last12MoGrowthRate'],
},
```

Repeat for `PROFILE_FIELD_GROUPS` (around line 295) — same entry appended before the closing `];`.

- [ ] **Step 1.6: Run the test and confirm it passes**

Run: `npm run test:run -- src/lib/journey/__tests__/field-catalog.test.ts`
Expected: PASS (all 4 describe blocks green, no existing tests regress).

- [ ] **Step 1.7: Commit**

```bash
git add src/lib/journey/field-catalog.ts src/lib/journey/__tests__/field-catalog.test.ts
git commit -m "feat(journey): add current-performance field group (4 optional baseline metrics)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: business_snapshot schema — add nullable baselineMetrics

**Files:**
- Locate and modify: business_snapshot Zod schema (exact file TBD by grep in Step 2.1)
- Test: added inline to Step 2.3 as part of the schema file or a colocated `__tests__` file

- [ ] **Step 2.1: Locate the business_snapshot Zod schema**

Run:
```bash
grep -rn "business_snapshot\|businessSnapshot" src/lib/journey --include="*.ts" -l
grep -rn "monthlyAdBudget" src/lib/journey --include="*.ts" -l | grep -v test
```

Expected: a small set of `.ts` files. Open each match and find the one that exports a **Zod schema** (`z.object({...})`) describing the snapshot shape (the file that holds `pricingTiers`, `monthlyAdBudget`, etc.). Record the path as `$SNAPSHOT_FILE` for subsequent steps. If no single Zod schema exists for the snapshot (it's a plain TypeScript type only), record the TypeScript type definition file as `$SNAPSHOT_FILE` instead, and add the Zod schema alongside the type.

- [ ] **Step 2.2: Write the failing test**

Create or extend a colocated test file next to `$SNAPSHOT_FILE`. Example: `src/lib/journey/__tests__/business-snapshot-baseline-metrics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { businessSnapshotSchema } from '../session-state'; // adjust import if $SNAPSHOT_FILE differs

describe('businessSnapshotSchema.baselineMetrics', () => {
  it('accepts a snapshot with no baselineMetrics at all', () => {
    const result = businessSnapshotSchema.safeParse({
      companyName: 'Acme',
      monthlyAdBudget: 5000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all four metrics filled', () => {
    const result = businessSnapshotSchema.safeParse({
      companyName: 'Acme',
      baselineMetrics: {
        currentCac: 450,
        avgCustomerLtv: 3600,
        leadToCustomerRate: 5,
        last12MoGrowthRate: 25,
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial fills (some null, some missing)', () => {
    const result = businessSnapshotSchema.safeParse({
      companyName: 'Acme',
      baselineMetrics: {
        currentCac: 450,
        avgCustomerLtv: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts explicit null values', () => {
    const result = businessSnapshotSchema.safeParse({
      baselineMetrics: {
        currentCac: null,
        avgCustomerLtv: null,
        leadToCustomerRate: null,
        last12MoGrowthRate: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-numeric values', () => {
    const result = businessSnapshotSchema.safeParse({
      baselineMetrics: { currentCac: 'four hundred' },
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2.3: Run the test and confirm it fails**

Run: `npm run test:run -- src/lib/journey/__tests__/business-snapshot-baseline-metrics.test.ts`
Expected: FAIL — either the import of `businessSnapshotSchema` is missing or `baselineMetrics` is not a valid key.

- [ ] **Step 2.4: Add the baselineMetrics key to the schema**

Edit `$SNAPSHOT_FILE`. Add this field to the object schema:

```ts
baselineMetrics: z
  .object({
    currentCac: z.number().positive().nullable(),
    avgCustomerLtv: z.number().positive().nullable(),
    leadToCustomerRate: z.number().positive().nullable(),
    last12MoGrowthRate: z.number().nullable(),
  })
  .partial()
  .optional(),
```

**Critical constraint:** Do **not** add `.min()` or `.max()` to the number fields. Per `.claude/rules/learned-patterns.md`, these break Anthropic's `generateObject` API. Range checks go in the post-processing layer, not the schema.

If the file also defines a TypeScript type that mirrors the schema, add:

```ts
export interface BaselineMetrics {
  currentCac: number | null;
  avgCustomerLtv: number | null;
  leadToCustomerRate: number | null;
  last12MoGrowthRate: number | null;
}
```

- [ ] **Step 2.5: Run the test and confirm it passes**

Run: `npm run test:run -- src/lib/journey/__tests__/business-snapshot-baseline-metrics.test.ts`
Expected: PASS.

- [ ] **Step 2.6: Type-check the whole codebase**

Run: `npx tsc --noEmit`
Expected: exit 0. If any existing consumer of the business snapshot now breaks because `baselineMetrics` is treated as mandatory somewhere, fix those callers to use optional chaining (`snapshot.baselineMetrics?.currentCac`).

- [ ] **Step 2.7: Commit**

```bash
git add $SNAPSHOT_FILE src/lib/journey/__tests__/business-snapshot-baseline-metrics.test.ts
git commit -m "feat(journey): add baselineMetrics to business_snapshot schema

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: cacModelSchema — make economic fields nullable and add insufficientData sibling

**Files:**
- Modify: `src/lib/media-plan/schemas.ts:526-553`
- Modify: `src/lib/media-plan/types.ts` (keep CACModel type aligned with schema)
- Extend test: `src/lib/journey/__tests__/research-result-contract.test.ts`

- [ ] **Step 3.1: Write the failing contract test**

Append to `src/lib/journey/__tests__/research-result-contract.test.ts`:

```ts
describe('cacModelSchema nullable fields', () => {
  // Lazy import to avoid pulling media-plan into journey test bootstrap.
  async function loadSchema() {
    const mod = await import('@/lib/media-plan/schemas');
    return mod.cacModelSchema ?? mod.performanceModelSchema.shape.cacModel;
  }

  it('accepts all nullable fields set to null', async () => {
    const cacModelSchema = await loadSchema();
    const result = cacModelSchema.safeParse({
      targetCAC: null,
      targetCPL: null,
      leadToSqlRate: null,
      sqlToCustomerRate: null,
      expectedMonthlyLeads: null,
      expectedMonthlySQLs: null,
      expectedMonthlyCustomers: null,
      estimatedLTV: null,
      ltvToCacRatio: null,
      insufficientData: ['estimatedLTV: no avgCustomerLtv provided'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a legacy payload without insufficientData', async () => {
    const cacModelSchema = await loadSchema();
    const result = cacModelSchema.safeParse({
      targetCAC: 450,
      targetCPL: 85,
      leadToSqlRate: 22,
      sqlToCustomerRate: 25,
      expectedMonthlyLeads: 47,
      expectedMonthlySQLs: 10,
      expectedMonthlyCustomers: 3,
      estimatedLTV: 3600,
      ltvToCacRatio: '8.0:1 — Healthy',
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 3.2: Run the test and confirm it fails**

Run: `npm run test:run -- src/lib/journey/__tests__/research-result-contract.test.ts`
Expected: FAIL — null values rejected because current fields are `z.number()` without `.nullable()`.

- [ ] **Step 3.3: Export `cacModelSchema` from schemas.ts**

Edit `src/lib/media-plan/schemas.ts:526`. Change the `const cacModelSchema` declaration to `export const cacModelSchema`. This makes the test's lazy import work.

- [ ] **Step 3.4: Make the economic fields nullable and add the sibling**

In the same file, rewrite the `cacModelSchema` body (lines ~527-553):

```ts
export const cacModelSchema = z.object({
  targetCAC: z.number().nullable()
    .describe('Target customer acquisition cost in USD. Null if neither currentCac nor conversion funnel can be resolved.'),

  targetCPL: z.number().nullable()
    .describe('Target cost per lead in USD. Null if no benchmark is available.'),

  leadToSqlRate: z.number().min(0).max(100).nullable()
    .describe('Expected lead-to-SQL conversion rate as percentage. Null if leadToCustomerRate was not provided.'),

  sqlToCustomerRate: z.number().min(0).max(100).nullable()
    .describe('Expected SQL-to-customer close rate as percentage. Null if leadToCustomerRate was not provided.'),

  expectedMonthlyLeads: z.number().nullable()
    .describe('Expected monthly leads at effective spend (80% of budget). Null if targetCPL is null.'),

  expectedMonthlySQLs: z.number().nullable()
    .describe('Expected monthly SQLs. Null if expectedMonthlyLeads or leadToSqlRate is null.'),

  expectedMonthlyCustomers: z.number().nullable()
    .describe('Expected monthly new customers. Null if the conversion cascade cannot be resolved.'),

  estimatedLTV: z.number().nullable()
    .describe('Customer lifetime value in USD. Null unless avgCustomerLtv was provided by the user. NEVER computed from offerPrice × retention heuristics.'),

  ltvToCacRatio: z.string().nullable()
    .describe('Projected LTV:CAC ratio (e.g., "5.2:1 — Healthy"). Null if either estimatedLTV or targetCAC is null.'),

  insufficientData: z.array(z.string()).optional()
    .describe('List of cac-model fields that were null because the required baseline metric was not provided. Example: ["estimatedLTV: no avgCustomerLtv provided"]. Absent when all fields resolved.'),
}).describe('CAC funnel math model with nullable fields when baseline metrics are missing');
```

**Verify before saving:** The existing `.min(0).max(100)` on `leadToSqlRate` and `sqlToCustomerRate` is preserved. These fields already shipped with those constraints, so the Anthropic API path must already tolerate them at this schema — leave them in place.

- [ ] **Step 3.5: Update the CACModel TypeScript type**

Open `src/lib/media-plan/types.ts`. Locate the `CACModel` interface. Update each affected field to allow `null`, and add the `insufficientData` field:

```ts
export interface CACModel {
  targetCAC: number | null;
  targetCPL: number | null;
  leadToSqlRate: number | null;
  sqlToCustomerRate: number | null;
  expectedMonthlyLeads: number | null;
  expectedMonthlySQLs: number | null;
  expectedMonthlyCustomers: number | null;
  estimatedLTV: number | null;
  ltvToCacRatio: string | null;
  insufficientData?: string[];
}
```

- [ ] **Step 3.6: Run the contract test and confirm it passes**

Run: `npm run test:run -- src/lib/journey/__tests__/research-result-contract.test.ts`
Expected: PASS.

- [ ] **Step 3.7: Type-check the codebase**

Run: `npx tsc --noEmit`
Expected: exit 0 OR a predictable set of new errors in downstream consumers that assume `estimatedLTV: number` instead of `number | null`. These will be fixed in Task 5 and later. If you get errors outside the media-plan folder and those consumers are not part of subsequent tasks, add a follow-up task at the end of the plan instead of trying to fix them here.

- [ ] **Step 3.8: Commit**

```bash
git add src/lib/media-plan/schemas.ts src/lib/media-plan/types.ts src/lib/journey/__tests__/research-result-contract.test.ts
git commit -m "feat(media-plan): make cacModel fields nullable, add insufficientData sibling

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: sensitivityAnalysis schema — make scenarios nullable

**Files:**
- Modify: `src/lib/journey/schemas/icp-validation.ts:118-146`
- Extend test: `src/lib/journey/__tests__/research-result-contract.test.ts`

- [ ] **Step 4.1: Write the failing test**

Append to `src/lib/journey/__tests__/research-result-contract.test.ts`:

```ts
describe('sensitivityAnalysis nullable scenarios', () => {
  it('accepts all scenarios set to null', async () => {
    const { icpValidationSchema } = await import('../schemas/icp-validation');
    // Build a minimal valid payload by shallow-parsing the part we care about.
    const result = icpValidationSchema.partial().safeParse({
      sensitivityAnalysis: {
        bestCase: null,
        baseCase: null,
        worstCase: null,
        breakEven: null,
        insufficientData: ['breakEven: no avgCustomerLtv provided'],
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a legacy fully-populated payload', async () => {
    const { icpValidationSchema } = await import('../schemas/icp-validation');
    const result = icpValidationSchema.partial().safeParse({
      sensitivityAnalysis: {
        bestCase: { assumedCPL: 60, leadToSqlRate: 20, sqlToCustomerRate: 30, conditions: 'n' },
        baseCase: { assumedCPL: 85, leadToSqlRate: 15, sqlToCustomerRate: 25, conditions: 'n', confidencePercent: 65 },
        worstCase: { assumedCPL: 120, leadToSqlRate: 10, sqlToCustomerRate: 20, conditions: 'n' },
        breakEven: { maxCPLFor3xLTV: 100, maxCAC: 300, minLeadToSqlRate: 12, budgetFloorForTesting: 3000 },
      },
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 4.2: Run the test and confirm it fails**

Run: `npm run test:run -- src/lib/journey/__tests__/research-result-contract.test.ts`
Expected: FAIL — null not allowed on the scenario objects.

- [ ] **Step 4.3: Make the scenarios nullable and add insufficientData**

Edit `src/lib/journey/schemas/icp-validation.ts:118-146`. Rewrite the `sensitivityAnalysis` field:

```ts
sensitivityAnalysis: z
  .object({
    bestCase: z
      .object({
        assumedCPL: z.number(),
        leadToSqlRate: z.number(),
        sqlToCustomerRate: z.number(),
        conditions: nonEmptyStringSchema,
      })
      .nullable(),
    baseCase: z
      .object({
        assumedCPL: z.number(),
        leadToSqlRate: z.number(),
        sqlToCustomerRate: z.number(),
        conditions: nonEmptyStringSchema,
        confidencePercent: z.number(),
      })
      .nullable(),
    worstCase: z
      .object({
        assumedCPL: z.number(),
        leadToSqlRate: z.number(),
        sqlToCustomerRate: z.number(),
        conditions: nonEmptyStringSchema,
      })
      .nullable(),
    breakEven: z
      .object({
        maxCPLFor3xLTV: z.number().nullable(),
        maxCAC: z.number().nullable(),
        minLeadToSqlRate: z.number().nullable(),
        budgetFloorForTesting: z.number().nullable(),
      })
      .nullable(),
    insufficientData: z.array(z.string()).optional(),
  })
  .optional(),
```

- [ ] **Step 4.4: Run the contract test and confirm it passes**

Run: `npm run test:run -- src/lib/journey/__tests__/research-result-contract.test.ts`
Expected: PASS.

- [ ] **Step 4.5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0 or only a small, predictable set of errors in ICP runner code that assumed the fields were non-null (those get fixed in Task 12).

- [ ] **Step 4.6: Commit**

```bash
git add src/lib/journey/schemas/icp-validation.ts src/lib/journey/__tests__/research-result-contract.test.ts
git commit -m "feat(icp): make sensitivityAnalysis scenarios nullable with insufficientData sibling

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Rewrite `computeCACModel` — nullable inputs, no retention heuristic

**Files:**
- Modify: `src/lib/media-plan/validation.ts`
- Create: `src/lib/media-plan/__tests__/validation-cac-model.test.ts`

- [ ] **Step 5.1: Write the full failing test matrix**

Create `src/lib/media-plan/__tests__/validation-cac-model.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as validationModule from '../validation';
import { computeCACModel } from '../validation';

describe('computeCACModel — nullable inputs', () => {
  const base = {
    monthlyBudget: 10000,
    targetCPL: null,
    leadToCustomerRate: null,
    currentCac: null,
    avgCustomerLtv: null,
  };

  it('returns all-null economics when every baseline metric is missing', () => {
    const { cacModel, insufficientData } = computeCACModel(base);
    expect(cacModel.estimatedLTV).toBeNull();
    expect(cacModel.ltvToCacRatio).toBeNull();
    expect(cacModel.targetCAC).toBeNull();
    expect(cacModel.expectedMonthlyCustomers).toBeNull();
    expect(cacModel.expectedMonthlyLeads).toBeNull();
    expect(cacModel.expectedMonthlySQLs).toBeNull();
    expect(cacModel.leadToSqlRate).toBeNull();
    expect(cacModel.sqlToCustomerRate).toBeNull();
    expect(insufficientData.length).toBeGreaterThanOrEqual(3);
    expect(insufficientData).toEqual(expect.arrayContaining([
      expect.stringContaining('estimatedLTV'),
      expect.stringContaining('leadToCustomerRate'),
    ]));
  });

  it('honors user-provided currentCac as targetCAC', () => {
    const { cacModel } = computeCACModel({ ...base, currentCac: 450 });
    expect(cacModel.targetCAC).toBe(450);
    expect(cacModel.estimatedLTV).toBeNull();
    expect(cacModel.ltvToCacRatio).toBeNull();
  });

  it('honors user-provided avgCustomerLtv as estimatedLTV (no retention multiplier)', () => {
    const { cacModel } = computeCACModel({ ...base, avgCustomerLtv: 3600, currentCac: 450 });
    expect(cacModel.estimatedLTV).toBe(3600);
    expect(cacModel.ltvToCacRatio).toBe('8.0:1 — Healthy');
  });

  it('computes the full deterministic cascade when all four metrics are provided', () => {
    const { cacModel, insufficientData } = computeCACModel({
      monthlyBudget: 10000,
      targetCPL: 50,
      leadToCustomerRate: 4, // 4%
      currentCac: 500,
      avgCustomerLtv: 4000,
    });
    // effectiveBudget = 10000 * 0.8 = 8000
    // expectedMonthlyLeads = round(8000 / 50) = 160
    // expectedMonthlyCustomers = max(1, round(160 * 4 / 100)) = round(6.4) = 6
    expect(cacModel.expectedMonthlyLeads).toBe(160);
    expect(cacModel.expectedMonthlyCustomers).toBe(6);
    // stageRate = sqrt(0.04) * 100 = 20
    expect(cacModel.leadToSqlRate).toBe(20);
    expect(cacModel.sqlToCustomerRate).toBe(20);
    // user-provided currentCac wins over derived CAC
    expect(cacModel.targetCAC).toBe(500);
    expect(cacModel.estimatedLTV).toBe(4000);
    expect(cacModel.ltvToCacRatio).toBe('8.0:1 — Healthy');
    expect(insufficientData).toEqual([]);
  });

  it('labels sub-3 ratios as "Below ideal"', () => {
    const { cacModel } = computeCACModel({ ...base, currentCac: 1000, avgCustomerLtv: 2000 });
    expect(cacModel.ltvToCacRatio).toBe('2.0:1 — Below ideal (target >3:1)');
  });

  it('labels sub-1 ratios as "Unsustainable"', () => {
    const { cacModel } = computeCACModel({ ...base, currentCac: 5000, avgCustomerLtv: 2000 });
    expect(cacModel.ltvToCacRatio).toBe('0.4:1 — Unsustainable');
  });
});

describe('validation module — estimateRetentionMultiplier is removed', () => {
  it('no longer exports estimateRetentionMultiplier', () => {
    expect((validationModule as Record<string, unknown>).estimateRetentionMultiplier).toBeUndefined();
  });
});
```

- [ ] **Step 5.2: Run the test and confirm it fails**

Run: `npm run test:run -- src/lib/media-plan/__tests__/validation-cac-model.test.ts`
Expected: FAIL — the old `computeCACModel` signature requires `offerPrice` and `retentionMultiplier`; the removal test fails because `estimateRetentionMultiplier` still exports.

- [ ] **Step 5.3: Rewrite computeCACModel in validation.ts**

Edit `src/lib/media-plan/validation.ts`. Replace the entire `CACModelInput` interface and `computeCACModel` function (currently around lines 41-252) with:

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

/**
 * Pure-arithmetic CAC model with nullable inputs.
 *
 * Every output field is null when the required baseline metric is missing.
 * No fallback heuristics. `insufficientData` lists which user inputs would
 * unlock each null field — this drives the UI's empty-state CTA copy.
 */
export function computeCACModel(input: CACModelInput): CACModelResult {
  const { monthlyBudget, targetCPL, leadToCustomerRate, currentCac, avgCustomerLtv } = input;
  const insufficientData: string[] = [];

  // Lead volume requires a targetCPL (may come from benchmarks, not baseline metrics).
  const safeCPL = targetCPL && targetCPL > 0 ? targetCPL : null;
  const effectiveBudget = monthlyBudget * 0.80;
  const expectedMonthlyLeads = safeCPL ? Math.round(effectiveBudget / safeCPL) : null;
  if (safeCPL === null) {
    insufficientData.push('expectedMonthlyLeads: no targetCPL provided');
  }

  // Conversion cascade requires user-reported lead→customer rate.
  let expectedMonthlyCustomers: number | null = null;
  let leadToSqlRate: number | null = null;
  let sqlToCustomerRate: number | null = null;
  let expectedMonthlySQLs: number | null = null;

  if (leadToCustomerRate !== null && leadToCustomerRate > 0 && expectedMonthlyLeads !== null) {
    expectedMonthlyCustomers = Math.max(1, Math.round((expectedMonthlyLeads * leadToCustomerRate) / 100));
    // Split the single user rate across the two-stage schema via sqrt distribution.
    // If leadToCustomerRate = 4%, each stage is ~20%, and 0.2 * 0.2 = 0.04 = 4% overall.
    const stageRate = Math.round(Math.sqrt(leadToCustomerRate / 100) * 100 * 10) / 10;
    leadToSqlRate = stageRate;
    sqlToCustomerRate = stageRate;
    expectedMonthlySQLs = Math.round((expectedMonthlyLeads * stageRate) / 100);
  } else {
    insufficientData.push('expectedMonthlyCustomers: no leadToCustomerRate provided');
  }

  // CAC: honor the user's reported number. Fall back to derived only if we have customers.
  let targetCAC: number | null = null;
  if (currentCac !== null && currentCac > 0) {
    targetCAC = currentCac;
  } else if (expectedMonthlyCustomers !== null) {
    targetCAC = Math.round(monthlyBudget / expectedMonthlyCustomers);
  } else {
    insufficientData.push('targetCAC: no currentCac and no leadToCustomerRate provided');
  }

  // LTV: user-provided only. No heuristic.
  const estimatedLTV = avgCustomerLtv !== null && avgCustomerLtv > 0 ? avgCustomerLtv : null;
  if (estimatedLTV === null) {
    insufficientData.push('estimatedLTV: no avgCustomerLtv provided');
  }

  // Ratio: requires both.
  let ltvToCacRatio: string | null = null;
  if (estimatedLTV !== null && targetCAC !== null && targetCAC > 0) {
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
      expectedMonthlySQLs,
      expectedMonthlyCustomers,
      estimatedLTV,
      ltvToCacRatio,
      insufficientData: insufficientData.length > 0 ? insufficientData : undefined,
    },
    insufficientData,
  };
}
```

- [ ] **Step 5.4: Delete `estimateRetentionMultiplier`**

In the same file, locate `estimateRetentionMultiplier` (currently around line 1372) and delete the function AND its section comment header (`// Retention Multiplier Heuristic`). No deprecation shim, no stub.

- [ ] **Step 5.5: Run the test and confirm it passes**

Run: `npm run test:run -- src/lib/media-plan/__tests__/validation-cac-model.test.ts`
Expected: PASS on all cases including the removal assertion.

- [ ] **Step 5.6: Commit**

```bash
git add src/lib/media-plan/validation.ts src/lib/media-plan/__tests__/validation-cac-model.test.ts
git commit -m "refactor(media-plan): rewrite computeCACModel with nullable inputs, delete retention heuristic

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Fix all existing callers of `computeCACModel` and `estimateRetentionMultiplier`

**Files:**
- Modify: `src/lib/media-plan/pipeline.ts`
- Modify: `src/lib/media-plan/index.ts`
- Possibly modify: other files discovered by grep in Step 6.1

- [ ] **Step 6.1: Grep for callers**

Run:
```bash
grep -rn "computeCACModel\|estimateRetentionMultiplier\|buildPerformanceModel" src research-worker --include="*.ts" | grep -v __tests__
```

Record the file list. Expected hits: `src/lib/media-plan/pipeline.ts`, `src/lib/media-plan/validation.ts` (self-references, already handled), `src/lib/media-plan/index.ts` (re-export). If anything outside `src/lib/media-plan/` shows up, fix it in this task too.

- [ ] **Step 6.2: Run the full build to see every type error**

Run: `npx tsc --noEmit`
Record every error related to `CACModelInput`, `computeCACModel`, `estimateRetentionMultiplier`, or `estimatedLTV` being `null`. Expected: a short list.

- [ ] **Step 6.3: Fix `src/lib/media-plan/index.ts`**

Remove `estimateRetentionMultiplier` from the re-export list. The existing block (around line 80-87) has:

```ts
export {
  validateAndFixBudget,
  computeCACModel,
  validateCrossSection,
  reconcileKPITargets,
  estimateRetentionMultiplier,
} from './validation';
```

Delete the `estimateRetentionMultiplier,` line. Leave the rest.

- [ ] **Step 6.4: Fix `src/lib/media-plan/pipeline.ts`**

Locate the `CACModelInput` construction around line 297. It currently reads:

```ts
const retentionMultiplier = estimateRetentionMultiplier(onboarding.productOffer.pricingModel);

const cacInput: CACModelInput = {
  monthlyBudget: budgetAllocation.totalMonthlyBudget,
  targetCPL,
  leadToSqlRate,
  sqlToCustomerRate,
  offerPrice: onboarding.productOffer.offerPrice,
  retentionMultiplier,
};
```

Replace with:

```ts
const baselineMetrics = onboarding.baselineMetrics ?? {};

const cacInput: CACModelInput = {
  monthlyBudget: budgetAllocation.totalMonthlyBudget,
  targetCPL: targetCPL ?? null,
  leadToCustomerRate: baselineMetrics.leadToCustomerRate ?? null,
  currentCac: baselineMetrics.currentCac ?? null,
  avgCustomerLtv: baselineMetrics.avgCustomerLtv ?? null,
};
```

Also remove `estimateRetentionMultiplier` from the top-of-file import statement (around line 51-54).

- [ ] **Step 6.5: Wire the insufficientData into the performance model**

Directly after the above, locate `buildPerformanceModel(cacInput, monitoringSchedule)` and change it to read the result shape:

```ts
const cacResult = computeCACModel(cacInput);
const performanceModel: PerformanceModel = buildPerformanceModel(
  cacResult.cacModel,
  monitoringSchedule,
);
const cacInsufficientData = cacResult.insufficientData;
```

Where `cacInsufficientData` is later attached to the media plan output (verify the output shape during implementation; if `PerformanceModel` has an `insufficientData` field slot, use it; otherwise store it alongside on the enclosing `mediaPlan.measurementGuardrails` shape).

- [ ] **Step 6.6: Update `buildPerformanceModel` signature if needed**

Open `src/lib/media-plan/validation.ts`. If `buildPerformanceModel` currently takes `(cacInput: CACModelInput, monitoringSchedule)` and internally calls `computeCACModel`, refactor it to take a pre-computed `(cacModel: CACModel, monitoringSchedule)` instead, so the caller can intercept the `insufficientData`:

```ts
export function buildPerformanceModel(
  cacModel: CACModel,
  monitoringSchedule: MonitoringSchedule,
): PerformanceModel {
  return {
    cacModel,
    monitoringSchedule,
  };
}
```

Update any other caller that assumed the old signature.

- [ ] **Step 6.7: Also check if `onboarding.baselineMetrics` is typed in the pipeline's onboarding parameter**

If TypeScript errors say `Property 'baselineMetrics' does not exist`, locate the onboarding type used by `pipeline.ts` and add the optional field:

```ts
baselineMetrics?: {
  currentCac: number | null;
  avgCustomerLtv: number | null;
  leadToCustomerRate: number | null;
  last12MoGrowthRate: number | null;
};
```

- [ ] **Step 6.8: Type-check the whole codebase**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6.9: Run the full media-plan test suite**

Run: `npm run test:run -- src/lib/media-plan`
Expected: all tests pass. Any pre-existing test that asserted `estimatedLTV` was a number will now fail because it can be null — update those assertions to match the new contract (`expect(cacModel.estimatedLTV).toBe(null)` or `.not.toBeNull()` depending on the fixture). Do NOT loosen assertions; fix them to be as precise as the new behavior allows.

- [ ] **Step 6.10: Commit**

```bash
git add src/lib/media-plan/pipeline.ts src/lib/media-plan/index.ts src/lib/media-plan/validation.ts
git commit -m "refactor(media-plan): wire pipeline to new computeCACModel signature, drop retention-multiplier path

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `sweepFabricatedClaims` — the runtime prose guard

**Files:**
- Modify: `src/lib/media-plan/validation.ts` (append new function)
- Create: `src/lib/media-plan/__tests__/sweep-fabricated-claims.test.ts`

- [ ] **Step 7.1: Write the true-positive + true-negative test matrix**

Create `src/lib/media-plan/__tests__/sweep-fabricated-claims.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sweepFabricatedClaims } from '../validation';

describe('sweepFabricatedClaims — true positives (must be stripped)', () => {
  const FABRICATIONS = [
    'Targeting 30% YoY growth through aggressive paid spend.',
    'We expect 45% year-over-year growth.',
    'Aiming for 25% annualized growth across all channels.',
    'Expected to scale to $5M ARR in 18 months.',
    'Scale to $10M ARR in 24 months with this plan.',
    'Scale to $500K in revenue in 12 months.',
    'Growing from $500K to $2M ARR over the next year.',
    'Grow by $1M ARR this year.',
    'Plan to reach $10M ARR by end of year.',
    'Reach $3M ARR through paid acquisition.',
    'This positions you for 50% YoY growth.',
    'Project 40% annual growth in the B2B segment.',
  ];

  it.each(FABRICATIONS)('strips: %s', (sentence) => {
    const { clean, stripped } = sweepFabricatedClaims(sentence, false, null);
    expect(clean).not.toBe(sentence);
    expect(stripped.length).toBeGreaterThanOrEqual(1);
    expect(clean).toContain('[growth rate not tracked]');
  });
});

describe('sweepFabricatedClaims — true negatives (must pass unchanged)', () => {
  const LEGITIMATE = [
    'Industry benchmark: B2B SaaS sees 20-35% annual growth per Gartner 2025.',
    'Scale winning ad sets after 7 days of sustained CPL.',
    'Reach 10 million impressions monthly with the primary budget.',
    'Growth marketing requires consistent creative refresh.',
    'Scale spend gradually based on ROAS thresholds.',
    'This campaign drives brand awareness.',
    'Expected monthly leads: 120.',
    'LTV benchmarks range from $3000 to $8000 in this vertical.',
    'Customer retention in SaaS averages 12 months according to OpenView.',
    'Grow your email list through lead magnets.',
    'Reach younger demographics via TikTok.',
    'Scale creative testing in Phase 2.',
  ];

  it.each(LEGITIMATE)('passes: %s', (sentence) => {
    const { clean, stripped } = sweepFabricatedClaims(sentence, false, null);
    expect(clean).toBe(sentence);
    expect(stripped).toEqual([]);
  });
});

describe('sweepFabricatedClaims — growth-rate gating', () => {
  it('permits a growth claim that cites the user-reported rate', () => {
    const sentence = 'Based on your reported 25% trailing twelve-month growth, this plan scales proportionally.';
    const { clean, stripped } = sweepFabricatedClaims(sentence, true, 25);
    expect(clean).toBe(sentence);
    expect(stripped).toEqual([]);
  });

  it('still strips a different growth number even when growth claims are allowed', () => {
    const sentence = 'Targeting 40% YoY growth.';
    const { clean, stripped } = sweepFabricatedClaims(sentence, true, 25);
    expect(clean).not.toBe(sentence);
    expect(stripped.length).toBe(1);
  });

  it('strips all growth claims when allowGrowthClaims is false even if userGrowthRate is provided', () => {
    const sentence = 'Targeting 25% YoY growth.';
    const { clean } = sweepFabricatedClaims(sentence, false, 25);
    expect(clean).not.toBe(sentence);
  });
});
```

- [ ] **Step 7.2: Run the test and confirm it fails**

Run: `npm run test:run -- src/lib/media-plan/__tests__/sweep-fabricated-claims.test.ts`
Expected: FAIL — `sweepFabricatedClaims` is not exported.

- [ ] **Step 7.3: Implement sweepFabricatedClaims**

Append to `src/lib/media-plan/validation.ts` (e.g., after the CAC model section):

```ts
// =============================================================================
// Fabricated Claim Sweep
// =============================================================================

interface SweepPattern {
  name: string;
  re: RegExp;
  gated: boolean; // gated patterns can be kept if the sentence cites userGrowthRate
}

const FABRICATION_PATTERNS: readonly SweepPattern[] = [
  {
    name: 'yoy_growth',
    re: /\d+\s*%\s*(?:YoY|year[- ]over[- ]year|annual(?:ized)?\s*growth)/gi,
    gated: true,
  },
  {
    name: 'scale_to_arr',
    re: /scale\s+to\s+\$[\d.,]+\s*[MBK]?\s*(?:ARR|MRR|in revenue)?(?:\s+(?:in|within|over)\s+\d+\s*(?:months?|years?))?/gi,
    gated: false,
  },
  {
    name: 'grow_from_to',
    re: /grow(?:ing)?\s+(?:from|by)\s+\$[\d.,]+\s*[MBK]?(?:\s+to\s+\$[\d.,]+\s*[MBK]?)?/gi,
    gated: false,
  },
  {
    name: 'reach_arr',
    re: /reach\s+\$[\d.,]+\s*[MBK]?\s+ARR/gi,
    gated: false,
  },
];

export interface SweepResult {
  clean: string;
  stripped: string[];
}

/**
 * Scrubs fabricated growth/ARR/scale prose from narrative text fields.
 *
 * - `allowGrowthClaims` is true only when the user provided last12MoGrowthRate.
 * - A gated pattern (like YoY growth %) is kept if the matched sentence contains
 *   the user's exact reported rate. Any other growth number is stripped.
 * - Every strip is logged via console.warn for auditing prompt regressions.
 */
export function sweepFabricatedClaims(
  text: string,
  allowGrowthClaims: boolean,
  userGrowthRate: number | null,
): SweepResult {
  let clean = text;
  const stripped: string[] = [];
  const userRateStr = userGrowthRate !== null ? String(Math.round(userGrowthRate)) : null;

  for (const pattern of FABRICATION_PATTERNS) {
    clean = clean.replace(pattern.re, (match) => {
      if (pattern.gated && allowGrowthClaims && userRateStr !== null) {
        // Extract the number from the matched fragment and compare.
        const numberMatch = match.match(/(\d+)\s*%/);
        if (numberMatch && numberMatch[1] === userRateStr) {
          return match; // keep — cites the user-reported rate
        }
      }
      stripped.push(`${pattern.name}: ${match}`);
      // eslint-disable-next-line no-console
      console.warn(
        `[fabrication-sweep] stripped pattern=${pattern.name} match="${match}"`,
      );
      return '[growth rate not tracked]';
    });
  }

  return { clean, stripped };
}
```

- [ ] **Step 7.4: Run the test and confirm it passes**

Run: `npm run test:run -- src/lib/media-plan/__tests__/sweep-fabricated-claims.test.ts`
Expected: PASS on every matrix entry.

- [ ] **Step 7.5: Commit**

```bash
git add src/lib/media-plan/validation.ts src/lib/media-plan/__tests__/sweep-fabricated-claims.test.ts
git commit -m "feat(media-plan): add sweepFabricatedClaims runtime guard for growth/ARR prose

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Wire `sweepFabricatedClaims` into the media-plan pipeline and synthesize post-processing

**Files:**
- Modify: `src/lib/media-plan/pipeline.ts`
- Modify: `src/lib/media-plan/validation.ts` (or wherever media-plan output post-processing lives)

- [ ] **Step 8.1: Write the integration test**

Append to `src/lib/media-plan/__tests__/sweep-fabricated-claims.test.ts`:

```ts
describe('sweepFabricatedClaims — pipeline integration', () => {
  it('is applied to executiveSummary.overview when the pipeline runs', async () => {
    // Use a minimal mock of runPipelineSection or the post-process helper that
    // applies the sweep. Exact function name discovered during implementation.
    // This test documents the contract: fabricated input → cleaned output.
    const dirty = 'Targeting 30% YoY growth. Scale to $5M ARR in 18 months.';
    const { sweepExecutiveSummary } = await import('../validation');
    const result = sweepExecutiveSummary({ overview: dirty }, false, null);
    expect(result.overview).not.toContain('30%');
    expect(result.overview).not.toContain('$5M ARR');
    expect(result.overview).toContain('[growth rate not tracked]');
  });
});
```

- [ ] **Step 8.2: Run the test and confirm it fails**

Run: `npm run test:run -- src/lib/media-plan/__tests__/sweep-fabricated-claims.test.ts`
Expected: FAIL — `sweepExecutiveSummary` does not exist yet.

- [ ] **Step 8.3: Implement narrative-field sweep helpers**

Append to `src/lib/media-plan/validation.ts`:

```ts
/** Apply the fabrication sweep to an executive summary. */
export function sweepExecutiveSummary<T extends { overview: string }>(
  summary: T,
  allowGrowthClaims: boolean,
  userGrowthRate: number | null,
): T {
  const { clean } = sweepFabricatedClaims(summary.overview, allowGrowthClaims, userGrowthRate);
  return { ...summary, overview: clean };
}

/** Apply the fabrication sweep to every campaign phase description. */
export function sweepCampaignPhases<T extends { description?: string }>(
  phases: readonly T[],
  allowGrowthClaims: boolean,
  userGrowthRate: number | null,
): T[] {
  return phases.map((p) => {
    if (!p.description) return p;
    const { clean } = sweepFabricatedClaims(p.description, allowGrowthClaims, userGrowthRate);
    return { ...p, description: clean };
  });
}

/** Apply the fabrication sweep to a strategic narrative string. */
export function sweepStrategicNarrative(
  narrative: string,
  allowGrowthClaims: boolean,
  userGrowthRate: number | null,
): string {
  return sweepFabricatedClaims(narrative, allowGrowthClaims, userGrowthRate).clean;
}
```

- [ ] **Step 8.4: Call the sweep from the media-plan pipeline**

Edit `src/lib/media-plan/pipeline.ts`. After the final `mediaPlan` object is assembled (near where `validateCrossSection` or similar post-processing runs — grep for the last step before the return), add:

```ts
const baselineMetrics = onboarding.baselineMetrics ?? {};
const allowGrowthClaims = baselineMetrics.last12MoGrowthRate !== null && baselineMetrics.last12MoGrowthRate !== undefined;
const userGrowthRate = baselineMetrics.last12MoGrowthRate ?? null;

mediaPlan.executiveSummary = sweepExecutiveSummary(
  mediaPlan.executiveSummary,
  allowGrowthClaims,
  userGrowthRate,
);
mediaPlan.campaignPhases = sweepCampaignPhases(
  mediaPlan.campaignPhases,
  allowGrowthClaims,
  userGrowthRate,
);
```

Add `sweepExecutiveSummary`, `sweepCampaignPhases` to the `./validation` import at the top of the file.

- [ ] **Step 8.5: Call the sweep from synthesize post-processing**

Grep for where `strategicNarrative` is read out of the synthesize runner result:

```bash
grep -rn "strategicNarrative" src research-worker --include="*.ts" | grep -v __tests__ | grep -v "schemas/"
```

Find the post-processing step where the synthesize result is written to the journey session (likely in `src/lib/ai/tools/research/` or in the dispatch route's result handler). Apply the sweep there:

```ts
import { sweepStrategicNarrative } from '@/lib/media-plan/validation';
// ...
if (typeof synthesisResult.strategicNarrative === 'string') {
  synthesisResult.strategicNarrative = sweepStrategicNarrative(
    synthesisResult.strategicNarrative,
    Boolean(baselineMetrics?.last12MoGrowthRate),
    baselineMetrics?.last12MoGrowthRate ?? null,
  );
}
```

If the synthesize result is consumed by multiple paths, add the sweep in the lowest-level shared writer so every consumer sees sanitized text. If no single funnel exists, add the sweep in the dispatch route's synthesize-result handler.

- [ ] **Step 8.6: Run the integration test and confirm it passes**

Run: `npm run test:run -- src/lib/media-plan/__tests__/sweep-fabricated-claims.test.ts`
Expected: PASS.

- [ ] **Step 8.7: Run the full media-plan suite as a regression check**

Run: `npm run test:run -- src/lib/media-plan`
Expected: all green.

- [ ] **Step 8.8: Commit**

```bash
git add src/lib/media-plan/validation.ts src/lib/media-plan/pipeline.ts src/lib/media-plan/__tests__/sweep-fabricated-claims.test.ts
# plus any synthesize-post-processing file you edited in 8.5
git commit -m "feat(media-plan): apply sweepFabricatedClaims to executive summary, phases, narrative

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Dispatch forwards `baselineMetrics` to the worker context

**Files:**
- Modify: `src/lib/ai/tools/research/dispatch.ts` (or wherever `dispatchResearchForUser` builds the worker request body — grep in Step 9.1)
- Create: `src/app/api/journey/__tests__/dispatch-baseline-metrics.test.ts`

- [ ] **Step 9.1: Locate the dispatch helper**

Run:
```bash
grep -rn "dispatchResearchForUser" src --include="*.ts" -l
```

Expected output includes `src/app/api/journey/dispatch/route.ts` (the route handler) and the module where the function is defined. Record the definition file as `$DISPATCH_FILE`. Open it and find where the worker request body is constructed — look for the call to the Railway worker (`RAILWAY_WORKER_URL` or a `fetch` to `/run`).

- [ ] **Step 9.2: Write the failing test**

Create `src/app/api/journey/__tests__/dispatch-baseline-metrics.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch to capture the worker request body.
const capturedCalls: Array<{ url: string; body: Record<string, unknown> }> = [];

beforeEach(() => {
  capturedCalls.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    capturedCalls.push({
      url: String(url),
      body: JSON.parse(String(init.body ?? '{}')),
    });
    return new Response(JSON.stringify({ runId: 'run-123' }), { status: 202 });
  }));
  process.env.RAILWAY_WORKER_URL = 'http://localhost:3001';
  process.env.RAILWAY_API_KEY = 'dev-secret';
});

describe('dispatchResearchForUser — baselineMetrics forwarding', () => {
  it('forwards baselineMetrics under context when present on the snapshot', async () => {
    const { dispatchResearchForUser } = await import('@/lib/ai/tools/research/dispatch');
    await dispatchResearchForUser({
      userId: 'user-1',
      runId: 'run-1',
      section: 'mediaPlan',
      onboarding: {
        companyName: 'Acme',
        baselineMetrics: {
          currentCac: 450,
          avgCustomerLtv: null,
          leadToCustomerRate: 5,
          last12MoGrowthRate: null,
        },
      } as never,
      priorResults: {},
    });
    expect(capturedCalls.length).toBe(1);
    const body = capturedCalls[0].body as Record<string, unknown>;
    const context = body.context as Record<string, unknown>;
    expect(context.baselineMetrics).toEqual({
      currentCac: 450,
      avgCustomerLtv: null,
      leadToCustomerRate: 5,
      last12MoGrowthRate: null,
    });
  });

  it('omits baselineMetrics from context when the snapshot has no baselineMetrics key', async () => {
    const { dispatchResearchForUser } = await import('@/lib/ai/tools/research/dispatch');
    await dispatchResearchForUser({
      userId: 'user-1',
      runId: 'run-1',
      section: 'mediaPlan',
      onboarding: { companyName: 'Acme' } as never,
      priorResults: {},
    });
    const body = capturedCalls[0].body as Record<string, unknown>;
    const context = body.context as Record<string, unknown>;
    expect(context.baselineMetrics).toBeUndefined();
  });
});
```

**Note:** The `dispatchResearchForUser` signature is assumed; grep it in Step 9.1 and adjust the test call arguments to match the real signature before running. If the real function wraps `fetch` in a different way (e.g., via a helper module), mock that helper instead.

- [ ] **Step 9.3: Run the test and confirm it fails**

Run: `npm run test:run -- src/app/api/journey/__tests__/dispatch-baseline-metrics.test.ts`
Expected: FAIL — either the import path is wrong, the signature doesn't match, or the context doesn't include `baselineMetrics` (what we want to fix).

- [ ] **Step 9.4: Wire baselineMetrics into the worker request body**

Edit `$DISPATCH_FILE`. Find the object that becomes the POST body (search for `context:` or the worker URL fetch). Add the baselineMetrics pass-through:

```ts
const context = {
  // ... existing context fields (priorResults, onboarding summary, etc.)
  ...(onboarding.baselineMetrics
    ? { baselineMetrics: onboarding.baselineMetrics }
    : {}),
};
```

Use the conditional spread so the key is absent from the payload when the user hasn't provided any baseline metrics — this matches the "insufficientData is the explicit default, not a silent zero" design principle.

- [ ] **Step 9.5: Run the test and confirm it passes**

Run: `npm run test:run -- src/app/api/journey/__tests__/dispatch-baseline-metrics.test.ts`
Expected: PASS.

- [ ] **Step 9.6: Commit**

```bash
git add src/lib/ai/tools/research/dispatch.ts src/app/api/journey/__tests__/dispatch-baseline-metrics.test.ts
git commit -m "feat(dispatch): forward baselineMetrics to research worker context

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Worker helper — render the BASELINE METRICS DATA INTEGRITY block

**Files:**
- Create: `research-worker/src/baseline-metrics.ts`
- Create: `research-worker/src/__tests__/baseline-metrics.test.ts`

- [ ] **Step 10.1: Write the failing test**

Create `research-worker/src/__tests__/baseline-metrics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderBaselineMetricsBlock, type BaselineMetrics } from '../baseline-metrics';

describe('renderBaselineMetricsBlock', () => {
  it('renders "NOT PROVIDED" for every null field', () => {
    const metrics: BaselineMetrics = {
      currentCac: null,
      avgCustomerLtv: null,
      leadToCustomerRate: null,
      last12MoGrowthRate: null,
    };
    const block = renderBaselineMetricsBlock(metrics);
    expect(block).toContain('currentCac: NOT PROVIDED');
    expect(block).toContain('avgCustomerLtv: NOT PROVIDED');
    expect(block).toContain('leadToCustomerRate: NOT PROVIDED');
    expect(block).toContain('last12MoGrowthRate: NOT PROVIDED');
    expect(block).toContain('BASELINE METRICS DATA INTEGRITY');
    expect(block).toContain('NEVER invent LTV, CAC');
  });

  it('substitutes actual values when provided', () => {
    const metrics: BaselineMetrics = {
      currentCac: 450,
      avgCustomerLtv: 3600,
      leadToCustomerRate: 5,
      last12MoGrowthRate: 25,
    };
    const block = renderBaselineMetricsBlock(metrics);
    expect(block).toContain('currentCac: $450');
    expect(block).toContain('avgCustomerLtv: $3600');
    expect(block).toContain('leadToCustomerRate: 5%');
    expect(block).toContain('last12MoGrowthRate: 25%');
  });

  it('accepts undefined metrics (no baselineMetrics in context) and renders all NOT PROVIDED', () => {
    const block = renderBaselineMetricsBlock(undefined);
    expect(block).toContain('currentCac: NOT PROVIDED');
    expect(block).toContain('last12MoGrowthRate: NOT PROVIDED');
  });
});
```

- [ ] **Step 10.2: Run the test and confirm it fails**

Run: `cd research-worker && npx vitest run src/__tests__/baseline-metrics.test.ts && cd ..`
Expected: FAIL — the module does not exist. If `vitest` is not installed in the worker, add it as a devDependency (`cd research-worker && npm install --save-dev vitest && cd ..`) and re-run. If there are no existing tests in the worker, create a `vitest.config.ts` in `research-worker/` with default config first.

- [ ] **Step 10.3: Implement the helper**

Create `research-worker/src/baseline-metrics.ts`:

```ts
export interface BaselineMetrics {
  currentCac: number | null;
  avgCustomerLtv: number | null;
  leadToCustomerRate: number | null;
  last12MoGrowthRate: number | null;
}

function formatCac(value: number | null): string {
  return value !== null ? `$${value}` : 'NOT PROVIDED';
}

function formatLtv(value: number | null): string {
  return value !== null ? `$${value}` : 'NOT PROVIDED';
}

function formatPct(value: number | null): string {
  return value !== null ? `${value}%` : 'NOT PROVIDED';
}

/**
 * Renders the system-prompt block that constrains runner behavior around
 * economic projections. Injected into synthesize, icp, and media-plan runners.
 *
 * When metrics is undefined (no baselineMetrics in worker context), every
 * field renders as NOT PROVIDED — the runner must fall back to insufficient
 * data for any computation that needs these values.
 */
export function renderBaselineMetricsBlock(
  metrics: BaselineMetrics | undefined,
): string {
  const m: BaselineMetrics = metrics ?? {
    currentCac: null,
    avgCustomerLtv: null,
    leadToCustomerRate: null,
    last12MoGrowthRate: null,
  };

  return `
BASELINE METRICS DATA INTEGRITY (CRITICAL):
- The user has provided the following baseline metrics (may contain "NOT PROVIDED"):
  currentCac: ${formatCac(m.currentCac)}
  avgCustomerLtv: ${formatLtv(m.avgCustomerLtv)}
  leadToCustomerRate: ${formatPct(m.leadToCustomerRate)}
  last12MoGrowthRate: ${formatPct(m.last12MoGrowthRate)}
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
`.trim();
}
```

- [ ] **Step 10.4: Run the test and confirm it passes**

Run: `cd research-worker && npx vitest run src/__tests__/baseline-metrics.test.ts && cd ..`
Expected: PASS.

- [ ] **Step 10.5: Commit**

```bash
git add research-worker/src/baseline-metrics.ts research-worker/src/__tests__/baseline-metrics.test.ts
# If vitest/config were added, include them too
git commit -m "feat(worker): add renderBaselineMetricsBlock helper for runner prompts

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Inject BASELINE METRICS block into synthesize runner + add growthProjection schema field

**Files:**
- Modify: `research-worker/src/runners/synthesize.ts`

- [ ] **Step 11.1: Add growthProjection to synthesisGenerateSchema**

Edit `research-worker/src/runners/synthesize.ts`. In the `synthesisGenerateSchema.planningContext` object (around lines 62-70), add:

```ts
growthProjection: z.string().nullable()
  .describe('Single sentence describing growth expectations. MUST be null unless baselineMetrics.last12MoGrowthRate is provided. If provided, the sentence MUST cite the user-reported rate directly.'),
```

Add it as a sibling of `targetCac`, `targetCpl`, `estimatedDemoPageCvr`.

- [ ] **Step 11.2: Inject the BASELINE METRICS block into the system prompt**

In the same file, find the system prompt assembly. Look for where the CVR guard lives (the text "If you include conversion rate estimates in planningContext or strategicNarrative" around line 118). Add an import at the top:

```ts
import { renderBaselineMetricsBlock, type BaselineMetrics } from '../baseline-metrics';
```

Find the runner's `runSynthesize` function signature (or equivalent entry point). Locate where `context` is passed in and extract `baselineMetrics`:

```ts
const baselineMetrics = (context as { baselineMetrics?: BaselineMetrics }).baselineMetrics;
const baselineBlock = renderBaselineMetricsBlock(baselineMetrics);
```

Then find where the system prompt string is constructed (template literal or concatenation). Inject `${baselineBlock}\n\n` before the CVR guard. Example:

```ts
const systemPrompt = `${BASE_SYSTEM_PROMPT}

${baselineBlock}

${CVR_GUARD_BLOCK}
...
`;
```

(The exact structure of the existing prompt dictates the injection point — grep for the text "CVR" or "conversion rate" to locate it, and insert immediately before.)

- [ ] **Step 11.3: Type-check the worker**

Run: `cd research-worker && npx tsc --noEmit && cd ..`
Expected: exit 0.

- [ ] **Step 11.4: Build the worker**

Run: `cd research-worker && npm run build && cd ..`
Expected: exit 0.

- [ ] **Step 11.5: Commit**

```bash
git add research-worker/src/runners/synthesize.ts
git commit -m "feat(worker/synthesize): inject baseline metrics block, add nullable growthProjection

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Inject BASELINE METRICS block into icp runner

**Files:**
- Modify: `research-worker/src/runners/icp.ts`

- [ ] **Step 12.1: Import the helper and extract baselineMetrics from context**

Edit `research-worker/src/runners/icp.ts`. Add at the top:

```ts
import { renderBaselineMetricsBlock, type BaselineMetrics } from '../baseline-metrics';
```

Find the runner entry point that builds the system prompt (grep for "SEGMENTS GUIDANCE" — it's around line 114). Above that block, extract baselineMetrics from the context parameter:

```ts
const baselineMetrics = (context as { baselineMetrics?: BaselineMetrics }).baselineMetrics;
const baselineBlock = renderBaselineMetricsBlock(baselineMetrics);
```

- [ ] **Step 12.2: Inject the block into the system prompt**

Find the prompt string construction. Inject `${baselineBlock}\n\n` **before** the SEGMENTS GUIDANCE text. The resulting prompt order is: existing intro → BASELINE METRICS block → SEGMENTS GUIDANCE → ICP_INTELLIGENCE_SKILL.

- [ ] **Step 12.3: Type-check the worker**

Run: `cd research-worker && npx tsc --noEmit && cd ..`
Expected: exit 0.

- [ ] **Step 12.4: Build the worker**

Run: `cd research-worker && npm run build && cd ..`
Expected: exit 0.

- [ ] **Step 12.5: Commit**

```bash
git add research-worker/src/runners/icp.ts
git commit -m "feat(worker/icp): inject baseline metrics block before SEGMENTS GUIDANCE

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Inject BASELINE METRICS block into media-plan runner's measurementGuardrails block

**Files:**
- Modify: `research-worker/src/runners/media-plan.ts`

- [ ] **Step 13.1: Locate the measurementGuardrails block config**

Edit `research-worker/src/runners/media-plan.ts`. Grep within the file for `measurementGuardrails` (it's referenced around line 220 in a switch statement; find its matching block config entry in the `BLOCKS` array or equivalent).

- [ ] **Step 13.2: Inject the helper**

Add at the top:

```ts
import { renderBaselineMetricsBlock, type BaselineMetrics } from '../baseline-metrics';
```

In the `measurementGuardrails` block config, locate where its system prompt is built. Extract baselineMetrics from the context:

```ts
const baselineMetrics = (context as { baselineMetrics?: BaselineMetrics }).baselineMetrics;
const baselineBlock = renderBaselineMetricsBlock(baselineMetrics);
```

Prepend `${baselineBlock}\n\n` to the `measurementGuardrails` block's system prompt template. Do NOT inject it into other blocks (platformStrategy, icpTargeting, etc.) — only the block that generates `cacModel`.

- [ ] **Step 13.3: Type-check and build the worker**

Run: `cd research-worker && npx tsc --noEmit && npm run build && cd ..`
Expected: exit 0.

- [ ] **Step 13.4: Commit**

```bash
git add research-worker/src/runners/media-plan.ts
git commit -m "feat(worker/media-plan): inject baseline metrics block into measurementGuardrails

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Fabrication regression test for the synthesize runner

**Files:**
- Create: `research-worker/src/runners/__tests__/synthesize-fabrication-regression.test.ts`

- [ ] **Step 14.1: Locate the synthesize sweep hook from Task 8.5**

Based on where Task 8.5 placed the `sweepStrategicNarrative` call, identify the function that takes a raw synthesize output and returns the sweep-cleaned version. This is what the regression test exercises.

If the sweep is applied inside the worker's runner itself (not in the Next.js post-processing layer), the test lives in the worker's tests dir. If the sweep is applied post-worker in the Next.js layer, the test stays colocated there. Pick whichever matches Task 8.5 and keep the file path consistent.

- [ ] **Step 14.2: Write the regression test**

Create `research-worker/src/runners/__tests__/synthesize-fabrication-regression.test.ts` (or `src/lib/media-plan/__tests__/synthesize-fabrication-regression.test.ts` depending on where the sweep hook is):

```ts
import { describe, it, expect } from 'vitest';
// Adjust import based on where Task 8.5 placed the sweep hook.
import { sweepStrategicNarrative } from '@/lib/media-plan/validation';

describe('synthesize output — fabrication regression', () => {
  // Recorded from a real past synthesize run containing fabricated claims.
  const recordedDirtyNarrative = `
    Given the strong pain signals and competitive white space, this client
    is positioned to scale to $3M ARR in 18 months through aggressive Meta
    and LinkedIn spend, targeting 30% YoY growth with a base-case CPL of $85.
    The initial 90 days should focus on hook testing and audience validation.
  `.trim();

  it('strips all fabricated growth/scaling claims when no baseline metrics are provided', () => {
    const clean = sweepStrategicNarrative(recordedDirtyNarrative, false, null);
    expect(clean).not.toMatch(/30\s*%\s*YoY/i);
    expect(clean).not.toMatch(/scale to \$3M ARR/i);
    expect(clean).not.toMatch(/\$3M ARR in 18 months/i);
    expect(clean).toContain('[growth rate not tracked]');
  });

  it('keeps legitimate campaign-phase language untouched', () => {
    const clean = sweepStrategicNarrative(recordedDirtyNarrative, false, null);
    expect(clean).toContain('hook testing');
    expect(clean).toContain('audience validation');
    expect(clean).toContain('90 days');
  });

  it('allows a growth claim that cites a user-reported 25% rate', () => {
    const cleanNarrative = 'Based on your reported 25% annual growth, the plan scales proportionally.';
    const result = sweepStrategicNarrative(cleanNarrative, true, 25);
    expect(result).toBe(cleanNarrative);
  });
});
```

- [ ] **Step 14.3: Run the test and confirm it passes**

Run the test with the correct runner:
- If worker: `cd research-worker && npx vitest run src/runners/__tests__/synthesize-fabrication-regression.test.ts && cd ..`
- If Next.js: `npm run test:run -- src/lib/media-plan/__tests__/synthesize-fabrication-regression.test.ts`

Expected: PASS. If it fails because the sweep was not wired into the narrative path yet, go back to Task 8.5 and fix that.

- [ ] **Step 14.4: Commit**

```bash
git add research-worker/src/runners/__tests__/synthesize-fabrication-regression.test.ts
# or whichever path you created
git commit -m "test(synthesize): regression fixture for fabricated growth/ARR claims

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: CAC model card — insufficient-data UI state

**Files:**
- Modify: `src/components/workspace/cards/cac-model-card.tsx`
- Possibly modify: the parent component that passes data into `<CacModelCard />` (grep in Step 15.1)

- [ ] **Step 15.1: Find the card's consumer**

Run:
```bash
grep -rn "CacModelCard" src/components src/app --include="*.tsx" -l
```

Record every consumer file so Step 15.4 can update them to pass the new prop.

- [ ] **Step 15.2: Extend the card props and rendering**

Edit `src/components/workspace/cards/cac-model-card.tsx`. Change the `CacModelCardProps` interface to accept `null` instead of `undefined` for the economic fields, and add an `insufficientData` prop:

```ts
interface CacModelCardProps {
  targetCAC?: number | null;
  expectedCPL?: number | null;
  leadToSqlRate?: number | null;
  sqlToCustomerRate?: number | null;
  expectedLeadsPerMonth?: number | null;
  expectedSQLsPerMonth?: number | null;
  expectedCustomersPerMonth?: number | null;
  ltv?: number | null;
  ltvCacRatio?: number | null;
  insufficientData?: string[];
}
```

Update the helper functions to tolerate null:

```ts
function pct(value: number | null | undefined) {
  return value !== null && value !== undefined ? `${(value * 100).toFixed(0)}%` : null;
}

function usd(value: number | null | undefined) {
  return value !== null && value !== undefined ? `$${value.toLocaleString()}` : null;
}
```

Update the `topStats`/`midStats`/`bottomStats` assembly to filter out entries whose formatter returned `null`. Example:

```ts
const topStats = [
  ...(expectedCPL != null ? [{ label: 'Cost Per Lead', value: `$${expectedCPL.toLocaleString()}` }] : []),
  ...(expectedLeadsPerMonth != null ? [{ label: 'Leads / Mo', value: String(expectedLeadsPerMonth) }] : []),
];
```

(`!= null` covers both `null` and `undefined`.)

At the bottom of the card's return JSX, before the closing `</div>`, add an insufficient-data panel when the array is non-empty:

```tsx
{insufficientData && insufficientData.length > 0 ? (
  <div className="mt-4 rounded-md border border-dashed border-zinc-600 bg-zinc-900/40 p-4">
    <div className="text-sm font-medium text-zinc-200">Insufficient data</div>
    <ul className="mt-2 space-y-1 text-xs text-zinc-400">
      {insufficientData.map((entry) => (
        <li key={entry}>• {humanizeInsufficientData(entry)}</li>
      ))}
    </ul>
    <a
      href="/profiles#current-performance"
      className="mt-3 inline-block text-xs font-medium text-blue-400 underline-offset-4 hover:underline"
    >
      Add baseline metrics →
    </a>
  </div>
) : null}
```

Add a helper at the top of the file:

```ts
const INSUFFICIENT_DATA_COPY: Record<string, string> = {
  estimatedLTV: 'Add your Avg Customer LTV to unlock lifetime-value math.',
  ltvToCacRatio: 'Add LTV and Current CAC to see the ratio.',
  targetCAC: 'Add your Current CAC to anchor acquisition cost.',
  expectedMonthlyCustomers: 'Add your Lead → Customer % to project customer volume.',
  expectedMonthlyLeads: 'Add a target CPL to project lead volume.',
};

function humanizeInsufficientData(entry: string): string {
  // entry is of the form "estimatedLTV: no avgCustomerLtv provided"
  const [field] = entry.split(':');
  return INSUFFICIENT_DATA_COPY[field?.trim() ?? ''] ?? entry;
}
```

- [ ] **Step 15.3: Add a smoke test for the card**

Create `src/components/workspace/cards/__tests__/cac-model-card.test.tsx` if the project allows React component tests (check `vitest.config.ts` for jsdom):

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CacModelCard } from '../cac-model-card';

describe('CacModelCard — insufficient data', () => {
  it('renders insufficient-data panel when array is non-empty', () => {
    render(
      <CacModelCard
        targetCAC={null}
        ltv={null}
        ltvCacRatio={null}
        insufficientData={['estimatedLTV: no avgCustomerLtv provided']}
      />,
    );
    expect(screen.getByText('Insufficient data')).toBeDefined();
    expect(screen.getByText(/Add your Avg Customer LTV/)).toBeDefined();
    expect(screen.getByText(/Add baseline metrics/)).toBeDefined();
  });

  it('does NOT render the panel when insufficientData is empty or absent', () => {
    const { queryByText } = render(
      <CacModelCard targetCAC={500} ltv={3600} ltvCacRatio={7.2} />,
    );
    expect(queryByText('Insufficient data')).toBeNull();
  });
});
```

If `@testing-library/react` is not installed, skip this step and rely on manual verification in Task 16 — do NOT add new devDependencies just for this test.

- [ ] **Step 15.4: Update consumers to pass the `insufficientData` prop**

For every consumer file identified in Step 15.1, pass through the `insufficientData` from the card's data source:

```tsx
<CacModelCard
  targetCAC={cacModel.targetCAC}
  ltv={cacModel.estimatedLTV}
  ltvCacRatio={cacModel.ltvToCacRatio ? parseFloat(cacModel.ltvToCacRatio) : null}
  // ... other fields
  insufficientData={cacModel.insufficientData}
/>
```

(`ltvToCacRatio` is a string in the schema; parse the leading number for the card prop. If any consumer currently assumes the ratio is a number, leave the existing conversion in place.)

- [ ] **Step 15.5: Run the card test and type-check**

Run: `npm run test:run -- src/components/workspace/cards/__tests__/cac-model-card.test.tsx`
Expected: PASS (if the test file was added in Step 15.3).

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 15.6: Commit**

```bash
git add src/components/workspace/cards/cac-model-card.tsx src/components/workspace/cards/__tests__/cac-model-card.test.tsx
# plus any consumer files modified in Step 15.4
git commit -m "feat(workspace): render insufficient-data state in CacModelCard

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Full verification gate

**Files:** none (verification only)

- [ ] **Step 16.1: Full build**

Run: `npm run build`
Expected: exit 0. If it fails, find the exact error, map it back to the task that introduced the regression, and fix it before moving on.

- [ ] **Step 16.2: Full test suite**

Run: `npm run test:run`
Expected: exit 0 on all tests. Any pre-existing failing tests that are unrelated to this work (e.g., openrouter tests per `.claude/rules/learned-patterns.md`) are acceptable; anything new failing must be fixed.

- [ ] **Step 16.3: Worker build**

Run: `cd research-worker && npm run build && cd ..`
Expected: exit 0.

- [ ] **Step 16.4: Worker tests**

Run: `cd research-worker && npx vitest run && cd ..`
Expected: exit 0.

- [ ] **Step 16.5: Trace one field end-to-end manually**

Pick `currentCac`. Read 10+ lines around each of the following locations to confirm the value flows correctly:

1. `src/lib/journey/field-catalog.ts` — field definition exists
2. `src/components/journey/unified-field-review.tsx` — the `current-performance` group renders (no edit needed; it reads the catalog generically — verify by grep that the group key is referenced)
3. The business_snapshot schema file from Task 2 — `currentCac` is in `baselineMetrics`
4. `src/app/api/journey/dispatch/route.ts` → `src/lib/ai/tools/research/dispatch.ts` — `baselineMetrics` forwarded under `context`
5. `research-worker/src/runners/media-plan.ts` — `measurementGuardrails` block extracts `baselineMetrics` and injects the rendered prompt block
6. `src/lib/media-plan/pipeline.ts` — `computeCACModel` receives `currentCac` from `onboarding.baselineMetrics.currentCac`
7. `src/lib/media-plan/validation.ts:computeCACModel` — `targetCAC = currentCac ?? …`
8. `src/components/workspace/cards/cac-model-card.tsx` — renders the value OR the insufficient-data panel

For each hop, confirm the types match. If any hop was skipped or the field name drifted (e.g., `current_cac` vs `currentCac`), fix the drift before proceeding.

- [ ] **Step 16.6: Fellow.ai regression — Run A (no baseline metrics)**

Start the dev server and worker locally:

```bash
tmux new-session -d -s dev "cd $(pwd) && npm run dev"
tmux new-session -d -s worker "cd $(pwd)/research-worker && npm run dev"
```

In the browser:
1. Open `http://localhost:3000/journey`
2. Submit Fellow.ai as the client URL.
3. Complete the journey review WITHOUT filling any baseline metric fields.
4. Wait for the media plan section to render in the workspace.

Verify in the browser:
- CAC model card shows an "Insufficient data" panel with the CTA "Add baseline metrics →"
- The `strategicNarrative` in the UI does not contain any sentence matching `\d+%\s*(?:YoY|growth)` or `\$\d+[MBK]?\s*ARR`
- The executive summary overview does not contain forbidden patterns

Verify in the database (Supabase console or a SQL query):
```sql
select research_results->'mediaPlan'->'performanceModel'->'cacModel'->'insufficientData'
from journey_sessions
where run_id = '<your-run-id>';
```
Expected: a non-empty JSON array of strings.

- [ ] **Step 16.7: Fellow.ai regression — Run B (all metrics filled)**

Repeat the journey for Fellow.ai, this time providing:
- `currentCac = 450`
- `avgCustomerLtv = 3600`
- `leadToCustomerRate = 5`
- `last12MoGrowthRate = 25`

Verify in the browser:
- CAC model card shows real numbers
- The LTV:CAC ratio is `8.0:1 — Healthy`
- `expectedMonthlyCustomers × targetCAC ≈ monthlyBudget × 0.8` (sanity check on the math)
- The `strategicNarrative` may contain at most one growth claim, and if it does, it must include the exact string `25%`
- No fabrication patterns appear anywhere

Verify in the database:
```sql
select research_results->'mediaPlan'->'performanceModel'->'cacModel'->'insufficientData'
from journey_sessions
where run_id = '<your-run-id>';
```
Expected: `null` or an empty array.

- [ ] **Step 16.8: Check the fabrication sweep log**

Review the dev server logs from Run A. Expected: zero or more `[fabrication-sweep] stripped pattern=…` lines, each followed by its match text. If there are hits, record them in `.claude/memory/fabrication-sweep-hits.md` for future test-matrix expansion (create the file if it doesn't exist; don't commit it).

- [ ] **Step 16.9: Shut down tmux sessions**

```bash
tmux kill-session -t dev 2>/dev/null || true
tmux kill-session -t worker 2>/dev/null || true
```

- [ ] **Step 16.10: Final commit — verification evidence note**

```bash
# No code changes. Just mark the phase complete.
git status
# Should show a clean tree or only the uncommitted sweep-hits log (gitignored).
```

If any untracked test artifacts or debug files appeared, clean them up before opening a PR.

---

## Task 17: Open the PR

**Files:** none (git ops)

- [ ] **Step 17.1: Push the branch**

```bash
git push -u origin fix/research-fabrication-baseline-metrics
```

- [ ] **Step 17.2: Open the PR**

```bash
gh pr create --title "fix: stop fabricating LTV/CAC/growth numbers in research pipeline" --body "$(cat <<'EOF'
## Summary
- Adds 4 optional baseline-metric fields (currentCac, avgCustomerLtv, leadToCustomerRate, last12MoGrowthRate) to the journey onboarding under a new "Current Performance" group
- Deletes the hardcoded `estimateRetentionMultiplier` heuristic and rewrites `computeCACModel` so every economic field is either user-provided or explicitly null with an `insufficientData` entry
- Adds `sweepFabricatedClaims()` — a runtime regex guard that strips fabricated growth/ARR/scaling claims from `strategicNarrative`, `executiveSummary.overview`, and `campaignPhases[].description`
- Injects a `BASELINE METRICS DATA INTEGRITY` block into the synthesize, icp, and media-plan (measurementGuardrails) runner prompts so the model never invents LTV/CAC/growth numbers when the user hasn't provided them
- Renders an "Insufficient data — add baseline metrics" panel in the `CacModelCard` when any economic field is null

Spec: `docs/superpowers/specs/2026-04-08-research-fabrication-fix-design.md`
Plan: `docs/superpowers/plans/2026-04-08-research-fabrication-fix.md`

## Test plan
- [ ] `npm run build` green
- [ ] `npm run test:run` green (including new validation-cac-model, sweep-fabricated-claims, field-catalog, dispatch-baseline-metrics, and cac-model-card tests)
- [ ] `cd research-worker && npm run build && npx vitest run` green
- [ ] Fellow.ai Run A (no baseline metrics): CAC card renders insufficient-data state, narrative contains no fabrication
- [ ] Fellow.ai Run B (all 4 metrics filled): CAC card renders real numbers, LTV:CAC ratio is computed correctly, narrative cites the user-reported 25% growth rate verbatim

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 17.3: Verify PR created**

Expected output: a PR URL. Open it and confirm the diff shows only the expected files.

---

## Self-review (writing-plans skill requirement)

Checked against the spec:

1. **Spec coverage — every requirement has a task:**
   - Field catalog additions → Task 1
   - business_snapshot Zod schema → Task 2
   - cacModelSchema nullable + insufficientData sibling → Task 3
   - sensitivityAnalysis nullable → Task 4
   - computeCACModel rewrite + retention-multiplier deletion → Tasks 5, 6
   - sweepFabricatedClaims function + integration → Tasks 7, 8
   - Dispatch forwards baselineMetrics → Task 9
   - Worker BASELINE METRICS block helper → Task 10
   - Runner prompt injection (synthesize, icp, media-plan) → Tasks 11, 12, 13
   - Fabrication regression test → Task 14
   - UI insufficient-data state → Task 15
   - Verification plan including Fellow.ai manual runs → Task 16
   - PR open → Task 17

2. **Placeholder scan:** No "TBD", "TODO", "fill in", or "similar to Task N". Every task shows concrete code. Where a file path is not yet known (business_snapshot schema file, dispatch helper file), the plan includes a grep command to locate it BEFORE the edit step, and records the path as a shell variable for subsequent steps.

3. **Type consistency:** `CACModelInput`, `CACModel`, `BaselineMetrics`, `computeCACModel` signature, and the nullable field list are consistent across Tasks 3, 5, 6, 10, 15. `currentCac`/`avgCustomerLtv`/`leadToCustomerRate`/`last12MoGrowthRate` field keys match across field-catalog, schema, dispatch, runner prompts, and UI.

4. **Scope sanity:** 17 tasks, each bite-sized (2-5 minutes per step, TDD loop per task). A single implementation session should complete this. If the implementing engineer hits the Task 2 or Task 9 file-location greps and discovers the schema/dispatch-helper is structured very differently from what this plan assumes, they should stop and report — not improvise.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-08-research-fabrication-fix.md`.
