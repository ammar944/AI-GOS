# Lean Media Plan — Stage B Production Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bloated capstone pipeline with a single lean `deepseek-v4-flash` call that produces the full 13-slide paid media plan, gated by a productionized claim→source verifier (split gate: deterministic hard-fail / judge soft-badge), after migrating the paid-media schema to the tolerant lean shape.

**Architecture:** (1) Migrate `src/lib/lab-engine/artifacts/schemas/paid-media-plan.ts` to the tolerant lean shape — the proven `leanMediaPlanV3Schema` in `scripts/zz-prove-lean-media-plan-v3.ts:260-305` is the reference, copy-from-it. This kills the `.strict()`→repair-loop regression. (2) Flip paid-media to one `deepseek-v4-flash` call, thinking disabled, with a **tolerant** count normalizer (never a hard parse-throw) and a `finishReason==='stop'` commit gate. (3) **Fold + delete:** delete the `positioningCrossSectionReasoning` (thinker) + `positioningSynthesis` capstones and the `strategic-critic` module; paid-media dispatches off the 6/6 rollup and emits `crossSectionInsight` inline. (4) Extract the verifier from `scripts/` into `src/lib`, extend its claim coverage to the currently-blind fields, and wire it as a split gate at paid-media commit. (5) Update the renderer for 13 slides + a section-level `needs_review` badge. (6) Live ~$2 Airtable E2E is the gate.

**Tech Stack:** Next.js 16, Vercel AI SDK v6, `@ai-sdk/deepseek` (`deepseek-v4-flash`, thinking disabled), Zod (tolerant `z.object()`), Supabase, Vitest.

---

## Locked decisions (do not re-litigate — set by the operator's prior grilling + this session's fork gate)

| # | Decision | Source |
|---|----------|--------|
| **13-slide full deliverable** | Render all 12 blocks + 1 folded driver. The 7-block `SKILL-DESIGN-BRIEF` strip-list is SUPERSEDED. | `tmp/lean-media-plan-OFFICIAL-TEMPLATE-SPEC.md` |
| **One `deepseek-v4-flash` call, thinking disabled** | Production currently routes paid-media to `deepseek-v4-pro`; this plan flips it to flash. | Template spec + proof (48–55s clean) |
| **Capstones → Fold + delete (pure lean)** | Delete `positioningCrossSectionReasoning` + `positioningSynthesis` sections + `strategic-critic.ts` + their cards. Paid-media folds cross-section reasoning inline and dispatches off the 6/6 rollup. | Fork gate (this session) |
| **Platform → Meta-default, reflect declared channels** | Creative/audiences Meta-format; `campaignOverview.platform` + `channelSuggestions` reflect `onboarding.channels`. | Fork gate |
| **audienceTypes[].detail → Gate it** | Add `grounding` field; bring `audienceTypes[].detail` under the verifier. | Fork gate |
| **needs_review → Section-level badge** | One amber badge on the paid-media card when any judge flag fires; deterministic flags hard-fail. | Fork gate |
| **Count enforcement → TOLERANT (snap/pad/truncate), never a hard `.length()` parse-throw** | A hard `.length()` throw on count drift would recreate the exact repair-loop regression W1 kills. Enforce counts in a post-parse normalizer. | This plan (stated assumption; rationale: regression-safety) |
| **Split gate is the trust boundary** | HARD-FAIL: `FABRICATED_QUOTE`, `MIS_ATTRIBUTION(count)`, `EMPTY_SECTION_CITATION`, `INVALID_ENUM`, `VERIFIER_ERROR`. SOFT `needs_review`: `FABRICATION`, `MIS_ATTRIBUTION(sibling)`, `PROVENANCE_INFLATION`, `CONTRADICTION`. ALWAYS PASS: `grounding=='UNVERIFIED'`. | `tmp/lean-media-plan-VERIFIER-HARDENED.md §5` |

## Corrections to the original handoff (verified against code — read before executing)

1. **Paid-media already runs as ONE inline call.** No serial 4-call chain feeds it. The "2× pro critic" attaches only to the thinker (`run-section.ts applyStrategicCriticIfNeeded` early-returns for `sectionId !== 'positioningCrossSectionReasoning'`). The lean work is *deleting upstream capstones + dispatch decoupling*, not removing calls from paid-media.
2. **The 285s timeout is the strict-repair loop, not DAG serialization.** Post-generation `.strict().parse()` against the 853-line schema throws `ZodError` → classified non-terminal (`run-section.ts:367-373`) → forces a 2nd 240s structured call → two 240s calls in one 285s job → abort. **W1 (schema) is the regression fix.**
3. **No hardcoded $9k in production.** Only in `scripts/zz-prove-lean-media-plan*.ts`. Prod reads `onboarding.economics.monthlyAdBudget` (`corpus-to-research-input.ts:350` → `build-prompts.ts:329,426`). W6 is verification, not a rewrite.
4. **The verifier reads a FLAT lean shape the current nested schema does not produce** → zero claims extracted today → silent pass. **W1 is a hard prerequisite of W4.**
5. **`.strict()` is on ~20 nested objects, not one line**, and is a backstop (the explicit normalizer strips, not `.strict()`). KEEP `.strict()` on the draft schema (`run-section.ts:147-151`, load-bearing) and on `artifact-envelope.ts`; update `answer-tool.test.ts:64` + streaming tests when the body root goes tolerant.
6. **`gtmMediaBuyingStandardPreamble` does not exist.** Only `withGtmStrategicStandardPreamble` is applied (unconditionally, incl. paid-media). Do not reference the non-existent preamble.
7. **Deleting thinker/synthesis has wide blast radius** (route, registry, `strategic-critic.ts`, `run-section.ts`, `use-audit-state.ts`, renderers, card-taxonomy, fixtures, DB seed_orchestration) — not the handoff's 3 files.

## Execution order & dependency graph

```
W1 (schema)  ──┬─→ W2 (lean call)  ──┐
               ├─→ W4 (verifier)   ──┤
               └─→ W5 (renderer)   ──┤
W3 (capstone delete + dispatch) ────┼─→ W6 (budget/platform) → W7 (SKILL) → W8 (live E2E gate)
                                     │
   (W3 is independent of W1 but both must land before W8; do W1→W2→W3→W4→W5→W6→W7→W8)
```

**Per-work-stream gate (run before moving on):** `npx tsc --noEmit` clean (3 known pre-existing share-route errors on main are allowed), the work-stream's targeted vitest file(s) green, then at W-stream boundaries `npm run test:run` + `npm run build`. **Live-run-is-the-gate: W8 is the real sign-off; unit-green ≠ working.**

---

## W1 — Schema migration to the tolerant lean shape

**Why:** The `.strict()` post-generation re-parse is the regression root cause AND the reason the verifier extracts zero claims. The proven target shape already exists in `scripts/zz-prove-lean-media-plan-v3.ts:260-305` (`leanMediaPlanV3Schema`). Port it into the production schema file.

**Reference shape (`leanMediaPlanV3Schema`, do not redesign — port):** plain `z.object()` (strips unknowns), free-string `sourceSection`/`angleType`/`verdict`, `grounding: z.string()` (literal `'UNVERIFIED'` when ungroundable) on every grounded row, `crossSectionInsight[]` with `{tension, sourceSections[], implicationForPlan, clientBlindSpot, secondOrderRisk, contrarianInversion}`, money `*Provenance` string pairs. Slot shapes: `campaignPhases`(2), `audienceTypes`(3, **add `grounding`**), `anglesToTest`(4), `creativeFramework`(8), `funnelIdeation`(3), `competitorReviewInsights`(3), `channelSuggestions`(4), `kpis`(3), `competitorMarketingInsights`(≥2). **Dropped:** `strategicThesis`, `contradictionReconciliation`, `orderedMoves`.

### Task 1.1: Define the lean body schema in `paid-media-plan.ts`

**Files:**
- Modify: `src/lib/lab-engine/artifacts/schemas/paid-media-plan.ts`
- Reference (read first): `scripts/zz-prove-lean-media-plan-v3.ts:52-305`
- Test: `src/lib/lab-engine/artifacts/schemas/__tests__/paid-media-plan.test.ts` (create if absent)

- [ ] **Step 1: Read both files.** Read `paid-media-plan.ts` in full (853 lines) and `zz-prove-lean-media-plan-v3.ts:52-305`. Confirm the v3 sub-schema names and field shapes.

- [ ] **Step 2: Write the failing test** for the new tolerant body. The test must assert the regression-fix behavior:

```ts
// paid-media-plan.test.ts
import { describe, it, expect } from 'vitest';
import { paidMediaPlanBodySchema } from '../paid-media-plan';
import leanFixture from '../../../../../scripts/__fixtures__/lean-media-plan-v3.sample.json'; // copy a v3 proof output here

describe('paidMediaPlanBodySchema (lean)', () => {
  it('parses a v3-shaped plan', () => {
    expect(paidMediaPlanBodySchema.safeParse(leanFixture).success).toBe(true);
  });
  it('STRIPS unknown keys instead of throwing (regression fix)', () => {
    const withjunk = { ...leanFixture, __strayModelKey: 'oops' };
    const parsed = paidMediaPlanBodySchema.safeParse(withjunk);
    expect(parsed.success).toBe(true);
    expect((parsed as any).data.__strayModelKey).toBeUndefined();
  });
  it('accepts a free-string sourceSection (no enum reject)', () => {
    const plan = structuredClone(leanFixture);
    plan.creativeFramework[0].sourceSection = 'positioningVoC'; // off-vocab; must NOT throw
    expect(paidMediaPlanBodySchema.safeParse(plan).success).toBe(true);
  });
  it('has no strategicThesis/contradictionReconciliation/orderedMoves keys', () => {
    const shape = Object.keys((paidMediaPlanBodySchema as any).shape);
    expect(shape).not.toContain('strategicThesis');
    expect(shape).not.toContain('contradictionReconciliation');
    expect(shape).not.toContain('orderedMoves');
    expect(shape).toContain('crossSectionInsight');
  });
});
```

- [ ] **Step 3: Run the test — verify it fails.** `npm run test:run -- src/lib/lab-engine/artifacts/schemas/__tests__/paid-media-plan.test.ts` → FAIL (old strict schema rejects stray keys + has the dropped blocks).

- [ ] **Step 4: Port the lean schema.** In `paid-media-plan.ts`, replace `paidMediaPlanBodySchema` (currently line 356, `.strict()` at 403) with the lean body ported from `leanMediaPlanV3Schema`. Specifics:
  - Root `z.object({...})` — **no `.strict()`** at the body root or on nested sub-objects (the regression source). Keep `.strict()` ONLY where the codebase relies on it outside the body: do not touch `artifact-envelope.ts`.
  - `sourceSection`: replace every `z.enum(sourceSectionValues)` usage in the body with `z.string()`; keep `sourceSectionValues` exported (the snap target — see Task 1.4).
  - `angleType`, channel `verdict`, `funnelType`: `z.string().describe(...)` (free).
  - Add `grounding: z.string()` to: `anglesToTest[]`, `creativeFramework[]` slots, `competitorReviewInsights[]`, `competitorMarketingInsights[]`, **and `audienceTypes[]`** (the locked gate-it decision).
  - Add `crossSectionInsight: z.array(z.object({ tension: z.string(), sourceSections: z.array(z.string()), implicationForPlan: z.string(), clientBlindSpot: z.string(), secondOrderRisk: z.string(), contrarianInversion: z.string() }))`.
  - Keep money `*Provenance` string fields + numeric `*Value` siblings + the `rejectUnknownProvenanceNumericMoney` superRefine (port from current lines 123-138 — it stays valuable for the badge).
  - **Counts are NOT enforced via `.length()` here** (tolerant decision) — describe them (`'EXACTLY 8'`) and enforce in the normalizer (Task 1.2).
  - Delete `strategicThesisSchema`, `contradictionReconciliationSchema`, `orderedMoveSchema`, `provesWrongIfSchema` and their body keys.

- [ ] **Step 5: Run the test — verify it passes.** Same command → PASS.

- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(paid-media): migrate body schema to tolerant lean shape (kills strict-repair regression)"`

### Task 1.2: Replace `validatePaidMediaPlanMinimums` with a tolerant normalizer

**Files:**
- Modify: `src/lib/lab-engine/artifacts/schemas/paid-media-plan.ts:793-853` (the validator) + the count/snap helpers
- Test: `src/lib/lab-engine/artifacts/schemas/__tests__/paid-media-plan.test.ts`

- [ ] **Step 1: Write the failing test** — a wrong-count plan must be SNAPPED, never rejected:

```ts
it('normalizes a 7-slot creativeFramework up to 8 without throwing', () => {
  const plan = structuredClone(leanFixture);
  plan.creativeFramework = plan.creativeFramework.slice(0, 7);
  const out = normalizePaidMediaPlanBody(plan); // new export
  expect(out.creativeFramework).toHaveLength(8);
  expect(out.creativeFramework[7].grounding).toBe('UNVERIFIED'); // padded slot is honest
});
it('truncates a 9-slot creativeFramework down to 8', () => {
  const plan = structuredClone(leanFixture);
  plan.creativeFramework.push({ ...plan.creativeFramework[0], label: 'Static 6' });
  expect(normalizePaidMediaPlanBody(plan).creativeFramework).toHaveLength(8);
});
```

- [ ] **Step 2: Run — verify it fails** (`normalizePaidMediaPlanBody` not exported yet).

- [ ] **Step 3: Implement `normalizePaidMediaPlanBody(body)`** that snaps/pads/truncates the fixed-count arrays (`campaignPhases`→2, `audienceTypes`→3, `anglesToTest`→4, `creativeFramework`→8, `funnelIdeation`→3, `competitorReviewInsights`→3, `channelSuggestions`→4, `kpis`→3) and snaps `sourceSection` to the canonical set via the snap helper (Task 1.4). Padded slots get `grounding: 'UNVERIFIED'` and a neutral placeholder label. **Never throws.** Rewrite `validatePaidMediaPlanMinimums` to: call the normalizer first, then run only the still-valid structural checks (`sources>=5`, spend-math reconciliation when numeric siblings present, per-creative "specific copy OR grounding==='UNVERIFIED'"). DELETE `validateThesis`, `validateOrderedMoves`, `validateProvesWrongIfMinimums`, the `synthesizedGroundingCount>=14` gate, and any check keyed on dropped blocks.

- [ ] **Step 4: Run — verify it passes.**

- [ ] **Step 5: Commit.** `git commit -am "feat(paid-media): tolerant count normalizer replaces strict minimums validator"`

### Task 1.3: Point the generation schema at the lean shape

**Files:** `src/lib/lab-engine/agents/run-section.ts` (`getStructuredGenerationSchema` ~line 1928, `paidMediaPlanGenerationSchema`), `paid-media-plan.ts`

- [ ] **Step 1:** Read `run-section.ts:1928-1930` and find `paidMediaPlanGenerationSchema`. Confirm it is the model-facing (permissive) schema.
- [ ] **Step 2:** Set `paidMediaPlanGenerationSchema = paidMediaPlanBodySchema` (the new tolerant lean body) OR a describe-only twin with no count constraints. Ensure NO `.min()/.max()/.length()` reaches the model schema (DeepSeek path — soft counts only; counts enforced post-parse by the normalizer).
- [ ] **Step 3:** Verify the post-generation path no longer does a strict re-parse that can throw→repair. Read `run-section.ts:5007` + `:5242` (the post-gen `.parse()` twins) and `:367-373` (`hasTerminalStructuredError`). Replace the strict `.parse()` for paid-media with `normalizePaidMediaPlanBody` + tolerant `safeParse`; on `safeParse` failure of REQUIRED fields, allow ONE repair (that path stays), but a missing/extra optional key must NOT trigger repair.
- [ ] **Step 4:** Run `npm run test:run -- src/lib/lab-engine/agents/__tests__` targeted paid-media tests; expect green or update pinned expectations.
- [ ] **Step 5: Commit.** `git commit -am "feat(paid-media): generation path uses tolerant lean schema, no strict-reparse repair loop"`

### Task 1.4: Snap helper + sourceSection vocabulary + downstream types/tests

**Files:** `paid-media-plan.ts` (snap helpers, `sourceSectionValues`, `PaidMediaPlanBody` type), `src/app/api/research-v2/run-lab-section/__tests__/`, `answer-tool.test.ts`, `run-section-artifact-streaming.test.ts`, `section-registry.ts` (type-satisfies block + fixture)

- [ ] **Step 1:** Keep `snapCreativeType` pattern; add `snapSourceSection(value: unknown): string` that maps free input to the canonical set — **the 6 positioning IDs + `gtmBrief`** (cross-section reasoning is now folded into paid-media, so `positioningCrossSectionReasoning` as a *source* is gone; but keep it accepted-and-mapped-to-`positioningCrossSectionReasoning`-passthrough to avoid hard-failing legacy artifacts during rollout). Snap obvious typos (`positioningVoC`→`positioningVoiceOfCustomer`).
- [ ] **Step 2:** Update `PaidMediaPlanBody = z.infer<typeof paidMediaPlanBodySchema>` consumers; fix resulting TS errors in renderer prop type + registry.
- [ ] **Step 3:** Update `section-registry.ts` paid-media entry: `bodySchema`, `sectionOutputSchema`, `validateMinimums`, and the `fixtureArtifact` (regenerate the fixture to the lean shape from a v3 proof output). Update the `satisfies` type block (`section-registry.ts:358-392`).
- [ ] **Step 4:** Update tests that pin strict behavior: `answer-tool.test.ts:64` (`safeParse({unexpected:true}).success` flips `false→true` for the body — adjust assertion to target a REQUIRED-field-missing case instead), and `run-section-artifact-streaming.test.ts`. **Per learned-patterns:** include `section-registry.test.ts` in the targeted run (it pins `allowedTools` order-sensitively).
- [ ] **Step 5:** `npx tsc --noEmit` clean; `npm run test:run -- src/lib/lab-engine/sections/__tests__/section-registry.test.ts` green.
- [ ] **Step 6: Commit.** `git commit -am "feat(paid-media): sourceSection snap + lean fixture + type/test updates"`

**W1 gate:** `npx tsc --noEmit` clean · `npm run test:run` green · `npm run build` ok.

---

## W2 — Lean call wiring (model + commit gate)

**Why:** Production routes paid-media to `deepseek-v4-pro` (`getGenerationModel` `run-section.ts:1935-1944`); the proven fast path is `flash` + thinking disabled (48–55s). Add the `finishReason==='stop'` commit gate so a truncated tail never commits.

### Task 2.1: Route paid-media to flash + disable thinking

**Files:** `src/lib/lab-engine/agents/run-section.ts:1935-1944` (`getGenerationModel`), the structured-call provider options, `src/lib/lab-engine/ai/models.ts`
- Test: `src/lib/lab-engine/agents/__tests__/` (model routing)

- [ ] **Step 1: Write the failing test** asserting paid-media resolves to the section/flash model, not strategy/pro:

```ts
it('routes positioningPaidMediaPlan generation to the flash section model', () => {
  const model = getGenerationModel(SECTION_REGISTRY.positioningPaidMediaPlan);
  expect(modelIdOf(model)).toBe('deepseek-v4-flash');
});
```

- [ ] **Step 2: Run — verify it fails** (currently returns `deepseek-v4-pro`).
- [ ] **Step 3:** In `getGenerationModel`, remove `positioningPaidMediaPlan` from the strategy-model branch (it routed to `strategyModel`/pro). After the capstone deletion in W3, the strategy-model branch may only contain dead entries — leave the function returning `sectionRunnerModel` (flash) for paid-media. Add `providerOptions: { deepseek: { thinking: { type: 'disabled' } } }` to the paid-media structured `generateText` call (it is NOT inherited from `models.ts`; port the pattern from `strategic-critic.ts`'s `DEEPSEEK_STRATEGIC_CRITIC_PROVIDER_OPTIONS` before that file is deleted in W3, or inline the literal).
- [ ] **Step 4: Run — verify it passes.**
- [ ] **Step 5: Commit.** `git commit -am "feat(paid-media): single deepseek-v4-flash call, thinking disabled"`

### Task 2.2: finishReason commit gate

**Files:** `run-section.ts` (paid-media commit path)
- Test: same dir

- [ ] **Step 1: Write the failing test** — a `finishReason: 'length'` result must NOT commit:

```ts
it('does not commit a paid-media artifact when finishReason is length', async () => {
  const res = await runSectionWithStubbedModel({ finishReason: 'length', output: validLeanBody });
  expect(res.committed).toBe(false);
  expect(res.reason).toMatch(/truncat|length/i);
});
```

- [ ] **Step 2: Run — verify it fails.**
- [ ] **Step 3:** Add `commitOk = parseOk && finishReason === 'stop'` to the paid-media commit decision (port the proof gate `zz-prove-lean-media-plan-v3.ts:444-456`). On `length`, retry once with `maxOutputTokens` bumped (16384→20480); if still `length`, fail the section (do not commit a truncated deck).
- [ ] **Step 4: Run — verify it passes.**
- [ ] **Step 5: Commit.** `git commit -am "feat(paid-media): finishReason=stop commit gate (no truncated deck)"`

**W2 gate:** tsc clean · paid-media targeted tests green.

---

## W3 — Fold + delete capstones (thinker + synthesis + strategic-critic) and dispatch paid-media off the 6/6 rollup

**Why (locked fork #1):** Pure lean — paid-media folds cross-section reasoning inline and dispatches directly off the 6/6 rollup. The thinker (`positioningCrossSectionReasoning`), synthesis (`positioningSynthesis`), and `strategic-critic.ts` are deleted. **Widest blast radius — follow the kill-list discipline (learned-patterns): every deleted module must also have its imports, registry entries, type-union members, fixtures, tests, and client state removed in the same change.**

### Task 3.1: Re-point the route DAG — paid-media off the rollup, no thinker/synthesis dispatch

**Files:** `src/app/api/research-v2/run-lab-section/route.ts`
- Test: `src/app/api/research-v2/run-lab-section/__tests__/route.test.ts`

- [ ] **Step 1: Read** `route.ts:315-520` (`hasCompleteSixSectionRollup`, `dispatchCrossSectionReasoningIfSixComplete`, `dispatchSynthesisAndPaidMediaAfterThinker`, the server thinker branch ~L396 and client thinker branch ~L686), and `:127-232` (`buildCommittedArtifactsResearchInput`), `:629` (`includeCrossSectionReasoningArtifact`).

- [ ] **Step 2: Write the failing test** — at 6/6 complete, paid-media dispatches and the thinker/synthesis do NOT:

```ts
it('dispatches paid-media directly when six sections complete (no thinker/synthesis)', async () => {
  const dispatched = await onSixthSectionComplete(stubCtx({ rollupComplete: true }));
  expect(dispatched).toContain('positioningPaidMediaPlan');
  expect(dispatched).not.toContain('positioningCrossSectionReasoning');
  expect(dispatched).not.toContain('positioningSynthesis');
});
```

- [ ] **Step 3:** Rename/repurpose `dispatchCrossSectionReasoningIfSixComplete` → `dispatchPaidMediaIfSixComplete`: on `hasCompleteSixSectionRollup`, `scheduleLabSectionJob` for `PAID_MEDIA_PLAN_SECTION_ID` only (via `getDispatchZones` so `counts_toward_rollup` stays false). DELETE `dispatchSynthesisAndPaidMediaAfterThinker`, the thinker server branch (~L396), and the client thinker branch's fan-out hook (~L686). In `buildCommittedArtifactsResearchInput`, set `includeCrossSectionReasoningArtifact = false` for paid-media and remove the `cross_section_reasoning_not_ready` 409 path (`:196-210`). Remove `positioningCrossSectionReasoning` + `positioningSynthesis` from the route's `POST` body `section_id` enum and from `requiresCommittedPositioningArtifacts`.

- [ ] **Step 4: Run — verify it passes.** `npm run test:run -- src/app/api/research-v2/run-lab-section/__tests__/route.test.ts`
- [ ] **Step 5: Commit.** `git commit -am "feat(route): paid-media dispatches off 6/6 rollup; thinker+synthesis dispatch removed"`

### Task 3.2: Delete `strategic-critic.ts` and its call sites

**Files:** DELETE `src/lib/lab-engine/agents/strategic-critic.ts` + `src/lib/lab-engine/agents/__tests__/strategic-critic.test.ts`; Modify `run-section.ts` (`applyStrategicCriticIfNeeded` ~L1182, call site ~L8976)

- [ ] **Step 1:** Remove `applyStrategicCriticIfNeeded` and its call in `run-section.ts`; remove the `strategic-critic` import. Remove `DEEPSEEK_STRATEGIC_CRITIC_PROVIDER_OPTIONS` references (the `thinking:disabled` literal is already inlined in W2.1).
- [ ] **Step 2:** `grep -rn "strategic-critic\|applyStrategicCritic\|applyCrossSectionStrategicCritic" src/` → expect ZERO hits. Delete the file + its test.
- [ ] **Step 3:** `npx tsc --noEmit` → fix orphaned imports.
- [ ] **Step 4: Commit.** `git commit -am "chore: delete strategic-critic (thinker-only, capstone removed)"`

### Task 3.3: Remove thinker + synthesis from the registry, section IDs, and skills

**Files:** `src/lib/lab-engine/sections/section-registry.ts` (synthesis + cross-section-reasoning entries), `src/lib/lab-engine/skills/positioning-skills/index.ts` (`ALL_POSITIONING_SECTION_IDS`), the synthesis + cross-section-reasoning schema files + fixtures + skill folders
- Test: `section-registry.test.ts`

> **⚠️ Over-delete guard (exact delete targets — do NOT touch any other `synthesis` file):** DELETE only these. `src/lib/media-plan/synthesis.ts`, `src/lib/lab-engine/agents/voice-of-customer-synthesis.ts`, and `src/lib/journey/schemas/strategic-synthesis.ts` are UNRELATED (VoC + other features) and MUST SURVIVE.
> - Schemas: `src/lib/lab-engine/artifacts/schemas/positioning-synthesis.ts` + `cross-section-reasoning.ts` (+ their `__tests__/positioning-synthesis.test.ts` + `cross-section-reasoning.test.ts`)
> - Fixtures: `src/lib/lab-engine/fixtures/positioning-synthesis-artifact.ts` + `cross-section-reasoning-artifact.ts`
> - Skill folders: `src/lib/lab-engine/skills/positioning-synthesis/` + `positioning-cross-section-reasoning/`

- [ ] **Step 1:** Remove the `positioningSynthesis` and `positioningCrossSectionReasoning` `SECTION_REGISTRY` entries + their `bodySchema`/`sectionOutputSchema`/`fixtureArtifact` imports. Remove their IDs from `ALL_POSITIONING_SECTION_IDS` (now = 6 + `positioningPaidMediaPlan`). Delete the exact files listed in the over-delete guard above.
- [ ] **Step 2:** Update `section-registry.test.ts` (parity + allowedTools contract tests) to the reduced section set — **order-sensitive**, per learned-patterns.
- [ ] **Step 3:** `grep -rn "positioningSynthesis\|positioningCrossSectionReasoning\|CROSS_SECTION_REASONING\|POSITIONING_SYNTHESIS" src/` → resolve each (keep only the W1.4 `snapSourceSection` passthrough mapping if retained).
- [ ] **Step 4:** `npx tsc --noEmit` clean; `npm run test:run -- src/lib/lab-engine/sections/__tests__/section-registry.test.ts` green.
- [ ] **Step 5: Commit.** `git commit -am "chore: remove cross-section-reasoning + synthesis sections from registry/skills"`

### Task 3.4: Client state machine cleanup

**Files:** `src/lib/research-v2/use-audit-state.ts` (`:80-115`, `:169-245`, `:280-360` — line refs approximate, read first), the Audit Reader card components
- Test: `src/lib/research-v2/__tests__/use-audit-state.test.tsx`

- [ ] **Step 1:** Remove `dispatchCrossSectionReasoning` (`:185`), `dispatchPositioningSynthesis` (`:227`), their retry/terminal handling, and any "waiting for thinker/synthesis" UI state. Keep `dispatchPaidMediaPlan` (`:169`) but trigger it off the 6/6 complete state (server already dispatches it; the client retry-on-error path stays).
- [ ] **Step 2:** `grep -rn "CrossSectionReasoning\|PositioningSynthesis\|positioningSynthesis" src/lib/journey src/components` → resolve.
- [ ] **Step 3:** tsc clean.
- [ ] **Step 4: Commit.** `git commit -am "feat(audit-state): remove thinker/synthesis client dispatch; paid-media off 6/6"`

### Task 3.5: Renderer + card-taxonomy cleanup for deleted sections

**Files:** `src/lib/workspace/card-taxonomy.ts`, renderers `src/components/research-v2/section-renderers/positioning-synthesis.tsx` + `cross-section-reasoning.tsx` (+ `__tests__/positioning-synthesis.test.tsx` + `cross-section-reasoning.test.tsx`), any renderer registry/index

- [ ] **Step 1:** Remove the `positioningSynthesis` + `positioningCrossSectionReasoning` card-taxonomy entries and their renderer registrations; delete the two renderer files + their two test files listed above.
- [ ] **Step 2:** `grep -rn "synthesis\|crossSectionReasoning" src/lib/workspace/card-taxonomy.ts src/components/research-v2/section-renderers` → resolve.
- [ ] **Step 3:** tsc clean; `npm run build` ok.
- [ ] **Step 4: Commit.** `git commit -am "chore(ui): remove synthesis + cross-section-reasoning cards"`

### Task 3.6: DB dispatch-zone sanity (no migration expected)

**Files:** verify only — `seed_orchestration` RPC + `getDispatchZones` (`route.ts:74-87`)

- [ ] **Step 1:** Confirm `getDispatchZones('positioningPaidMediaPlan')` returns `['positioningPaidMediaPlan']` (single zone) so `seed_orchestration` keeps `counts_toward_rollup=false` for it. No schema migration needed (migration `20260608` already excludes capstones). **Do NOT** re-flag capstones into the rollup.
- [ ] **Step 2:** If any removed-section reference exists in a seed path, confirm removal doesn't change the 6-section rollup count. Note in commit if a follow-up migration is needed (expected: none).

**W3 gate:** `npx tsc --noEmit` clean · `npm run test:run` green · `npm run build` ok · `grep` sweeps for the deleted symbols return zero stray hits.

---

## W4 — Verifier productionization + split-gate wire

**Why:** `scripts/zz-claim-source-verifier.ts` is a throwaway that reads from disk + Supabase, with the 3 false-alarm guards inline in `verifyPlan` and `PlanSummary` unexported. Extract a reusable core, extend claim coverage to the blind fields, and wire the split gate at paid-media commit.

### Task 4.1: Extract the verifier core into `src/lib`

**Files:**
- Create: `src/lib/lab-engine/agents/verification/claim-source-verifier.ts`
- Reference: `scripts/zz-claim-source-verifier.ts` (full)
- Test: `src/lib/lab-engine/agents/verification/__tests__/claim-source-verifier.test.ts`

- [ ] **Step 1:** Port `extractClaims`, `deterministicPass`, `judgePass`, the 3 post-judge guards (currently inline `verifyPlan:991-1048`), and the `PlanSummary` builder into the new module. Export a single entrypoint:

```ts
export interface VerifyResult {
  verdicts: Verdict[];
  summary: { totalClaims: number; deterministicFlags: number; judgeFlags: number; verifierErrors: number };
  hardFail: boolean;     // deterministicFlags > 0 || verifierErrors > 0
  needsReview: boolean;  // judgeFlags > 0 && !hardFail
}
export async function verifyPaidMediaPlan(
  planBody: PaidMediaPlanBody,
  sections: Record<CanonicalZone, string>,
): Promise<VerifyResult>;
```

  It must take an **in-memory** plan body + pre-fetched sections (NOT disk/Supabase). The judge model must respect `LAB_ENGINE_PROVIDER` routing (use the lab-engine model factory, not a raw `createDeepSeek`). Keep the hardened judge settings: chunked batches (size 8 / retry 4), `temperature: 0`, retry-once-smaller-with-more-tokens, **fail-loud `VERIFIER_ERROR`** on non-`stop` finish.

- [ ] **Step 2: Write tests** porting the labeled fixtures (`tmp/verifier-testset.json`) into a vitest fixture, asserting: deterministic flags are 100% stable; UNVERIFIED grounding → PASS; a fabricated quote → `FABRICATED_QUOTE` hardFail; a sibling-section mis-cite → SOFT `MIS_ATTRIBUTION` (needsReview, not hardFail).

```ts
it('hard-fails a fabricated quote', async () => {
  const r = await verifyPaidMediaPlan(planWithInventedReviewQuote, sections);
  expect(r.hardFail).toBe(true);
});
it('soft-flags a sibling-section misattribution (needs_review, not hard-fail)', async () => {
  const r = await verifyPaidMediaPlan(planWithSiblingMiscite, sections);
  expect(r.hardFail).toBe(false);
  expect(r.needsReview).toBe(true);
});
it('passes an honest UNVERIFIED hedge', async () => {
  const r = await verifyPaidMediaPlan(planWithUnverifiedHook, sections);
  expect(r.summary.deterministicFlags).toBe(0);
});
```

- [ ] **Step 3:** Reconcile `CANONICAL_ZONES`: now the 6 positioning zones (cross-section folded inline → no `positioningCrossSectionReasoning` source). `gtmBrief`-grounded claims are EXCLUDED from extraction (not flagged INVALID_ENUM) — mirror the schema's `countNonGtmGrounded` exclusion.
- [ ] **Step 4: Run tests — green.** Requires `DEEPSEEK_API_KEY` for the judge tests (gate them behind a key check; deterministic-layer tests run without a key).
- [ ] **Step 5: Commit.** `git commit -am "feat(verifier): extract claim-source verifier core into src/lib (in-memory, split-gate)"`

### Task 4.2: Extend `extractClaims` to the blind fields

**Files:** `src/lib/lab-engine/agents/verification/claim-source-verifier.ts`
- Test: same dir

- [ ] **Step 1: Write failing tests** — claims must be extracted from the currently-blind fields:

```ts
it('extracts crossSectionInsight depth fields (contrarianInversion/clientBlindSpot/secondOrderRisk)', () => {
  const claims = extractClaims(planWithDepthFields);
  expect(claims.some(c => c.kind === 'crossSectionInsight.contrarianInversion')).toBe(true);
});
it('extracts campaignOverview prose and channelSuggestions and audienceTypes[].detail', () => {
  const kinds = new Set(extractClaims(fullPlan).map(c => c.kind));
  expect(kinds).toEqual(expect.arrayContaining(['campaignOverview', 'channelSuggestions', 'audienceTypes.detail']));
});
```

- [ ] **Step 2: Run — verify it fails** (these read OUT_OF_SCOPE today).
- [ ] **Step 3:** Extend `extractClaims` to map: `crossSectionInsight[].{contrarianInversion, clientBlindSpot, secondOrderRisk}` (each a claim with the row's `sourceSections` as grounding), `campaignOverview` numeric/prose claims (budget figures already validated by provenance, but mechanism claims should be judged), `channelSuggestions[].recommendation`, and `audienceTypes[].detail` with its new `grounding`/`sourceSection` (the locked gate-it decision). Each new field needs a `{text, grounding, sourceSection, kind}` mapping.
- [ ] **Step 4: Run — verify it passes.**
- [ ] **Step 5: Commit.** `git commit -am "feat(verifier): extend extractClaims to depth fields + campaignOverview + channelSuggestions + audienceTypes.detail"`

### Task 4.3: Wire the split gate at paid-media commit

**Files:** `src/lib/lab-engine/agents/run-section.ts` (paid-media post-generation/commit path)
- Test: `run-section` paid-media tests

- [ ] **Step 1: Write the failing test** — a deterministic flag hard-fails (repair/re-run), a judge flag sets `needs_review`:

```ts
it('hard-fails paid-media commit on a deterministic verifier flag', async () => {
  const res = await runPaidMediaWithStubVerifier({ hardFail: true });
  expect(res.committed).toBe(false);
});
it('commits with needs_review when only judge flags fire', async () => {
  const res = await runPaidMediaWithStubVerifier({ needsReview: true });
  expect(res.committed).toBe(true);
  expect(res.artifact.needs_review).toBe(true);
});
```

- [ ] **Step 2: Run — verify it fails.**
- [ ] **Step 3:** After generation + normalize, fetch the 6 committed section markdowns (already in-memory via `committedPositioningArtifacts` from the route's `researchInput`, or re-fetch) and call `verifyPaidMediaPlan(body, sections)`. If `hardFail` → trigger ONE repair re-run; if it still hard-fails → fail the section honestly (do not commit a deterministically-fabricated deck). If `needsReview` → commit and set `artifact.needs_review = true` + attach `artifact.verifierSummary`. Wrap in try/catch: a THROWN verifier is itself a fail-closed condition (do not silently pass). This call adds ~4 sequential judge API calls — confirm `maxDuration=300` headroom (the W2 flash call is ~50s, leaving budget).
- [ ] **Step 4: Run — verify it passes.**
- [ ] **Step 5: Commit.** `git commit -am "feat(paid-media): split-gate verifier at commit (hard-fail deterministic / needs_review judge)"`

### Task 4.4: Persist `needs_review` + summary on the artifact

**Files:** `src/lib/lab-engine/artifacts/artifact-envelope.ts` (add optional `needs_review: z.boolean().optional()` + `verifierSummary` to the envelope), supabase-run-store persistence

- [ ] **Step 1:** Add `needs_review?: boolean` and `verifierSummary?: {...}` to the artifact envelope schema (optional, backward-compatible). Ensure the run store persists them.
- [ ] **Step 2:** Test round-trip persistence.
- [ ] **Step 3: Commit.** `git commit -am "feat(artifact): persist needs_review + verifier summary on envelope"`

**W4 gate:** tsc clean · verifier + paid-media tests green (judge tests skipped if no `DEEPSEEK_API_KEY` locally).

---

## W5 — Renderer: 13 slides + section-level needs_review badge

**Files:** `src/components/research-v2/section-renderers/paid-media-plan.tsx`, `PAID_MEDIA_BODY_KEYS` (`:23-39`), ui-kit
- Test: `paid-media-plan.tsx` render test

- [ ] **Step 1:** Update `PAID_MEDIA_BODY_KEYS` + the `satisfies ReadonlyArray<keyof PaidMediaPlanArtifact['body']>` to the new 12 rendered keys (`campaignOverview, campaignPhases, audienceTypes, anglesToTest, creativeStrategy, creativeFramework, funnelIdeation, salesProcess, competitorMarketingInsights, competitorReviewInsights, channelSuggestions, kpis`). REMOVE the `strategicThesis`/`contradictionReconciliation`/`orderedMoves` subsections (`:367/:392/:515`) and their column defs.
- [ ] **Step 2:** Add the lean-only surfaces: `anglesToTest` (Slide 5, 4 cards with `angleType`/`grounding`), `executesAngle` + `hook` on `creativeFramework` slots, and a `crossSectionInsight` driver block (internal-tension cards) — render it as a small "What drove this plan" strip (it's the folded driver).
- [ ] **Step 3: Write the failing test** for the badge + slide count:

```tsx
it('renders a needs_review badge when artifact.needs_review is true', () => {
  render(<PaidMediaPlanRenderer artifact={{ ...leanArtifact, needs_review: true }} />);
  expect(screen.getByTestId('paid-media-needs-review-badge')).toBeInTheDocument();
});
it('renders all 12 deliverable blocks', () => {
  render(<PaidMediaPlanRenderer artifact={leanArtifact} />);
  PAID_MEDIA_BODY_KEYS.forEach(k => expect(screen.getByTestId(`pmp-block-${k}`)).toBeInTheDocument());
});
```

- [ ] **Step 4:** Implement the amber section-level badge (use the existing `--amber`/"Needs Work" design token; add a `MonoBadge` amber variant or a `Callout`) driven by `artifact.needs_review`. Map the Slide-12 channel verdict 7-token vocabulary (`FIX/REWORK/REVIEW/KEEP/ADD/KILL/SCALE`) to badge colors (`KILL`→destructive, `KEEP/SCALE`→good, `FIX/REWORK/REVIEW`→amber, `ADD`→accent).
- [ ] **Step 5: Run — verify it passes;** `npm run build` ok.
- [ ] **Step 6: Commit.** `git commit -am "feat(ui): paid-media renderer 13-slide lean + section needs_review badge"`

**W5 gate:** tsc clean · render test green · build ok.

---

## W6 — Budget + platform plumbing (mostly verification)

**Files:** `src/lib/lab-engine/agents/build-prompts.ts` (`monthlyAdBudget` render ~`:329,426`), `src/lib/research-v2/corpus-to-research-input.ts:350`, the lean call prompt assembly, `scripts/zz-prove-lean-media-plan-v3.ts:376-384` (harness fix)

- [ ] **Step 1: Write a test** asserting the assembled paid-media prompt carries the real budget from `onboarding.economics.monthlyAdBudget` (not a hardcode):

```ts
it('injects onboarding.economics.monthlyAdBudget into the paid-media prompt', () => {
  const prompt = buildPaidMediaPrompt(researchInputWith({ monthlyAdBudget: '$12,500' }));
  expect(prompt).toContain('$12,500');
});
```

- [ ] **Step 2: Run — verify** (likely passes already; if it fails, wire `researchInput.onboarding.economics.monthlyAdBudget` into the prompt). Confirm the lean call receives `onboarding.channels` + `budgetSplit` and that `campaignOverview.platform` + `channelSuggestions` reflect declared channels (Meta-default — locked fork #2).
- [ ] **Step 3:** Fix the proof harness hardcode (`zz-prove-lean-media-plan-v3.ts:376-384`) to read from a `--run`'s onboarding (only needed if the harness is reused for W8; otherwise note it as throwaway).
- [ ] **Step 4: Commit.** `git commit -am "feat(paid-media): verified real monthlyAdBudget + channel-aware platform"`

---

## W7 — SKILL.md finalize

**Files:** `src/lib/lab-engine/skills/positioning-paid-media-plan/SKILL.md` (already modified in working tree)

- [ ] **Step 1:** Remove the top "WIRING GATE" warning block now that the schema/registry are migrated. Reconcile the Slide-12 verdict vocabulary (7 tokens) with the schema. Ensure the SKILL's output contract names the lean body keys exactly (no references to dropped `strategicThesis`/`orderedMoves`). Encode the sibling-section misattribution policy (soft `needs_review`) in the provenance rule (per VERIFIER-HARDENED §3).
- [ ] **Step 2:** Confirm `withGtmStrategicStandardPreamble` is still acceptable for the media-buying skill (it's applied unconditionally); if the strategic preamble's `strategicInsight` framing is wrong for a media plan, note it but do NOT introduce the non-existent `gtmMediaBuyingStandardPreamble` unless adding it as a real new file is in scope.
- [ ] **Step 3: Commit.** `git commit -am "docs(skill): finalize paid-media SKILL for lean wiring (remove WIRING GATE, reconcile verdict vocab)"`

---

## W8 — Live ~$2 Airtable E2E (THE GATE)

**Why:** Unit-green ≠ working. Airtable is the danger case — all its prior flags were judge-only semantic fabrications with a 0 deterministic floor (a truncated judge would report it CLEAN).

- [ ] **Step 1:** Run a full live audit for Airtable through `/research-v3` (DeepSeek + Brave keys present). Capture the run_id.
- [ ] **Step 2: Confirm the gate works:** (a) paid-media `finishReason=stop`, 0 `VERIFIER_ERROR`; (b) the wrong-company / wrong-vertical PST-1 copy is caught (deterministic hard-fail or judge `needs_review` badge), NOT shipped clean; (c) the "VoC quotes" that actually live in OfferDiagnostic surface as `PROVENANCE_INFLATION`/`MIS_ATTRIBUTION` → `needs_review`, NOT silent. (d) the deck renders all 13 slides with the real `monthlyAdBudget` and channel-aware platform.
- [ ] **Step 3:** Confirm paid-media dispatched off the 6/6 rollup with NO thinker/synthesis cards in the audit, and the parent rollup stayed 6/6 (capstone not counted).
- [ ] **Step 4:** If all green → Stage B done. Save a sign-off doc to `docs/handoffs/2026-06-09-lean-media-plan-stage-b-e2e-signoff.md` and update memory.

---

## Self-review notes
- **Spec coverage:** W1=schema(step1), W2=lean-call(step4)+model, W3=capstone-rip(step4)+budget-decouple, W4=verifier-split-gate(step2)+blind-field-extend, W5=renderer-13-slides+badge(step3), W6=real-budget(step5), W8=live-gate(step6). All six handoff steps + the 4 forks covered.
- **Ordering correctness:** W1 precedes W2/W4/W5 (verifier needs the lean shape; renderer needs new keys). W3 is independent but must precede W8. This corrects the handoff's implied independence of step-1 and step-2.
- **Kill-list discipline (learned-patterns):** W3 tasks each include the grep-sweep + test + registry/type-union/fixture/import cleanup, not just file deletion.
- **Regression-safety:** counts are tolerant-normalized (not hard `.length()`), and the generation path drops the strict-reparse→repair loop — directly addressing the 285s root cause.
- **Open risk to watch in W8:** folding the thinker's forcing fields into one call raises truncation risk — the W2.2 `finishReason` gate + the 16384→20480 retry is the mitigation; live-probe before trusting.
