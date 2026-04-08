# Current Marketing Activities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `currentMarketingActivities` onboarding field that tells research runners what the client is already doing, and wire anti-duplication guardrails into the synthesize, media-plan, and offer runners so recommendations stop restating existing strategy as "new".

**Architecture:** Single freeform textarea added to the journey field catalog. Flows into the research context string via a small new pure helper (`buildJourneyResearchContext`) that replaces two duplicated inline loops in `journey/page.tsx`. Three runner prompts gain a labeled guardrail paragraph that keys off the literal `"Current Marketing Activities:"` line in the context. No schema migration, no API route changes, no Zod contract changes — persistence rides the existing `business_profiles.all_fields` JSONB merge path.

**Tech Stack:** Next.js (App Router), Vitest, TypeScript strict, Railway-hosted Express worker (separate package — cannot import from `src/lib/`), Anthropic SDK + Vercel AI SDK v6, Supabase (JSONB persistence).

**Spec:** `docs/superpowers/specs/2026-04-08-current-marketing-activities-design.md`

---

## File Structure

| File | Purpose | Status |
|---|---|---|
| `src/lib/journey/context-string.ts` | Pure helper `buildJourneyResearchContext(fields)` that emits the labeled-line context string sent to the Railway worker. Single source of truth for both journey submit paths. | **New** |
| `src/lib/journey/__tests__/context-string.test.ts` | Vitest tests for the helper. | **New** |
| `src/lib/journey/field-catalog.ts` | Add `currentMarketingActivities` to `JOURNEY_FIELDS`, `JOURNEY_ENRICHMENT_FIELD_METAS`, both group constants, `PROFILE_MULTILINE_KEYS`. | Modify |
| `src/lib/journey/__tests__/field-catalog.test.ts` | Extend with 4 cases for the new field. | Modify |
| `src/app/journey/page.tsx` | Replace two inline context-building loops (lines ~1477 and ~1566) with `buildJourneyResearchContext` calls. | Modify |
| `research-worker/src/runners/synthesize.ts` | Export `SYNTHESIS_SYSTEM`; add anti-duplication paragraph to it. | Modify |
| `research-worker/src/runners/media-plan.ts` | Export new `CURRENT_ACTIVITIES_GUARDRAIL` constant; inject into `systemParts` alongside `ANTI_HALLUCINATION`. | Modify |
| `research-worker/src/runners/offer.ts` | Export new `OFFER_CURRENT_ACTIVITIES_GUARDRAIL` constant; append to `OFFER_SYSTEM_PROMPT`. | Modify |
| `research-worker/src/runners/__tests__/guardrail-prompts.test.ts` | First test file in the worker. Asserts all three guardrail constants contain the expected anti-duplication text. | **New** |

**Files explicitly NOT touched:** `src/lib/ai/context-builder.ts` (old pre-journey generator), `src/lib/media-plan/*` (old media plan pipeline, distinct from the worker runner), any Supabase migration, any API route, `FIELD_MAP` in `business-profiles.ts`, `research-worker/src/runners/keywords.ts`.

---

## Precondition — offer.ts structure resolved

During planning the offer runner was opened to resolve the "known unknown" flagged in the spec. Findings:

- `research-worker/src/runners/offer.ts:24` defines `const OFFER_SYSTEM_PROMPT = \`...\`` — a single top-level template literal. Clean injection point for a new constant.
- The worker has **zero existing test files**. This plan creates the first one at `research-worker/src/runners/__tests__/guardrail-prompts.test.ts`. The worker already has `vitest` as a devDependency and a `test:run` npm script, so no infrastructure setup is needed — vitest's default config will discover the test file.
- Worker uses `commonjs` + `strict: true` in `tsconfig.json`. Tests in `src/runners/__tests__/` will be picked up by vitest defaults.

The fallback plan documented in the spec (drop offer runner if no clean injection point) is NOT needed — proceed with the offer runner change.

---

## Task 1: Create `buildJourneyResearchContext` helper (TDD, no behavior change to journey/page.tsx yet)

This task extracts the duplicated context-building loop from `journey/page.tsx` into a pure helper. The helper is created first, behind failing tests. Task 2 wires it into the two existing call sites. Splitting into two tasks keeps each commit small and reversible.

**Files:**
- Create: `src/lib/journey/context-string.ts`
- Create: `src/lib/journey/__tests__/context-string.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/journey/__tests__/context-string.test.ts` with the full content below:

```ts
import { describe, expect, it } from 'vitest';
import { buildJourneyResearchContext } from '../context-string';

describe('buildJourneyResearchContext', () => {
  it('wraps field values with human-readable labels from the field catalog', () => {
    const ctx = buildJourneyResearchContext({
      companyName: 'Acme',
      productDescription: 'Widgets for warehouses',
    });

    expect(ctx).toContain("Here's what I found about the company:");
    expect(ctx).toContain('Company Name: Acme');
    expect(ctx).toContain('Product Description: Widgets for warehouses');
    expect(ctx).toContain('Please use this context and begin the research journey.');
  });

  it('omits empty, whitespace-only, and undefined fields', () => {
    const ctx = buildJourneyResearchContext({
      companyName: 'Acme',
      productDescription: '',
      valueProp: '   ',
      guarantees: undefined,
    });

    expect(ctx).toContain('Company Name: Acme');
    expect(ctx).not.toContain('Product Description');
    expect(ctx).not.toContain('Value Proposition');
    expect(ctx).not.toContain('Guarantees');
    expect(ctx).not.toContain('undefined');
  });

  it('honours the explicit orderedKeys parameter when supplied', () => {
    const ctx = buildJourneyResearchContext(
      { companyName: 'Acme', productDescription: 'Widgets', goals: 'Scale' },
      ['goals', 'companyName', 'productDescription'],
    );

    const goalsIdx = ctx.indexOf('Goals: Scale');
    const companyIdx = ctx.indexOf('Company Name: Acme');
    const productIdx = ctx.indexOf('Product Description: Widgets');

    expect(goalsIdx).toBeGreaterThan(-1);
    expect(goalsIdx).toBeLessThan(companyIdx);
    expect(companyIdx).toBeLessThan(productIdx);
  });

  it('returns a non-empty preamble+postamble even when all fields are empty', () => {
    const ctx = buildJourneyResearchContext({});
    expect(ctx).toContain("Here's what I found about the company:");
    expect(ctx).toContain('Please use this context and begin the research journey.');
    expect(ctx).not.toContain('undefined');
  });

  it('falls back to the raw key when a field has no catalog label entry', () => {
    const ctx = buildJourneyResearchContext({ someWeirdCustomKey: 'hello' });
    expect(ctx).toContain('someWeirdCustomKey: hello');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/lib/journey/__tests__/context-string.test.ts`

Expected: FAIL — `Cannot find module '../context-string'` or similar. The tests cannot run because `context-string.ts` does not exist yet.

- [ ] **Step 3: Create the helper**

Create `src/lib/journey/context-string.ts` with the full content below:

```ts
import { JOURNEY_FIELD_LABELS } from './field-catalog';

/**
 * Build the research context string passed to the Railway worker runners.
 *
 * Emits one labeled line per non-empty field using the human-readable label
 * from `JOURNEY_FIELD_LABELS` (falls back to the raw key if no label is
 * registered). Empty, whitespace-only, and undefined values are skipped so
 * optional fields don't produce `"undefined"` in the worker context.
 *
 * This is the single source of truth for the context string format — both
 * `handleStartFromReview` and `handleStartFromUnifiedReview` in
 * `src/app/journey/page.tsx` call this helper so the two submit paths
 * produce identical context shapes.
 */
export function buildJourneyResearchContext(
  fields: Record<string, string | undefined>,
  orderedKeys?: readonly string[],
): string {
  const keys = orderedKeys ?? Object.keys(fields);
  const lines: string[] = ["Here's what I found about the company:"];
  for (const key of keys) {
    const raw = fields[key];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) continue;
    const label = JOURNEY_FIELD_LABELS[key] ?? key;
    lines.push(`${label}: ${value}`);
  }
  lines.push('', 'Please use this context and begin the research journey.');
  return lines.join('\n');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/lib/journey/__tests__/context-string.test.ts`

Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/journey/context-string.ts src/lib/journey/__tests__/context-string.test.ts
git commit -m "$(cat <<'EOF'
feat(journey): extract buildJourneyResearchContext helper

Pure function that emits the labeled-line context string sent to the
Railway worker. Will replace two duplicated inline loops in
src/app/journey/page.tsx in the next commit. No behavior change yet.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire the helper into `journey/page.tsx` (refactor both call sites, no behavior change)

**Files:**
- Modify: `src/app/journey/page.tsx` (two loops, around lines 1477 and 1566)

- [ ] **Step 1: Read the first call site to confirm exact line numbers**

Run: `grep -n "Here's what I found about the company" src/app/journey/page.tsx`

Expected output: two line numbers for the preamble string that lives inside `handleStartFromReview` and `handleStartFromUnifiedReview`. If line numbers have drifted since the plan was written, adjust the Edit targets below accordingly — the structure of the code is the source of truth, not the line numbers.

- [ ] **Step 2: Add the helper import**

Find the existing import block near the top of `src/app/journey/page.tsx`. Add this line alongside the other `@/lib/journey/*` imports:

```ts
import { buildJourneyResearchContext } from '@/lib/journey/context-string';
```

- [ ] **Step 3: Replace the first loop (inside `handleStartFromReview`)**

In `handleStartFromReview` (around line 1470–1493), locate the block that builds `orderedFieldKeys` and then pushes `${label}: ${value}` lines into a `lines` array. The existing block looks roughly like:

```ts
const displayName = acceptedJourneyFields.companyName || 'this company';
const orderedFieldKeys = Array.from(
  new Set([
    ...JOURNEY_PREFILL_REVIEW_FIELDS.map(({ key }) => key),
    ...JOURNEY_MANUAL_BLOCKER_FIELDS.map(({ key }) => key),
  ]),
);

const lines: string[] = ["Here's what I found about the company:"];
for (const key of orderedFieldKeys) {
  const value = acceptedJourneyFields[key]?.trim();
  if (!value) continue;
  lines.push(`${JOURNEY_FIELD_LABELS[key] ?? key}: ${value}`);
}
lines.push('', 'Please use this context and begin the research journey.');

addLog('ok', `Accepted ${Object.keys(acceptedJourneyFields).length} onboarding inputs`);

// Go straight to workspace — render immediately while session persists
hasTransitionedToWorkspaceRef.current = true;
setJourneyPhase('workspace');

// Persist session fields THEN dispatch — must await so the worker's
// isActiveJourneyRun() guard sees the run ID when it tries to write results
const context = lines.join('\n');
```

Replace everything from `const orderedFieldKeys = ...` through `const context = lines.join('\n');` with:

```ts
const orderedFieldKeys = Array.from(
  new Set([
    ...JOURNEY_PREFILL_REVIEW_FIELDS.map(({ key }) => key),
    ...JOURNEY_MANUAL_BLOCKER_FIELDS.map(({ key }) => key),
  ]),
);

addLog('ok', `Accepted ${Object.keys(acceptedJourneyFields).length} onboarding inputs`);

// Go straight to workspace — render immediately while session persists
hasTransitionedToWorkspaceRef.current = true;
setJourneyPhase('workspace');

// Persist session fields THEN dispatch — must await so the worker's
// isActiveJourneyRun() guard sees the run ID when it tries to write results
const context = buildJourneyResearchContext(acceptedJourneyFields, orderedFieldKeys);
```

Keep the `displayName` assignment, the `addLog`, `hasTransitionedToWorkspaceRef`, and `setJourneyPhase` calls exactly as they are — the only thing that changes is the six lines that build `lines[]` are replaced with a single `buildJourneyResearchContext` call.

- [ ] **Step 4: Replace the second loop (inside `handleStartFromUnifiedReview`)**

In `handleStartFromUnifiedReview` (around line 1534–1581), locate the similar block. It looks like:

```ts
const displayName = acceptedJourneyFields.companyName || 'this company';
const orderedFieldKeys = Object.keys(acceptedJourneyFields);

const lines: string[] = ["Here's what I found about the company:"];
for (const key of orderedFieldKeys) {
  const value = acceptedJourneyFields[key];
  if (!value) continue;
  lines.push(`${JOURNEY_FIELD_LABELS[key] ?? key}: ${value}`);
}
lines.push('', 'Please use this context and begin the research journey.');

addLog('ok', `Accepted ${Object.keys(acceptedJourneyFields).length} onboarding inputs`);

// Go straight to workspace — render immediately while session persists
hasTransitionedToWorkspaceRef.current = true;
setJourneyPhase('workspace');

// Clear old results, set new fields + run ID, THEN dispatch
const context = lines.join('\n');
```

Replace the six lines from `const lines: string[] = ["Here's what I found about the company:"];` through `lines.push('', 'Please use this context and begin the research journey.');` AND replace the later `const context = lines.join('\n');` with a single construct. Target end state:

```ts
const displayName = acceptedJourneyFields.companyName || 'this company';
const orderedFieldKeys = Object.keys(acceptedJourneyFields);

addLog('ok', `Accepted ${Object.keys(acceptedJourneyFields).length} onboarding inputs`);

// Go straight to workspace — render immediately while session persists
hasTransitionedToWorkspaceRef.current = true;
setJourneyPhase('workspace');

// Clear old results, set new fields + run ID, THEN dispatch
const context = buildJourneyResearchContext(acceptedJourneyFields, orderedFieldKeys);
```

- [ ] **Step 5: Remove now-unused imports if any**

Run: `grep -n "JOURNEY_FIELD_LABELS" src/app/journey/page.tsx`

If `JOURNEY_FIELD_LABELS` is no longer used anywhere in the file (the helper handles labeling internally now), remove it from the `@/lib/journey/field-catalog` import. If it IS still used elsewhere in the file, leave the import alone.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`

Expected: exit 0, no errors. If there are errors, fix them — most likely cause is a stray reference to `lines` or `JOURNEY_FIELD_LABELS` in a spot that wasn't replaced.

- [ ] **Step 7: Run the full test suite for journey**

Run: `npm run test:run -- src/lib/journey/ src/app/journey/`

Expected: all existing journey tests still pass. The new context-string tests from Task 1 also pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/journey/page.tsx
git commit -m "$(cat <<'EOF'
refactor(journey): use buildJourneyResearchContext in both submit paths

Replaces two duplicated context-string loops with the shared helper
from Task 1. No behavior change — the two paths produced identical
output before and after the refactor.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add `currentMarketingActivities` to the field catalog (TDD)

**Files:**
- Modify: `src/lib/journey/__tests__/field-catalog.test.ts`
- Modify: `src/lib/journey/field-catalog.ts`

- [ ] **Step 1: Add the failing tests**

Open `src/lib/journey/__tests__/field-catalog.test.ts`. Add the new imports needed at the top:

```ts
import {
  JOURNEY_FIELDS,
  JOURNEY_MANUAL_BLOCKER_FIELDS,
  JOURNEY_PREFILL_REVIEW_FIELDS,
  JOURNEY_REQUIRED_BLOCKER_FIELDS,
  JOURNEY_RESEARCH_ENRICHMENT_FIELDS,
  JOURNEY_SECTION_FOLLOWUP_FIELDS,
  JOURNEY_WAVE_TWO_REQUIREMENTS,
  JOURNEY_FIELD_GROUPS,
  PROFILE_FIELD_GROUPS,
  PROFILE_MULTILINE_KEYS,
  JOURNEY_REQUIRED_FIELD_KEYS,
  JOURNEY_ENRICHMENT_FIELD_METAS,
  getJourneyFieldDefinition,
} from '../field-catalog';
```

(If some of these are already imported, leave them as-is — just ensure all of the listed names are available after the edit.)

Then append this new describe block **after** the existing `describe('field-catalog', ...)` block:

```ts
describe('currentMarketingActivities field', () => {
  it('is registered in JOURNEY_FIELDS with the correct shape', () => {
    const field = getJourneyFieldDefinition('currentMarketingActivities');
    expect(field).toBeDefined();
    expect(field?.category).toBe('section-followup');
    expect(field?.section).toBe('crossAnalysis');
    expect(field?.collectionMode).toBe('manual');
    expect(field?.prefillVisible).toBeFalsy();
  });

  it('appears in the goals-strategy group of JOURNEY_FIELD_GROUPS', () => {
    const group = JOURNEY_FIELD_GROUPS.find((g) => g.id === 'goals-strategy');
    expect(group?.fieldKeys).toContain('currentMarketingActivities');
  });

  it('appears in the goals-strategy group of PROFILE_FIELD_GROUPS', () => {
    const group = PROFILE_FIELD_GROUPS.find((g) => g.id === 'goals-strategy');
    expect(group?.fieldKeys).toContain('currentMarketingActivities');
  });

  it('renders as a multi-line textarea on the profile edit page', () => {
    expect(PROFILE_MULTILINE_KEYS.has('currentMarketingActivities')).toBe(true);
  });

  it('is NOT required — must remain optional for existing users', () => {
    expect(JOURNEY_REQUIRED_FIELD_KEYS.has('currentMarketingActivities')).toBe(false);
  });

  it('has placeholder and helper metadata in JOURNEY_ENRICHMENT_FIELD_METAS', () => {
    const meta = JOURNEY_ENRICHMENT_FIELD_METAS.find(
      (m) => m.key === 'currentMarketingActivities',
    );
    expect(meta).toBeDefined();
    expect(meta?.placeholder).toBeTruthy();
    expect(meta?.helper).toBeTruthy();
    expect(meta?.rows).toBeGreaterThan(1);
    expect(meta?.required).toBeFalsy();
  });

  it('flows through buildJourneyResearchContext as a labeled line', async () => {
    const { buildJourneyResearchContext } = await import('../context-string');
    const ctx = buildJourneyResearchContext({
      companyName: 'Acme',
      currentMarketingActivities:
        'Meta $8k/mo LAL 1% + UGC, 2.1x ROAS. LinkedIn flat. Google brand-only.',
    });
    expect(ctx).toContain(
      'Current Marketing Activities: Meta $8k/mo LAL 1% + UGC, 2.1x ROAS. LinkedIn flat. Google brand-only.',
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/lib/journey/__tests__/field-catalog.test.ts`

Expected: FAIL — the new describe block fails on every assertion because `currentMarketingActivities` does not exist in any constant yet. The original describe block still passes.

- [ ] **Step 3: Add the field to `JOURNEY_FIELDS`**

Open `src/lib/journey/field-catalog.ts`. In the `JOURNEY_FIELDS` array (lines 39–81), add this new entry immediately after the `brandPositioning` entry (around line 68):

```ts
  { key: 'currentMarketingActivities', label: 'Current Marketing Activities', category: 'section-followup', section: 'crossAnalysis', collectionMode: 'manual' },
```

- [ ] **Step 4: Add enrichment metadata**

In the same file, append a new entry to `JOURNEY_ENRICHMENT_FIELD_METAS` (around lines 174–189), after the existing `payingCustomerCount` entry:

```ts
  {
    key: 'currentMarketingActivities',
    label: 'Current Marketing Activities',
    placeholder:
      'Meta $8k/mo — LAL 1% + interest stacks, UGC testimonial hooks, 2.1x ROAS (working).\nLinkedIn $3k/mo — job-title + static images, flat (cutting soon).\nGoogle Search: not running yet.',
    helper:
      "Channels you're already running, rough budget split, creative styles, what's working, what's not. Helps us avoid recommending strategies you already have in market. Skip any part.",
    rows: 4,
  },
```

- [ ] **Step 5: Add to `JOURNEY_FIELD_GROUPS` → `goals-strategy`**

In the same file, in the `JOURNEY_FIELD_GROUPS` constant (around lines 264–290), modify the `goals-strategy` group entry to append the new key:

Before:
```ts
  {
    id: 'goals-strategy',
    label: 'Goals & Strategy',
    fieldKeys: ['goals', 'desiredTransformation', 'situationBeforeBuying', 'commonObjections', 'brandPositioning'],
  },
```

After:
```ts
  {
    id: 'goals-strategy',
    label: 'Goals & Strategy',
    fieldKeys: ['goals', 'desiredTransformation', 'situationBeforeBuying', 'commonObjections', 'brandPositioning', 'currentMarketingActivities'],
  },
```

- [ ] **Step 6: Add to `PROFILE_FIELD_GROUPS` → `goals-strategy`**

In the same file, in the `PROFILE_FIELD_GROUPS` constant (around lines 295–321), modify the `goals-strategy` group entry to append the new key:

Before:
```ts
  {
    id: 'goals-strategy',
    label: 'Goals & Strategy',
    fieldKeys: ['goals', 'desiredTransformation', 'situationBeforeBuying', 'commonObjections', 'brandPositioning', 'salesCycleLength', 'salesProcessOverview', 'campaignDuration', 'targetCpl', 'targetCac'],
  },
```

After:
```ts
  {
    id: 'goals-strategy',
    label: 'Goals & Strategy',
    fieldKeys: ['goals', 'desiredTransformation', 'situationBeforeBuying', 'commonObjections', 'brandPositioning', 'currentMarketingActivities', 'salesCycleLength', 'salesProcessOverview', 'campaignDuration', 'targetCpl', 'targetCac'],
  },
```

- [ ] **Step 7: Add to `PROFILE_MULTILINE_KEYS`**

In the same file, in the `PROFILE_MULTILINE_KEYS` Set (around lines 323–339), append `'currentMarketingActivities'` to the list:

```ts
export const PROFILE_MULTILINE_KEYS: ReadonlySet<string> = new Set([
  'primaryIcpDescription',
  'easiestToClose',
  'buyingTriggers',
  'productDescription',
  'coreDeliverables',
  'valueProp',
  'guarantees',
  'competitorFrustrations',
  'marketBottlenecks',
  'situationBeforeBuying',
  'desiredTransformation',
  'commonObjections',
  'salesProcessOverview',
  'brandPositioning',
  'currentMarketingActivities',
]);
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run test:run -- src/lib/journey/__tests__/field-catalog.test.ts`

Expected: PASS — all tests in both describe blocks pass. The new describe block's 7 cases all pass. The original `covers each field exactly once across the three classifications` test still passes because the new field is in `section-followup` which is one of the three classifications.

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 10: Commit**

```bash
git add src/lib/journey/field-catalog.ts src/lib/journey/__tests__/field-catalog.test.ts
git commit -m "$(cat <<'EOF'
feat(journey): add currentMarketingActivities onboarding field

Optional freeform textarea in the Goals & Strategy group that captures
what the client is already running (channels, budgets, creatives,
what's working / not). Lets downstream research runners avoid
recommending strategies the client already has in market.

Field-catalog only — runner prompt changes ship in the next 3 commits.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Synthesize runner — add anti-duplication guardrail (TDD)

This task and Tasks 5–6 each follow the same pattern: write a prompt-inclusion test against a constant that doesn't exist yet, then export the constant with the guardrail text so the test passes. Worker tests live alongside the source in `research-worker/src/runners/__tests__/`. This is the first test file in the worker.

**Files:**
- Create: `research-worker/src/runners/__tests__/guardrail-prompts.test.ts`
- Modify: `research-worker/src/runners/synthesize.ts`

- [ ] **Step 1: Create the worker test file with just the synthesize case**

Create `research-worker/src/runners/__tests__/guardrail-prompts.test.ts` with the content below. Tasks 5 and 6 will extend this same file.

```ts
import { describe, expect, it } from 'vitest';
import { SYNTHESIS_SYSTEM } from '../synthesize';

describe('synthesize runner guardrail', () => {
  it('SYNTHESIS_SYSTEM contains the current-activities anti-duplication rule', () => {
    expect(SYNTHESIS_SYSTEM).toContain('CURRENT MARKETING ACTIVITIES');
    expect(SYNTHESIS_SYSTEM).toContain('anti-duplication');
    expect(SYNTHESIS_SYSTEM).toContain('MUST NOT restate');
    expect(SYNTHESIS_SYSTEM).toContain('"Current Marketing Activities:"');
  });

  it('SYNTHESIS_SYSTEM has a carve-out for the empty-field case', () => {
    expect(SYNTHESIS_SYSTEM).toContain('field is empty');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd research-worker && npm run test:run -- src/runners/__tests__/guardrail-prompts.test.ts`

Expected: FAIL — either (a) `SYNTHESIS_SYSTEM` is not exported from `synthesize.ts`, or (b) the assertions fail because the guardrail text is not in the constant yet. Either failure mode is acceptable and confirms we're about to make a real change.

- [ ] **Step 3: Export `SYNTHESIS_SYSTEM` and insert the guardrail**

Open `research-worker/src/runners/synthesize.ts`. Change the `SYNTHESIS_SYSTEM` declaration (line 93) from `const SYNTHESIS_SYSTEM = \`...` to `export const SYNTHESIS_SYSTEM = \`...`:

```ts
export const SYNTHESIS_SYSTEM = `You are synthesizing research into an actionable paid media strategy.
```

Then find the `RULES:` list that ends with the `- When citing statistics...` bullet (around line 103). Immediately after the RULES list closing line and before the `BUDGET ALLOCATION:` section, insert this new block (note the blank line before and after):

```

CURRENT MARKETING ACTIVITIES (anti-duplication rule):
- The context may contain a "Current Marketing Activities:" line describing channels, budgets, and creatives the client is ALREADY running.
- If present, your recommendations MUST NOT restate these as "new" strategy.
- Your platformRecommendations, messagingAngles, and positioningStrategy must propose NEW angles, UNTESTED channels, or CONTRARIAN moves relative to what's already in market.
- If the client is already running a channel successfully, you may keep it as a "primary" platform but your rationale MUST explicitly reference what they're doing today and describe the INCREMENTAL change (new audience, new creative system, new bidding strategy) — not repeat their existing playbook.
- If a channel is already running but failing, recommend a structural fix or cutting it — do not silently re-recommend it.
- If the field is empty or absent, ignore this rule and proceed normally.

```

The result should be that the `SYNTHESIS_SYSTEM` template literal now has the new guardrail block sandwiched between the existing `RULES:` list and the existing `BUDGET ALLOCATION:` block, with a blank line separating each section for readability.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd research-worker && npm run test:run -- src/runners/__tests__/guardrail-prompts.test.ts`

Expected: PASS — both assertions in the synthesize describe block pass.

- [ ] **Step 5: Verify the worker still typechecks**

Run: `cd research-worker && npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add research-worker/src/runners/synthesize.ts research-worker/src/runners/__tests__/guardrail-prompts.test.ts
git commit -m "$(cat <<'EOF'
feat(worker): synthesize runner respects currentMarketingActivities

Adds an anti-duplication rule to SYNTHESIS_SYSTEM that keys off the
"Current Marketing Activities:" line in the context. Stops the
strategic synthesis from restating the client's existing channels,
creatives, and targeting as new recommendations.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Media plan runner — add anti-duplication guardrail (TDD)

**Files:**
- Modify: `research-worker/src/runners/__tests__/guardrail-prompts.test.ts` (extend)
- Modify: `research-worker/src/runners/media-plan.ts`

- [ ] **Step 1: Add the failing test block**

Open `research-worker/src/runners/__tests__/guardrail-prompts.test.ts`. Append a new import and a new describe block:

```ts
import { CURRENT_ACTIVITIES_GUARDRAIL } from '../media-plan';

describe('media-plan runner guardrail', () => {
  it('CURRENT_ACTIVITIES_GUARDRAIL contains per-block anti-duplication rules', () => {
    expect(CURRENT_ACTIVITIES_GUARDRAIL).toContain('CURRENT MARKETING ACTIVITIES');
    expect(CURRENT_ACTIVITIES_GUARDRAIL).toContain('anti-duplication');
    expect(CURRENT_ACTIVITIES_GUARDRAIL).toContain('Channel Mix & Budget');
    expect(CURRENT_ACTIVITIES_GUARDRAIL).toContain('Audience & Campaign');
    expect(CURRENT_ACTIVITIES_GUARDRAIL).toContain('Creative System');
    expect(CURRENT_ACTIVITIES_GUARDRAIL).toContain('Rollout Roadmap');
  });

  it('CURRENT_ACTIVITIES_GUARDRAIL has a carve-out for the empty-field case', () => {
    expect(CURRENT_ACTIVITIES_GUARDRAIL).toContain('field is empty');
  });
});
```

Make sure the new import is at the top of the file alongside the existing `import { SYNTHESIS_SYSTEM } from '../synthesize';` line.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd research-worker && npm run test:run -- src/runners/__tests__/guardrail-prompts.test.ts`

Expected: FAIL — `CURRENT_ACTIVITIES_GUARDRAIL` is not exported from `media-plan.ts`. Previous synthesize tests still pass.

- [ ] **Step 3: Add and export the guardrail constant in media-plan.ts**

Open `research-worker/src/runners/media-plan.ts`. Immediately after the `ANTI_HALLUCINATION` constant declaration (line 45), add:

```ts
export const CURRENT_ACTIVITIES_GUARDRAIL = `

CURRENT MARKETING ACTIVITIES (anti-duplication rule):
- The context may contain a "Current Marketing Activities:" line describing channels, budgets, and creatives the client is ALREADY running.
- For Channel Mix & Budget: do not propose a budget allocation that mirrors the current one. If 60% of current spend is on Meta, your recommendation should either (a) cut Meta to open room for untested channels or (b) restructure the Meta spend into a materially different audience/creative mix, with explicit rationale.
- For Audience & Campaign: do not re-propose audience layers the client confirms they're already running. New lookalike seeds, new interest stacks, new exclusions — yes. Same targeting — no.
- For Creative System: do not recommend a creative format (UGC, static, carousel, VSL) the client explicitly says is already working or already tested. Pick a different format or a different angle on the same format.
- For Rollout Roadmap: phase 1 should not be "launch [channel they're already running]" — phase 1 is the INCREMENTAL change.
- If the field is empty or absent, ignore this rule.`;
```

- [ ] **Step 4: Inject the guardrail into `systemParts` in `generateBlock`**

Still in `research-worker/src/runners/media-plan.ts`, find the `systemParts` array definition inside `generateBlock` (around line 132). It currently looks like:

```ts
    const systemParts = [
      block.skill,
      refs ? `\n\n## Reference Data\n\n${refs}` : '',
      industryTemplate ? `\n\n## Industry Template (${industry})\n\n${industryTemplate}` : '',
      ANTI_HALLUCINATION,
    ];
```

Change it to include the new constant:

```ts
    const systemParts = [
      block.skill,
      refs ? `\n\n## Reference Data\n\n${refs}` : '',
      industryTemplate ? `\n\n## Industry Template (${industry})\n\n${industryTemplate}` : '',
      ANTI_HALLUCINATION,
      CURRENT_ACTIVITIES_GUARDRAIL,
    ];
```

There is a second place in the same file where a similar `systemParts` array is built — the snapshot regeneration block (around line 327). Find it and add the same `CURRENT_ACTIVITIES_GUARDRAIL` entry there too. The before-state looks roughly like:

```ts
      const systemParts = [
        STRATEGY_SNAPSHOT_SKILL,
        refs ? `\n\n## Reference Data\n\n${refs}` : '',
        ANTI_HALLUCINATION,
        '\n\nCRITICAL: The snapshot numbers must EXACTLY match the validated block data provided. Do not round or approximate.',
      ];
```

Change to:

```ts
      const systemParts = [
        STRATEGY_SNAPSHOT_SKILL,
        refs ? `\n\n## Reference Data\n\n${refs}` : '',
        ANTI_HALLUCINATION,
        CURRENT_ACTIVITIES_GUARDRAIL,
        '\n\nCRITICAL: The snapshot numbers must EXACTLY match the validated block data provided. Do not round or approximate.',
      ];
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd research-worker && npm run test:run -- src/runners/__tests__/guardrail-prompts.test.ts`

Expected: PASS — all tests (synthesize + media-plan) pass.

- [ ] **Step 6: Typecheck the worker**

Run: `cd research-worker && npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add research-worker/src/runners/media-plan.ts research-worker/src/runners/__tests__/guardrail-prompts.test.ts
git commit -m "$(cat <<'EOF'
feat(worker): media-plan runner respects currentMarketingActivities

Adds CURRENT_ACTIVITIES_GUARDRAIL covering all 6 media-plan blocks
(channel mix, audience, creative, measurement, rollout, snapshot).
Injected into systemParts alongside ANTI_HALLUCINATION so every
block's generation and the snapshot regen path both receive it.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Offer runner — add anti-duplication guardrail (TDD)

**Files:**
- Modify: `research-worker/src/runners/__tests__/guardrail-prompts.test.ts` (extend)
- Modify: `research-worker/src/runners/offer.ts`

- [ ] **Step 1: Add the failing test block**

Open `research-worker/src/runners/__tests__/guardrail-prompts.test.ts`. Append a new import and a new describe block:

```ts
import { OFFER_SYSTEM_PROMPT, OFFER_CURRENT_ACTIVITIES_GUARDRAIL } from '../offer';

describe('offer runner guardrail', () => {
  it('OFFER_CURRENT_ACTIVITIES_GUARDRAIL captures the offer-focused framing', () => {
    expect(OFFER_CURRENT_ACTIVITIES_GUARDRAIL).toContain('CURRENT MARKETING ACTIVITIES');
    expect(OFFER_CURRENT_ACTIVITIES_GUARDRAIL).toContain('"Current Marketing Activities:"');
    expect(OFFER_CURRENT_ACTIVITIES_GUARDRAIL).toContain('offer structure itself is the blocker');
    expect(OFFER_CURRENT_ACTIVITIES_GUARDRAIL).toContain('funnel type the client confirms is already in use');
  });

  it('OFFER_SYSTEM_PROMPT actually includes the guardrail (not just exports it)', () => {
    expect(OFFER_SYSTEM_PROMPT).toContain('CURRENT MARKETING ACTIVITIES');
    expect(OFFER_SYSTEM_PROMPT).toContain('funnel type the client confirms is already in use');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd research-worker && npm run test:run -- src/runners/__tests__/guardrail-prompts.test.ts`

Expected: FAIL — `OFFER_SYSTEM_PROMPT` and `OFFER_CURRENT_ACTIVITIES_GUARDRAIL` are not exported from `offer.ts`. Previous synthesize + media-plan tests still pass.

- [ ] **Step 3: Add the guardrail constant and append it to `OFFER_SYSTEM_PROMPT`**

Open `research-worker/src/runners/offer.ts`. Change the declaration of `OFFER_SYSTEM_PROMPT` (line 24) from `const` to `export const`, then add a new `export const OFFER_CURRENT_ACTIVITIES_GUARDRAIL` declaration BEFORE `OFFER_SYSTEM_PROMPT`, and interpolate it into the end of `OFFER_SYSTEM_PROMPT`'s template literal.

Target state:

```ts
export const OFFER_CURRENT_ACTIVITIES_GUARDRAIL = `

CURRENT MARKETING ACTIVITIES (context for offer analysis):
- The context may contain a "Current Marketing Activities:" line.
- If the client is running paid traffic with poor performance, your offer analysis should consider whether the offer structure itself is the blocker (weak guarantee, unclear value prop, wrong funnel) rather than attributing the failure to targeting or creative.
- Do not recommend a funnel type the client confirms is already in use unless you explicitly reference the existing implementation and recommend a specific structural change.
- If the field is empty or absent, ignore this rule.`;

export const OFFER_SYSTEM_PROMPT = `You are an expert offer analyst evaluating viability for paid media campaigns.

TASK: Score and assess whether this offer can convert cold traffic profitably.

EVALUATION APPROACH:
1. Clarity — Can the offer be understood in 10 seconds?
2. Strength — Score 6 dimensions (1-10 each)
3. Market Fit — Does the market want this now?
4. Red Flags — What could hurt ad performance?

/* ... existing content unchanged ... */
${OFFER_CURRENT_ACTIVITIES_GUARDRAIL}`;
```

The implementation detail: `OFFER_SYSTEM_PROMPT` is already a single top-level template literal spanning roughly line 24 through the end of the OUTPUT FORMAT / JSON schema definition. Do NOT rewrite the entire constant — instead:

1. Change `const OFFER_SYSTEM_PROMPT` to `export const OFFER_SYSTEM_PROMPT`.
2. Add the `export const OFFER_CURRENT_ACTIVITIES_GUARDRAIL` constant in the block of constants above `OFFER_SYSTEM_PROMPT` (near lines 15–22 where `OFFER_MODEL`, `OFFER_MAX_TOKENS`, `OFFER_TIMEOUT_MS`, `WEB_SEARCH_TOOL` live).
3. Find the closing backtick of `OFFER_SYSTEM_PROMPT` and insert `${OFFER_CURRENT_ACTIVITIES_GUARDRAIL}` on its own line immediately before the closing backtick.

To locate the closing backtick, run: `grep -n "\`;" research-worker/src/runners/offer.ts | head -5` and identify the closing backtick that terminates the `OFFER_SYSTEM_PROMPT` template literal (the first `` `; `` after line 24 that is at column 0 or close to it, not inside an inner template interpolation).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd research-worker && npm run test:run -- src/runners/__tests__/guardrail-prompts.test.ts`

Expected: PASS — all tests across all three describe blocks pass.

- [ ] **Step 5: Typecheck the worker**

Run: `cd research-worker && npx tsc --noEmit`

Expected: exit 0. If the offer.ts template literal was broken by the insertion, the typechecker will report it — fix the backtick/placement issue.

- [ ] **Step 6: Commit**

```bash
git add research-worker/src/runners/offer.ts research-worker/src/runners/__tests__/guardrail-prompts.test.ts
git commit -m "$(cat <<'EOF'
feat(worker): offer runner respects currentMarketingActivities

Appends OFFER_CURRENT_ACTIVITIES_GUARDRAIL to OFFER_SYSTEM_PROMPT.
The offer-focused framing: if the client is running paid traffic
with poor performance, consider whether the offer structure itself
is the blocker (weak guarantee, unclear value prop, wrong funnel)
rather than attributing failure to targeting or creative.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Full verification gate

**Files:** none (verification only)

This task is the final gate before declaring the feature done. Follows `.claude/rules/verification.md` — every bullet must pass.

- [ ] **Step 1: Run the full Next.js test suite**

Run: `npm run test:run`

Expected: PASS. All pre-existing tests + the new field-catalog and context-string tests.

If any unrelated test fails, check `CLAUDE.md` — the project explicitly notes pre-existing TS errors in openrouter tests and chat blueprint tests that are NOT related to this change. Those failures are acceptable to ignore if and only if they were failing on `main` before this branch too. Run `git stash && npm run test:run && git stash pop` to confirm the failure is pre-existing. Do NOT fix unrelated pre-existing failures in this PR.

- [ ] **Step 2: Run the worker test suite**

Run: `cd research-worker && npm run test:run`

Expected: PASS. Only the new `guardrail-prompts.test.ts` file (3 describe blocks, ~9 assertions) runs — the worker had zero tests before this change.

- [ ] **Step 3: Run the Next.js build**

Run: `npm run build`

Expected: exit 0. No new TypeScript errors, no new build warnings related to the changed files.

- [ ] **Step 4: Run the worker build**

Run: `cd research-worker && npm run build`

Expected: exit 0. The worker builds with `tsc` to `dist/`.

- [ ] **Step 5: Run lint**

Run: `npm run lint`

Expected: clean (or, if there are pre-existing warnings, no NEW warnings in the files this PR touched).

- [ ] **Step 6: Manual UI trace — profile list page**

Start the dev server (or use an existing one): `npm run dev`

In a browser, navigate to `/profiles`. Pick any existing profile and expand its inline edit form. Scroll to the "Goals & Strategy" group. **Expected:** a new textarea labeled "Current Marketing Activities" is present, 4 rows tall, with the placeholder text starting "Meta $8k/mo — LAL 1% + interest stacks..." and the helper text "Channels you're already running...".

If the field is missing, check that `PROFILE_FIELD_GROUPS` in `field-catalog.ts` has `currentMarketingActivities` in the `goals-strategy` group's `fieldKeys`. If the textarea is single-line instead of 4 rows, check `PROFILE_MULTILINE_KEYS`.

- [ ] **Step 7: Manual UI trace — profile detail page**

Still in the dev server, navigate to `/profiles/<id>` for a profile that has `currentMarketingActivities` set. **Expected:** the field appears in the Goals & Strategy section with its value rendered.

Then navigate to a profile that does NOT have it set. **Expected:** the field is absent (the `.filter((f) => f.value)` in `src/app/profiles/[id]/page.tsx:235` drops empty fields).

- [ ] **Step 8: Manual UI trace — profile edit write-back**

On `/profiles`, type `Meta $5k LAL, UGC working. LinkedIn $2k job-title, flat.` into the new textarea. Click Save (or whatever the existing save trigger is). Reload the page. **Expected:** the value persists.

Verify in Supabase (optional but valuable): query `select all_fields -> 'currentMarketingActivities' from business_profiles where id = '<profileId>';`. **Expected:** the value is present in the JSONB.

- [ ] **Step 9: End-to-end research trace (paid API call — opt-in)**

This is the single expensive test that validates the guardrail actually changes model behavior, not just that the prompt contains the expected strings.

**Do not run this step automatically** — it consumes paid Anthropic credits and is governed by the `feedback_no_api_testing_loops` memory rule. Only run if the user explicitly asks you to.

If the user opts in:

1. Start a fresh journey on `/journey` for Fellow.ai (the canonical regression target per the project memory).
2. In the onboarding review step, fill `currentMarketingActivities` with: `Currently running Meta ads with 1% LAL audiences, testing UGC creatives, 2.3x ROAS. LinkedIn sponsored content for decision-makers, flat CPL. Google Search brand-only.`
3. Kick off the full pipeline through to `crossAnalysis` + `mediaPlan`.
4. Open the synthesized output and grep/read the `platformRecommendations`, `messagingAngles`, and `positioningStrategy` sections. Open the media plan and read the `channelMixBudget` block and `rolloutRoadmap` phase 1.

**Pass criterion:** neither the synthesis output nor the media plan output lists "Meta with LAL + UGC" as a NEW primary recommendation. Either (a) the rationale explicitly acknowledges the existing setup and proposes an incremental change (new audience seed, new creative format, new bidding strategy), or (b) the top recommendation is for a different channel.

**Fail criterion:** the output repeats "Meta LAL audiences" or "UGC testimonial creatives" as a top-line recommendation without any acknowledgement of what the client said they're already doing.

If it fails, the guardrail paragraph phrasing needs iteration. The field shape and registration are correct — do not touch `field-catalog.ts` or `context-string.ts`. Instead, open the failing runner's system prompt and make the anti-duplication language more directive (stronger MUST NOT clauses, more explicit examples). Then re-run.

- [ ] **Step 10: Write the verification report**

After all previous steps pass, write a short verification report (to the chat, no file) in the following format:

```
Verification report — currentMarketingActivities
================================================
1. UI         : unified-field-review renders field           [PASS/FAIL]
2. Submit     : field in acceptedJourneyFields               [PASS/FAIL]
3. Context    : "Current Marketing Activities: …" emitted    [PASS/FAIL]
4. Persist    : POST /api/profiles writes to all_fields      [PASS/FAIL]
5. Dispatch   : /api/journey/dispatch passes verbatim        [PASS/FAIL]
6. Worker     : 3 runners receive the line                   [PASS/FAIL]
7. Output     : media plan does not duplicate Meta/LAL/UGC   [PASS/FAIL/SKIP]
8. Tests      : field-catalog + context-string + guardrails  [PASS/FAIL]
9. Build      : next build + worker tsc                      [PASS/FAIL]
10. Lint      : npm run lint                                 [PASS/FAIL]
```

Mark step 7 as SKIP if the user did not opt in to the paid end-to-end trace. Mark any other step as FAIL if it did not pass, and do NOT declare the feature done — fix the failure first.

---

## Task 8: Update PRIMER.md (if a work-in-progress handoff is needed)

**Files:**
- Modify: `PRIMER.md` (only if the user wants a handoff note written for the next session)

This task is optional. If the user says "update PRIMER" or if the implementation is going to straddle multiple sessions, write a short handoff block to `PRIMER.md` summarizing: what shipped, what's left, where to pick up, which tests to re-run. Otherwise skip this task and go straight to the execution-handoff prompt below.

---

## Self-review (performed by plan author)

**Spec coverage check** — every requirement in `docs/superpowers/specs/2026-04-08-current-marketing-activities-design.md` mapped to a task:

| Spec requirement | Task |
|---|---|
| Field definition (key, label, category, section, collection, rows, placeholder, helper) | Task 3 |
| Registration in `JOURNEY_FIELDS`, `JOURNEY_ENRICHMENT_FIELD_METAS`, `JOURNEY_FIELD_GROUPS`, `PROFILE_FIELD_GROUPS`, `PROFILE_MULTILINE_KEYS` | Task 3 |
| Must NOT be in required/pricing/blocker sets | Task 3 (tested explicitly in step 1) |
| Must NOT add FIELD_MAP entry | Not touched — correct-by-omission |
| `buildJourneyResearchContext` helper + new file | Task 1 |
| `src/app/journey/page.tsx` refactor (both call sites) | Task 2 |
| Synthesize runner guardrail + export | Task 4 |
| Media plan runner guardrail (all 6 blocks + snapshot regen) | Task 5 |
| Offer runner guardrail | Task 6 |
| field-catalog.test.ts 4+ new cases | Task 3 |
| context-string.test.ts 3+ new cases | Task 1 |
| guardrail-prompts.test.ts 3 prompt-inclusion tests | Tasks 4, 5, 6 |
| Live-API test explicitly out of scope | Task 7 step 9 (opt-in only) |
| Automated verification (build, tests, lint) | Task 7 steps 1–5 |
| Manual UI trace | Task 7 steps 6–8 |
| End-to-end research trace with Fellow.ai | Task 7 step 9 |
| Data flow checklist | Task 7 step 10 |
| Files explicitly NOT touched | Enforced by task design (no task touches those files) |

**Placeholder scan:** no "TODO", "TBD", "similar to Task N", or un-fleshed-out steps. Every code step has complete code; every test step has complete test code; every commit step has the full commit message.

**Type consistency:** `buildJourneyResearchContext` has the same signature in Task 1 (definition), Task 2 (call site), and Task 3 (test case) — `(fields: Record<string, string | undefined>, orderedKeys?: readonly string[]) => string`. `CURRENT_ACTIVITIES_GUARDRAIL` constant name is consistent across Task 5 declaration and Task 5 test assertion. `OFFER_CURRENT_ACTIVITIES_GUARDRAIL` is consistent across Task 6 declaration and test. `SYNTHESIS_SYSTEM` is the existing constant name — export only, no rename.

**Known unknown resolved:** `offer.ts` was read during planning. The `OFFER_SYSTEM_PROMPT` constant exists as a single top-level template literal — the injection strategy in Task 6 Step 3 is correct.

Plan is ready for execution.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-08-current-marketing-activities.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (Task 1 → review → Task 2 → review → ...), review between tasks, fast iteration. Lower risk because each task's diff is small and reviewable in isolation.

2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review. Faster if the implementation is straightforward.

Which approach?
