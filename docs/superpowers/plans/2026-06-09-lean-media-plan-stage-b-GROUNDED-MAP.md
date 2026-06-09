# Lean Media Plan — Stage B GROUNDED Execution Map (recon-corrected)

> Supersedes the edit-site lists in `2026-06-09-lean-media-plan-stage-b-wiring.md`. The vision/forks in the original plan stand; this corrects scope, line numbers, and ORDER against a 7-agent read-only recon of current code (2026-06-09). Exhaustive line-level backing lives in the recon transcript; this is the actionable map.
>
> Baseline: branch `feat/research-quality-truthgate` @ `ecdcf89e` (clean). tsc baseline = **1 known error** (`scripts/zz-claim-source-verifier.ts:822` TS2352, throwaway — W4's port eliminates it). Per-WS gate: `npx tsc --noEmit` shows ≤ that 1 error · targeted vitest green · at boundaries `npm run test:run` + `npm run build`. **W8 live E2E is THE gate.**

## Execution order (CORRECTED): W3 → W2 → W1 → W4 → W5 → W6 → W7 → W8

Why not the plan's W1→W3: W3's deletion removes `strategic-rubric.ts:310` (W1's worst typed compile break) and strips synthesis/thinker schemas + normalizers + prompt-blocks out of the shared mega-files (`run-section.ts`, `build-prompts.ts`, `section-registry.ts`) BEFORE W1 rewrites the paid-media parts of those same files. W3-first = the scariest change lands on a clean tree with fewer moving parts; W1 then migrates paid-media with no capstone cruft in the way.

Shared mega-files & who touches them (the reason writes are serial):
- `run-section.ts` (9064 ln): W3 (capstone machinery), W2 (model+gate), W1 (paid-media normalizer), W4 (split-gate wire)
- `build-prompts.ts`: W3 (synthesis/thinker blocks), W1 (paid-media block + required-keys + verdict)
- `section-registry.ts`: W3 (2 capstone entries), W1 (paid-media entry/schema/fixture)
- `paid-media-plan.ts`: W1 (everything), W3 leaves it alone (W1 owns the sourceSection enum decision)

---

## W3 — Rip the capstone subsystem; paid-media dispatches off 6/6 (FIRST, biggest)

**Decisions:** pure-lean delete (thinker + synthesis + strategic-critic). DELETE `strategic-rubric.ts` + strategy-quality-gate entirely (vestigial). No new DB migration — verify live DB instead.

### W3.1 — Pure deletes (files + tests + fixtures + skill folders)
DELETE (all confirmed to exist):
- `src/lib/lab-engine/artifacts/schemas/positioning-synthesis.ts` (317) + `cross-section-reasoning.ts` (223) + their `__tests__/*.test.ts`
- `src/lib/lab-engine/fixtures/positioning-synthesis-artifact.ts` (189) + `cross-section-reasoning-artifact.ts` (110)
- `src/lib/lab-engine/skills/positioning-synthesis/` + `positioning-cross-section-reasoning/` (SKILL.md folders)
- `src/components/research-v2/section-renderers/positioning-synthesis.tsx` (245) + `cross-section-reasoning.tsx` (146) + their `__tests__/*.test.tsx`
- `src/lib/lab-engine/agents/strategic-critic.ts` (634) + `__tests__/strategic-critic.test.ts` + `run-section-strategic-critic.test.ts` + `run-section-strategic-critic-nonfatal.test.ts`
- `src/lib/lab-engine/artifacts/strategic-rubric.ts` + `__tests__/strategic-rubric.test.ts`

**SURVIVORS — MUST NOT TOUCH:** `src/lib/media-plan/synthesis.ts`, `src/lib/lab-engine/agents/voice-of-customer-synthesis.ts`, `src/lib/journey/schemas/strategic-synthesis.ts` (recon confirmed zero refs to delete-targets).
**Do NOT delete** the shared `orderedMoves` in `offer-diagnostic.tsx:208/221` + `demand-intent.tsx:231/235` (different per-section shapes).

### W3.2 — run-section.ts capstone removal
- DELETE `applyStrategicCriticIfNeeded` (1167-1276) + its call (8976) + `strategic-critic` import (103-104, 14).
- DELETE `positioningSynthesisGenerationSchema` (1865-1873) + `crossSectionReasoningGenerationSchema` (1875-1884) + their branches in `getStructuredGenerationSchema` (1920/1924) + `withNormalizedPositioningSynthesisOutput` (4133).
- `getGenerationModel` (1939-1944): drop `positioningSynthesis` + `positioningCrossSectionReasoning` from the strategyModel array. **KEEP `positioningPaidMediaPlan` on strategyModel for now (W2 flips it).**
- `capstoneSourceSectionAllowList` (2630): drop `positioningCrossSectionReasoning`.

### W3.3 — Registry / types / reader / events (KEEP-file edits)
- `section-registry.ts`: remove both capstone defs (synthesis 283-307, thinker 308-330) + their schema/fixture/validateMinimums imports (21-26, 57-62, 73, 78, 24, 60) + both `satisfies`-map entries (380-387). `section-registry.test.ts` parity/allowedTools pins — update **order-sensitively**.
- `src/lib/ai/prompts/positioning-skills/index.ts` (NOTE: path is `ai/prompts`, not `lab-engine/skills`): `ALL_POSITIONING_SECTION_IDS` (46) shrinks 9→7. Auto-propagates to route enum, activity-event sectionIds, orchestrate-db zone set, profile-verification-summary (all tolerate; verify).
- `src/types/positioning-artifact.ts:59-60`: drop the two artifact keys from `TYPED_ARTIFACT_KEYS`.
- `src/components/research-v3/reader-sections.ts`: 9→7 ids; `reader-sections.test.ts` pins `.at(-3)`/`.at(-2)` positions — update.
- `src/components/research-v2/audit-reader-shell.tsx`: remove 'Thinker'/'Synthesis' labels (108/109) + crossSectionReasoningComplete tab-gating (430/435/1073-1098); paid-media tab re-gates on six-complete.
- `src/components/research-v2/typed-artifact-renderer.tsx`: delete the two switch arms (471/473).
- `src/lib/lab-engine/events/activity-event.ts`: remove `strategic-critic-started`/`finished` variants (15/16/150/162) + `cross_section_reasoning` target literals (154/166); `activity-event.test.ts:92-118` pins — update.
- `src/lib/lab-engine/sections/sub-sections.ts`: remove synthesis (152) + thinker (164) entries.
- `src/lib/lab-engine/artifacts/artifact-envelope.ts`: drop `strategicCritiqueSchema` (265-275) + `researchInputSchema.crossSectionReasoningArtifact` (302).

### W3.4 — Dispatch repoint (route + CLIENT + rerun, autonomy-safe)
- `run-lab-section/route.ts`: repurpose the 6/6 path — `dispatchCrossSectionReasoningIfSixComplete` (342-419) → **dispatch `PAID_MEDIA_PLAN_SECTION_ID` only** off `hasCompleteSixSectionRollup`, via `getDispatchZones` (single zone, counts_toward_rollup stays false). DELETE `dispatchSynthesisAndPaidMediaAfterThinker` (426-519), the server thinker branch + its onJobComplete (384-417), the client thinker branch (672-718). **Re-home the Jun-8 autonomy fan-out: the paid-media dispatch MUST fire from the SERVER core-section `onJobComplete` hook (651) so it survives tab close.** `claimSectionRun` CAS keeps client+server double-trigger safe. Set `includeCrossSectionReasoningArtifact=false` for paid-media; remove the `cross_section_reasoning_not_ready` 409 (196-210). Drop thinker/synthesis from `requiresCommittedPositioningArtifacts` (64-72).
- `src/lib/research-v2/use-audit-state.ts`: the CLIENT independently fires thinker (313)→synthesis (374)+paid-media (347). Remove `dispatchCrossSectionReasoning` (186-204) + `dispatchPositioningSynthesis` (227-241); re-gate `dispatchPaidMediaPlan` on six-complete; drop the dispatchedCrossSectionReasoning/Synthesis run-id + retry state (273-290). `use-audit-state.test.tsx` updates.
- `src/app/api/research-v2/rerun-section/route.ts`: mirror — remove thinker/synthesis include branch + 409 (226-234), keep paid-media path consistent.
- `src/lib/research-v2/supabase-run-store.ts`: `isCapstoneSection` (1009) → paid-media only. `mergeSynthesizedThesisBestEffort` (1069) wrote `positioning_strategy` from the SYNTHESIS artifact — **re-source from paid-media's `crossSectionInsight`/campaignOverview, or drop the field** (decide in W3.4; same for `orchestrate-db.ts:160`). `section-profile-persistence.ts:173` synthesis→positioningStrategy branch updates.

### W3.5 — strategy-quality-gate removal
- `src/lib/research-v3/live-quality-gate.ts`: remove `buildRubricScore` (1021-1043), `buildStrategyQualityGate` (1457-1463), `scoreStrategicRubricArtifacts` call + strategicZones (1461-1463) + the synthesis tier check (1080-1090) + the doomed-artifact type imports. KEEP the rest of the file. `live-quality-gate.test.ts` + `research-quality-gate-report.test.ts` + `soak-monitor.test.ts` update.

### W3.6 — DB verify (read-only, no migration)
- Via Supabase MCP, confirm the live `seed_orchestration` flags exactly the 6 positioning zones `counts_toward_rollup=true` (migrations 20260603/04/08 already exclude synthesis+thinker+paid-media). If a positioning zone is wrongly excluded or a 7th is included, THEN a forward migration; expected: none.

**W3 gate:** tsc ≤ baseline · `npm run test:run` green · `npm run build` ok · grep sweeps for `strategic-critic|positioningSynthesis|positioningCrossSectionReasoning|strategic-rubric|dispatchSynthesisAndPaidMediaAfterThinker` return only intentional residue (the W1 snapSourceSection passthrough, if kept).

---

## W2 — Paid-media → flash + finishReason commit gate (SECOND, small)

- `run-section.ts` `getGenerationModel` (now only `positioningPaidMediaPlan` left in the strategy array after W3): remove it → falls to `sectionRunnerModel` (flash). NOTE this also moves the **evidence pass** (8764) to flash — intended (cheaper/faster), validate quality in W8.
- thinking:disabled is ALREADY applied (`section-agent.ts:575-581`) — no change needed.
- **Harden the existing finishReason gate** (`section-agent.ts:1260`, currently fires only on empty text): make `finishReason!=='stop'` terminal for paid-media so a truncated deck never commits — either add its message substring to `hasTerminalStructuredError` (367-373) OR throw a matching error; on `length`, retry once with `structuredOutputMaxTokens` bumped 16384→20480 (`section-registry.ts:349`), else fail the section. Do NOT duplicate the gate.
- Fix tests: `run-section-corpus-only.test.ts:1341/1536/1596` flip `expect(params.model).toBe(strategyModel)` → `sectionRunnerModel`.

**W2 gate:** tsc ≤ baseline · paid-media targeted tests green.

---

## W1 — Paid-media lean schema + tolerant normalizer + prompt rewrite (THIRD, large)

Reference shape: `scripts/zz-prove-lean-media-plan-v3.ts:52-305` (`leanMediaPlanV3Schema`) — PORT, don't redesign. v3 already has `grounding` on audienceTypes (plan said "add" — it's there).

### W1.1 — `paid-media-plan.ts` lean body
- Root `z.object()` **no `.strict()`** (kills the 30 `.strict()` regression sites at the body level). Drop `strategicThesis`/`contradictionReconciliation`/`orderedMoves`/`provesWrongIf` schemas (157-183, 344-354) + body keys.
- Free-string `sourceSection` (replace the 5 `z.enum(sourceSectionValues)` body usages), `angleType`, channel `verdict` (was 4-value lowercase enum → 7-token free string), `funnelType`.
- Keep `sourceSectionValues` exported as the **snap target**; add `snapSourceSection(value): string` (canonical 6 + `gtmBrief`; keep `positioningCrossSectionReasoning` accepted-and-passthrough for rollout safety; snap typos e.g. `positioningVoC`→`positioningVoiceOfCustomer`).
- Add `crossSectionInsight[]` (`{tension, sourceSections[], implicationForPlan, clientBlindSpot, secondOrderRisk, contrarianInversion}`).
- **Money:** provenance → free `z.string()` (drop the hard enum), keep `paidMediaMoneyProvenanceValues` exported as snap target. **Counts via tolerant normalizer, NOT `.length()`** (describe `'EXACTLY 8'`). **INVARIANT: nothing on the commit path throws→repairs except a genuinely missing REQUIRED field** — wrong counts/off-vocab/unknown-provenance/stray keys all normalize tolerantly and may set `needs_review`, never repair. The `rejectUnknownProvenanceNumericMoney` logic, if kept, runs as a soft/needs_review signal in the normalizer, not a throwing superRefine on the body root.
- DROP `import {validateProvesWrongIfMinimums, validateStrategicText}` (8-11). **DO NOT delete those functions — shared by 7 schemas.**

### W1.2 — Replace `validatePaidMediaPlanMinimums` (793-853) with tolerant `normalizePaidMediaPlanBody`
- Snap/pad/truncate fixed-count arrays (campaignPhases→2, audienceTypes→3, anglesToTest→4, creativeFramework→8, funnelIdeation→3, competitorReviewInsights→3, channelSuggestions→4, kpis→3; competitorMarketingInsights≥2). Padded slots get `grounding:'UNVERIFIED'` + neutral label. snap `sourceSection`/provenance/verdict. **Never throws.** DELETE `validateThesis` (705), `validateOrderedMoves` (745), the `synthesizedGroundingCount>=14` gate (845-852), orphaned `countNonGtmGrounded`/`validateSourceRefs` (unless reused by the soft signal-quality checks).

### W1.3 — run-section.ts paid-media normalizer rewrite
- `paidMediaPlanGenerationSchema` (1852) is already permissive `.passthrough()` — **no change**.
- Replace the paid-media branch of `withNormalizedPaidMediaPlanOutput` (3426-3920) with a call to the new `normalizePaidMediaPlanBody`. DELETE the now-dead paid-media helpers (2685-3424: `normalizePaidMediaOrderedMove`, `…CreativeRecord`, `…SpendMath`, `…MoneyProvenance`, `snapAngleTypesInMix` use, etc.) + orphaned exports (`creativeTypeValues`/`snapCreativeType`/`snapAngleTypesInMix`/`paidMediaMoneyProvenanceValues` snapping) where no longer used. The post-gen strict `.parse()` (5007) tolerates the lean shape (root no longer `.strict()`); ensure a refine/optional miss does NOT trigger repair (only missing REQUIRED does).

### W1.4 — build-prompts.ts paid-media prompt (folded from W6/W7)
- Rewrite the `PaidMediaPlanSectionOutput` prompt block (734-803) to describe the LEAN shape. DELETE the required-key instructions for strategicThesis/contradictionReconciliation/orderedMoves (738-742). Replace the verdict-vocab instruction (768: "keep/fix/cut/start") with the 7-token vocab (FIX/REWORK/REVIEW/KEEP/ADD/KILL/SCALE). Instruct `crossSectionInsight` + the 4-angle diversity mandate + grounding discipline.

### W1.5 — Fixture + type + downstream
- Rebuild `src/lib/lab-engine/fixtures/paid-media-plan-artifact.ts` to the lean shape (from a v3 proof output). Consumers: section-registry fixtureArtifact, render test, audit-reader-shell test, run-section-corpus-only.test.ts:19.
- Rewrite `schemas/__tests__/paid-media-plan.test.ts` (565 ln, OLD strict) to the lean shape + the regression tests (strips unknown keys, free-string sourceSection, no dropped keys, tolerant count snap).
- `section-registry.ts` paid-media entry: bodySchema/sectionOutputSchema/validateMinimums→normalizer/fixtureArtifact + the `satisfies` block.
- `answer-tool.test.ts:64` is NOT paid-media-coupled (own local schema) — leave.
- `live-quality-gate.ts` paid-media body path reads (920/1035) follow lean field names.

**W1 gate:** tsc ≤ baseline · `npm run test:run` green · `npm run build` ok.

---

## W4 — Verifier productionization + split-gate (FOURTH; needs W1)

- Extract `scripts/zz-claim-source-verifier.ts` → `src/lib/lab-engine/agents/verification/claim-source-verifier.ts`. **NAME COLLISION:** dir already exports `extractClaims` + `Claim` (different) → name new exports `extractPlanClaims` / `PlanClaim` (+ `verifyPaidMediaPlan`). Strip disk/Supabase (imports 31-37, `fetchSections` 100-135, readFileSync 977, CLI 1112-1397, auto-run guard). **PRESERVE the salvage→`recoverVerdictsFromText`→`VERIFIER_ERROR` fail-closed chain verbatim.** Fix the TS2352 (822: drop the cast).
- Entrypoint `verifyPaidMediaPlan(body, sections: Record<Zone,string>) => {verdicts, summary, hardFail, needsReview}`. `CANONICAL_ZONES` already = 6 (Step-3 reconcile is NO-OP). **ADD the gtmBrief exclusion** (skip `sourceSection==='gtmBrief'` before INVALID_ENUM — does NOT exist in verifier today; mirror `paid-media-plan.ts:424`).
- Judge: switch raw `createDeepSeek` (825) → lab-engine factory; no judge getter exists → add one or reuse `sectionRunnerModel` BUT re-apply `Output.object` + `temperature:0` + 180s timeout + chunk8/retry4 (tuned on flash). Respect `LAB_ENGINE_PROVIDER`.
- Extend `extractPlanClaims` to the blind fields: `crossSectionInsight.{contrarianInversion,clientBlindSpot,secondOrderRisk}`, `campaignOverview` (decide the claim `text`), `channelSuggestions[].recommendation`. (`audienceTypes.detail` is ALREADY extracted — lights up once W1 adds grounding.)
- Wire split gate at paid-media commit (run-section.ts, after normalize, sections from `committedPositioningArtifacts`): `hardFail`→one repair then fail; `needsReview`→commit + `needs_review=true` + `verifierSummary`. try/catch → thrown verifier is fail-closed. **maxDuration budget:** flash gen ~50s + ≤4 judge chunks (≤180s) + possible repair must fit 300s — cap judge chunk timeouts; confirm route `maxDuration=300`.
- `artifact-envelope.ts` (`.strict()` 341-359): add top-level `needs_review?: boolean` + `verifierSummary?` (NOT under body). supabase-run-store round-trips them. (`needs_review` boolean is DISTINCT from the existing `verificationTier` 'needs_review' enum.)
- Tests: port `tmp/verifier-testset.json` (47 entries) — **OFFLINE FIXTURE GAP: entries lack section markdown; also snapshot the 6-section text per run** (`tmp/zz-section-out/v3b-*.json` or Supabase) for judge tests. Deterministic-layer tests run keyless; judge tests gate behind `DEEPSEEK_API_KEY`.

**W4 gate:** tsc ≤ baseline · verifier + paid-media tests green (judge skipped if no key).

---

## W5 — Renderer: 12 content blocks (READABLE DOCUMENT) + needs_review badge (FIFTH; needs W1+W4)

> **RENDER SHAPE (operator-confirmed 2026-06-09):** the paid-media plan renders as the EXISTING readable card/document layout in the Audit Reader — **NOT a slide deck, NOT a carousel/paginated UI.** "13 slides" is the CONTENT spec of the client PPTX (12 rendered blocks + 1 internal driver); the schema carries that content, the UI stays a lean readable document. **No PPTX/deck export is in Stage B scope.**

- All 12 blocks ALREADY render. `PAID_MEDIA_BODY_KEYS` (23-39): drop the 3 doomed keys → 12. Remove the strategicThesis (367-389), contradictionReconciliation (392-408), orderedMoves (515-519) subsections + their column defs (thesisSourceColumns 305-318 only after BOTH removed; orderedMoveColumns 319-358).
- ADD: `crossSectionInsight` driver strip (6 rich fields — design a real strip, not a one-liner); surface `angleType`/`grounding` on anglesToTest + `executesAngle`/`hook` on creativeFramework (arrive with W1).
- **needs_review amber badge:** read `artifact.needs_review` (envelope; renderer gets `artifact as ... PaidMediaPlanArtifact` — read via loose cast like `getPaidMediaPlanBody`). Use ready-made `StatusPill` tone `'flagged'` (amber-600) — NOT a new var. test-id `paid-media-needs-review-badge`.
- Verdict color-map (285-288): 7 tokens → 5-tone vocab (KILL→`error`, KEEP/SCALE→`complete`, FIX/REWORK/REVIEW→`flagged`, ADD→`active`) inside the render fn.
- **HIDDEN COUPLINGS W5 must own:** `sub-sections.ts:171-191` (15-entry catalog → 12) drives the pill count; `audit-reader-shell.test.tsx:351` `toHaveLength(15)`→12; the existing `paid-media-plan.test.tsx` asserts the 3 dropped labels → rewrite; lean fixture (W1) is the `leanArtifact` the tests need. `pmp-block-${k}` test-ids need a per-block wrapper (SubsectionBlock hardcodes `data-testid='subsection'`).

**W5 gate:** tsc ≤ baseline · render test green · `npm run build` ok.

---

## W6 — Budget + platform verification (SIXTH; mostly confirmed by recon)

- Budget flow already correct (`corpus-to-research-input.ts:350` → `build-prompts.ts:426`); no prod hardcode (the only `9000` is a ms timeout). **`buildPaidMediaPrompt` does NOT exist** — write the test against the real chain (`buildStructuredPrompt`→`buildSectionScopedResearchInputForPrompt`→`buildOnboardingStrategicFrame`) with a paid-media definition + `monthlyAdBudget`.
- platform/channels reflection is PROMPT-ONLY (no code wiring); `onboarding.channels` = `onboarding.distributionChannels` in code. Deterministic platform-from-channels does NOT exist — it's model judgment. Verify in W8, not a unit test.

---

## W7 — SKILL.md finalize (SEVENTH; easy)

- Remove WIRING GATE block (13-29) + line-30 prompt-only caveat (removing it satisfies the "no dropped-key refs" contract — they only appear inside the gate). Reconcile Slide-12 verdict (211-222, remove the schema-gap parenthetical). Align sibling-misattribution = SOFT needs_review / count = HARD (438-462) with VERIFIER-HARDENED §3. Don't introduce `gtmMediaBuyingStandardPreamble` (doesn't exist; `withGtmStrategicStandardPreamble` is applied unconditionally).

---

## W8 — Live ~$2 Airtable E2E (THE GATE; user/cost-gated)

Run Airtable via `/research-v3` (needs DEEPSEEK + BRAVE keys). Confirm: paid-media `finishReason=stop`, 0 `VERIFIER_ERROR`; wrong-company PST-1 caught/badged not shipped clean; "VoC quotes" provenance lies → `needs_review`; 13 slides render with real budget + channel-aware platform; paid-media off 6/6 with NO thinker/synthesis cards, parent stays 6/6. Save signoff doc + update memory.
