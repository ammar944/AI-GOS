# Paid Media Plan Quality Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden `positioningPaidMediaPlan` so the current live blocker can be rerun and the artifact meets the PMP validation rig's core execution-quality checks.

**Architecture:** Keep paid media as an in-process lab-engine synthesis capstone. Tighten the existing schema minimum validator, output normalizer, prompt contract, fixture, renderer, and tests without changing orchestration or the six-section rollup.

**Registry decision:** Keep the existing `positioningPaidMediaPlan` `allowedTools: ["keyword_ad_probe"]` and `maxExternalLookups: 2` unchanged. This plan does not add a new research surface; the current bounded SERP/ad-count probe remains available for channel-truth checks. If that behavior is removed later, update `src/lib/lab-engine/sections/section-registry.ts` and `src/lib/lab-engine/sections/__tests__/section-registry.test.ts` in a separate contract change.

**Execution status, 2026-06-05:** Tasks 1-7 are implemented and verified locally. Task 8 remains the live-proof gate: one authenticated async rerun must capture the new section-run id and poll that exact row to terminal DB proof.

**Tech Stack:** Next.js 16, TypeScript strict, Zod, Vitest, React Testing Library, Supabase live proof.

---

## File Structure

- Modify `src/lib/lab-engine/artifacts/schemas/paid-media-plan.ts`
  - Add source URLs to funnel/channel schemas.
  - Add deterministic minimum validators for spend math, creative type fills, competitor signal, funnel specificity, and channel specificity.
- Modify `src/lib/lab-engine/agents/run-section.ts`
  - Preserve source URL fields for funnel/channel output.
  - Strip paired numeric values when money provenance normalizes to `unknown`.
- Modify `src/lib/lab-engine/skills/positioning-paid-media-plan/SKILL.md`
  - Update exact field contracts and add 1000x quality examples.
- Modify `src/lib/lab-engine/fixtures/paid-media-plan-artifact.ts`
  - Make the fixture satisfy the stronger contract.
- Modify `src/lib/lab-engine/artifacts/schemas/__tests__/paid-media-plan.test.ts`
  - Add focused rejection tests for each new validator.
- Modify `src/lib/lab-engine/agents/__tests__/run-section-corpus-only.test.ts`
  - Assert normalizer behavior for sourceUrl and unknown provenance numeric stripping.
- Modify `src/components/research-v2/section-renderers/paid-media-plan.tsx`
  - Render funnel/channel source links when present while tolerating legacy artifacts.
- Modify `src/components/research-v2/section-renderers/__tests__/paid-media-plan.test.tsx`
  - Assert source-linked funnel/channel rendering remains stable.

## Chunk 1: Contract And Fixture

### Task 1: Add source URLs to funnel/channel contract

**Files:**
- Modify: `src/lib/lab-engine/artifacts/schemas/paid-media-plan.ts`
- Modify: `src/lib/lab-engine/fixtures/paid-media-plan-artifact.ts`
- Modify: `src/lib/lab-engine/artifacts/schemas/__tests__/paid-media-plan.test.ts`

- [ ] **Step 1: Update schema fields**

Add `sourceUrl: z.string().url()` to `funnelRecommendationSchema` and `channelSuggestionSchema`.

- [ ] **Step 2: Update fixture**

Add source URLs to every fixture funnel recommendation and channel suggestion, using existing `sourceRefs.offer.sourceUrl` or another real fixture source URL.

- [ ] **Step 3: Add failing tests**

Add tests that remove funnel/channel `sourceUrl` and expect `paidMediaPlanSectionOutputSchema.safeParse(...)` or `validatePaidMediaPlanMinimums(...)` to fail with the relevant path.

- [ ] **Step 4: Run focused schema test**

Run: `npm run test:run -- src/lib/lab-engine/artifacts/schemas/__tests__/paid-media-plan.test.ts`

Expected: passes after implementation.

### Task 2: Add deterministic quality validators

**Files:**
- Modify: `src/lib/lab-engine/artifacts/schemas/paid-media-plan.ts`
- Modify: `src/lib/lab-engine/artifacts/schemas/__tests__/paid-media-plan.test.ts`

- [ ] **Step 1: Add helper predicates**

Add small pure helpers:

```ts
function hasSpecificSignal(value: string): boolean;
function hasBuyerReference(value: string): boolean;
function hasFunnelStageReference(value: string): boolean;
function hasSpecificAssetOrMetric(value: string): boolean;
function hasActionVerb(value: string): boolean;
```

- [ ] **Step 2: Add creative framework validator**

Validate each creative type's required fields with `validateStrategicText` where appropriate.

- [ ] **Step 3: Add spend math validator**

When numeric siblings are present, validate:
- overview daily spend times 30 equals overview monthly budget within tolerance
- audience daily budget sum times 30 equals overview monthly budget within tolerance
- each phase monthly budget equals overview monthly budget within tolerance

- [ ] **Step 4: Add competitor/funnel/channel validators**

Reject generic competitor claims, funnel recs without buyer and stage references, and channel recs without asset/metric plus action verb.

- [ ] **Step 5: Add focused tests**

Add one rejection test for each validator.

- [ ] **Step 6: Run focused schema test**

Run: `npm run test:run -- src/lib/lab-engine/artifacts/schemas/__tests__/paid-media-plan.test.ts`

Expected: passes.

## Chunk 2: Normalizer And Prompt

### Task 3: Harden paid-media output normalization

**Files:**
- Modify: `src/lib/lab-engine/agents/run-section.ts`
- Modify: `src/lib/lab-engine/agents/__tests__/run-section-corpus-only.test.ts`

- [ ] **Step 1: Add provenance numeric stripping**

When `normalizePaidMediaMoneyProvenance(...)` returns `unknown`, remove the paired numeric field from that same record.

- [ ] **Step 2: Preserve funnel/channel source URLs**

Add `sourceUrl` to the allowed/string keys for `funnelIdeation.recommendations` and `channelSuggestions.suggestions`.

- [ ] **Step 3: Update drift test**

In `run-section-corpus-only.test.ts`, inject missing provenance plus numeric values and assert the committed artifact strips invalid numeric siblings or carries valid provenance.

- [ ] **Step 4: Run focused normalizer test**

Run: `npm run test:run -- src/lib/lab-engine/agents/__tests__/run-section-corpus-only.test.ts`

Expected: passes.

### Task 4: Tighten the paid-media skill prompt

**Files:**
- Modify: `src/lib/lab-engine/skills/positioning-paid-media-plan/SKILL.md`

- [ ] **Step 1: Update field contracts**

Add `sourceUrl` to `funnelIdeation.recommendations[]` and `channelSuggestions.suggestions[]`.

- [ ] **Step 2: Add 1000x quality rules**

State that spend math must reconcile, creative framework entries must be filled by type, competitor insights must include specific claims, funnel recs must name buyer and stage, and channel suggestions must name a concrete asset/metric plus action.

- [ ] **Step 3: Add one compact worked example**

Add an example that demonstrates one funnel rec, one channel rec, and one creative framework fill at the target quality bar.

## Chunk 3: Renderer Compatibility

### Task 5: Render new source URLs without breaking legacy artifacts

**Files:**
- Modify: `src/components/research-v2/section-renderers/paid-media-plan.tsx`
- Modify: `src/components/research-v2/section-renderers/__tests__/paid-media-plan.test.tsx`

- [ ] **Step 1: Make source link rendering tolerant**

For funnel and channel rows, render `SourceLink` only when `sourceUrl` is a non-empty string.

- [ ] **Step 2: Add renderer test assertions**

Assert the fixture renders source links for funnel/channel and the legacy fixture still renders unknown provenance without throwing.

- [ ] **Step 3: Run renderer test**

Run: `npm run test:run -- src/components/research-v2/section-renderers/__tests__/paid-media-plan.test.tsx`

Expected: passes.

## Chunk 4: Verification And Live Proof

### Task 6: Run local verification

**Files:**
- Validate all modified files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test:run -- \
  src/lib/lab-engine/artifacts/schemas/__tests__/paid-media-plan.test.ts \
  src/lib/lab-engine/agents/__tests__/run-section-corpus-only.test.ts \
  src/components/research-v2/section-renderers/__tests__/paid-media-plan.test.tsx
```

Expected: passes.

- [ ] **Step 2: Run broader checks**

Run:

```bash
npm run test:run
npm run build
```

Expected: passes, or document any pre-existing unrelated failures with exact errors.

### Task 7: Commit the code change

**Files:**
- Stage only files changed by this plan.

- [ ] **Step 1: Inspect diff**

Run: `git --no-pager diff`

- [ ] **Step 2: Commit**

Run:

```bash
git add \
  src/lib/lab-engine/artifacts/schemas/paid-media-plan.ts \
  src/lib/lab-engine/artifacts/schemas/__tests__/paid-media-plan.test.ts \
  src/lib/lab-engine/agents/run-section.ts \
  src/lib/lab-engine/agents/__tests__/run-section-corpus-only.test.ts \
  src/lib/lab-engine/skills/positioning-paid-media-plan/SKILL.md \
  src/lib/lab-engine/fixtures/paid-media-plan-artifact.ts \
  src/components/research-v2/section-renderers/paid-media-plan.tsx \
  src/components/research-v2/section-renderers/__tests__/paid-media-plan.test.tsx
git commit -m "fix: harden paid media plan quality gates"
```

### Task 8: One authenticated live paid-media rerun

**Files:**
- No source edits.

- [ ] **Step 1: Start local app**

Run: `npm run dev` and use the available localhost port.

- [ ] **Step 2: Open authenticated page**

Open:

`http://localhost:<PORT>/research-v3?runId=0dc9720b-81a3-487f-ab1f-fac60329b25b&section=positioningPaidMediaPlan`

- [ ] **Step 3: Trigger rerun**

From authenticated browser context, call:

```js
await fetch('/api/research-v2/rerun-section', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'same-origin',
  body: JSON.stringify({
    runId: '0dc9720b-81a3-487f-ab1f-fac60329b25b',
    zone: 'positioningPaidMediaPlan',
  }),
}).then(async (response) => ({
  status: response.status,
  body: await response.json().catch(async () => await response.text()),
}));
```

Capture the returned `section_run_id` or equivalent run identifier from the JSON response. If the response does not include a section-run id, capture the response body and query the newest `research_section_runs` row for the exact `runId` and `section_id='positioningPaidMediaPlan'` immediately after the request, then use that id for the rest of the proof.

- [ ] **Step 4: Verify DB proof**

Use Supabase service-role read queries to poll that exact `research_section_runs.id` until it reaches terminal `complete` or `error`. Then prove the current paid-media artifact row and matching section run are both `complete`, both error fields are null, `data.sectionId` is `positioningPaidMediaPlan`, body is an object, sources count is at least 5, and `counts_toward_rollup=false`.

- [ ] **Step 5: Report exact proof**

Record the new `research_section_runs.id`, `research_artifact_sections.id`, statuses, verification tier, source count, and error fields.
