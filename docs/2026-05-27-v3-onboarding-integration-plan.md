# V3 Onboarding Integration + Cleanup — Execution Plan

**Date:** 2026-05-27 · **Target:** `feat/v2-lab-section-wire` (work on a child branch, PR back).
**Status:** APPROVED-PENDING — revised after adversarial Codex review + GTM-questions reconciliation.
**Inputs:** `AIGOS Onboarding Flow (2).md` (canonical GTM questions); Codex adversarial review (2026-05-27); field-reconciliation (V2 = 43/43 vs canonical, rich wizard = 22/43).

## Goal

Make the **old/rich multi-step onboarding wizard the corpus-fed front door** of the v3 audit, asking **exactly the canonical GTM questions**, with **file/transcript upload at entry**, keeping the v3 backend (Perplexity corpus → DeepSeek fan-out → paid media plan), **removing ad-scripts**, and deleting duplication/bloat. Reader (`AuditReaderShell`) is untouched.

## Locked decisions
1. Backend unchanged: corpus → 6 DeepSeek positioning sections → paid media plan (7th).
2. **Onboarding = old wizard's LOOK + V2's DATA.** The rich wizard shell (`src/components/onboarding/onboarding-wizard.tsx` + steps) renders `OnboardingV2Data` (NOT its own `OnboardingFormData`, which covers only 22/43 canonical questions). V2's schema already matches the canonical doc 43/43.
3. Questions = exactly the canonical doc's 7 sections. Two de-dupes: **Target CAC asked once** (keep `targetCac`, drop `goalTargetCac`); **Avg LTV asked once** (keep `avgLtv`, drop `ltv`). Update all consumers of the dropped keys.
4. **GTM motion derived** from the §1 sales-motion answer — never asked separately.
5. **Media Plan Setup = separate step.** `salesProcessDocs`, `salesLoomUrl`, `creativeCapacity`, `leadListAvailable` collected in their own step (feed the paid media plan), kept out of the 7 GTM sections.
6. Uploads collected **at entry** → feed corpus AND the lab sections.
7. Remove ad-scripts entirely.
8. Keep the profile **Assets** tab (relocate `StyleRefsTab` out of `components/scripts`).
9. Retire `/onboarding/edit`; no separate account onboarding; no post-research re-edit flow for now.
10. `/research-v3` stays the entry route; final renaming deferred.
11. Leave `script_packs` DB table inert.

## Onboarding contract to preserve (Codex-verified — do NOT break)
- Wizard must accept flat `initialData: Partial<OnboardingV2Data>` + `initialPrefillMetadata: OnboardingPrefillMetadata`, build `OnboardingReviewMetadata` (AI-filled / User-edited / Missing / Needs-review badges), and emit `onComplete(OnboardingV2Data, OnboardingReviewMetadata)`.
- `POST /api/research-v2/onboarding` requires `reviewMetadata`; `orchestrate` + `orchestration-session.ts:getOnboardingReviewMetadata` freeze it as `researchV2OnboardingReview` / `gtmBriefReview`. Preserve that shape exactly or orchestrate 422s / freezes null.
- `/research-v3/page.tsx` seam: `WelcomeForm`→`startCorpus` (~229) → corpus dispatch `buildCorpusContext` (~39, ~272) → `CORPUS_COMPLETE`+prefill (~345) → wizard → `handleOnboardingComplete` (~394-444) → onboarding POST → `orchestrate` `{run_id, executionMode:'lab'}` (~434).

---

## Phase 0 — Foundation (HQ / Claude)
- Child branch + worktree off `feat/v2-lab-section-wire`.
- Capture clean baselines SEPARATELY: root `npx tsc --noEmit` + `npm run test:run`, and `cd research-worker && npm run build` (worker has its own baseline — root tsconfig excludes it; Codex claim 8 confirmed).
- Write ADR-0008 (single corpus-fed onboarding: old-UI look + V2 data + canonical GTM questions) and ADR-0009 (ad-scripts removed; Audit = 6 sections + media plan). Update `CONTEXT.md` glossary (Corpus, GTM Brief, Onboarding, Media Plan Setup).

## Phase 1 — Ad-scripts removal (Codex → Claude QA)
Delete whole units: `research-worker/src/scripts/` (pipeline, stages, refs, __tests__); `src/app/api/scripts/`, `src/app/api/profiles/[id]/script-packs/`, `src/components/scripts/`, `src/components/workspace/scripts-phase.tsx`, `src/lib/scripts/`.
Surgical edits: `research-worker/src/index.ts` (drop `runScriptPipeline` import ~L26, `writeScriptPackUpdate` from supabase import ~L18, `/api/scripts` route ~L945-1003); `research-worker/src/supabase.ts` (drop `writeScriptPackUpdate` ~L705-717); `research-worker/src/planning/opus-planner.ts` (drop `AD_SCRIPTS_ADVISOR_SYSTEM` + `'ad-scripts'` branch; KEEP `'media-plan'`).
**Codex additions (claim 3 refuted — go wider):** also strip workspace `scripts` from `src/lib/workspace/types.ts:1`, `pipeline.ts:17`, `artifact-canvas.tsx:121` (union/state/meta + post-media-plan "Generate Scripts" CTA); remove the scripts tab state + CTA + `ScriptsPhaseContent` branch in `src/components/research/research-document.tsx:16,246`; retitle copy in `src/components/assets/asset-style-refs.tsx:65`, `asset-proof-points.tsx:106`.
Assets tab: relocate `StyleRefsTab` out of `components/scripts`; in `src/app/profiles/[id]/page.tsx` (~L21-24, L182-202) drop the Scripts tab, KEEP Assets (rename id to `assets`).
Gate: worker build clean; root tsc clean; tests pass; media plan unaffected (claim 4 confirmed — `getStrategicPlan` has no external `'ad-scripts'` callers).

## Phase 2 — Bloat sweep (Codex → Claude QA)
Delete verified orphans (grep importers first): `src/components/research-v2/{agent-artifact-surface,audit-artifact-canvas,artifact-zone,zone-activity,zone-error-card,section-narrative-renderer,run-section-button}.tsx`; `src/app/research-v2/managed-agents-prototype/`.
**Codex additions (claim 5 refuted):** delete/​update their test importers in the SAME diff (`src/components/research-v2/__tests__/agent-artifact-surface.test.tsx:5`, `src/app/research-v2/__tests__/page-corpus-transition.test.tsx:44`); remove the `managed-agents-prototype` exception in `src/middleware.ts:10`.
Legacy `/research` V1: confirm `src/components/research/` workspace imports (`CardContentSwitch`, `CompetitorAdEvidence`) are dead/migrated FIRST, then delete the route + fix `dashboard/page.tsx` + `app-sidebar.tsx` links.
Gate: tsc + tests clean; no dangling imports; routes resolve.

## Phase 3 — Onboarding unification (Codex → Claude DEEP review)
- Re-field the rich wizard (`onboarding-wizard.tsx` + `step-*.tsx`) to render `OnboardingV2Data` (keep its shell: step nav, progress, motion, cards; keep `AutoFillPanel`/`DocumentUploadPanel`, but their `onPrefillComplete` now emits `Partial<OnboardingV2Data>`).
- Lay out steps as the canonical 7 GTM sections + 1 Media Plan Setup step. De-dupe: single `targetCac`, single `avgLtv`. Derive `gtmMotion` from sales-motion. Preserve `salesProcessDocs`/`salesLoomUrl`/`creativeCapacity`/`leadListAvailable` in the Media Plan Setup step.
- Reproduce V2's contract: `initialData`+`initialPrefillMetadata` in, build `OnboardingReviewMetadata`, `onComplete(OnboardingV2Data, reviewMetadata)` out (so `handleOnboardingComplete`, onboarding route, orchestrate need no change).
- **Handle both surfaces (Codex claim 7):** `/research-v2/page.tsx:28,526` also mounts `OnboardingWizardV2`. Migrate /research-v2 to the new wizard (or delete /research-v2) BEFORE deleting `onboarding-wizard-v2.tsx` + its test.
- Retire `/onboarding/edit`.
- **Fix the live bug (Codex):** `src/lib/research-v2/corpus-to-research-input.ts` (~L424-496) reads stale keys (`industryVertical`, `primaryIcpDescription`, `coreDeliverables`, `primaryGoal`). Switch to V2 keys (`industry`, `idealCustomer`, `coreFeatures`, `primaryGoal90Days`) + the de-duped CAC/LTV keys. Today these silently default — fixing recovers the user's reviewed brief into all 6 sections.
- Corpus prompt emits `businessModel`; map → `salesMotion` in `prefillFromCorpus` (or stop emitting).
Gate: wizard renders the 7 sections + media-plan step; corpus prefill populates fields with badges; submit → onboarding route → orchestrate fan-out; sections receive the corrected brief fields; tsc + tests.

## Phase 4 — Upload at entry (Codex → Claude review)
- Upgrade `WelcomeForm` (`src/components/research-v2/welcome-form.tsx`): URL + optional doc/transcript upload.
- **Real persistence (Codex):** `DocumentUploadPanel` is prefill-only and DELETES the blob — add real persistence via `/api/documents/upload` (or a run-scoped endpoint) so docs land in `business_profile_documents`.
- **Kill the race (Codex claim 6):** entry submit must AWAIT upload parse + persistence BEFORE `startCorpus` dispatches the corpus.
- Inject into corpus: extend `buildCorpusContext`/`startCorpus` to add extracted doc text + persist `uploadedDocPaths` to session metadata.
- **Inject into sections via the LAB path (Codex):** v3 fan-out uses `executionMode:'lab'` → `/api/research-v2/run-lab-section` + `corpus-to-research-input.ts`, NOT `dispatch-research.ts`. Wire upload context there.
- **Tag mapping (Codex):** `section-tagger.ts` tags docs for legacy section IDs (`industryMarket`…); map to v3 IDs (`deepResearchProgram`, `positioning*`) or stop tag-filtering for v3.
- Transcription: surface `/api/transcribe` for audio→transcript at entry; feed via `meeting-intel` context-block.
Gate: upload a doc at entry → corpus context includes it → lab sections receive it (real or mocked run).

## Phase 5 — E2E QA + verify (Claude QA)
Full dogfood via `/browse`: URL+upload → corpus → wizard (prefilled, 7 sections + media-plan step) → submit → fan-out → media plan → reader. No scripts anywhere. `npm run build`, `npm run test:run`, `cd research-worker && npm run build`. Verification gate per `.claude/rules/verification.md`.

## Phase 6 — Land
Merge child branch → `feat/v2-lab-section-wire`. Update ground-truth HTML + memory.

## Workforce
HQ (Claude Opus): per-phase atom-spec, diff review, QA gates, decisions. Execution: one Codex worker (xhigh) per phase from this spec. Review: Claude reviewer/tester sub-agent per Codex diff before each gate. Phases sequential with gates; deletions (1,2) first, onboarding (3), upload (4), QA (5). Every worker-touching phase runs the worker build separately.

## Canonical question set (source of truth)
Per `AIGOS Onboarding Flow (2).md`: §1 Product & Revenue Model (7 Qs), §2 ICP + Pain (8), §3 Offer & Product Experience (4), §4 Pricing & Economics (5, CAC/LTV de-duped), §5 Competition & Positioning (4), §6 Goals & Strategy (6, CAC de-duped), §7 Current Marketing & Performance (8 + optional funnel metrics). Plus a separate Media Plan Setup step (4 inputs). gtmMotion derived, not asked.
