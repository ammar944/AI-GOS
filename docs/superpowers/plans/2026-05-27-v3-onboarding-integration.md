# V3 Onboarding Integration + Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` to run this sequentially, phase 0→6, with a review checkpoint (gate) at the end of each phase. Steps use checkbox (`- [ ]`) syntax. Honor `superpowers:test-driven-development` (TDD). This plan is self-contained — you do NOT need the originating conversation.

**Goal:** Make the old/rich multi-step onboarding wizard the corpus-fed front door of the v3 audit, asking exactly the canonical GTM questions, with file/transcript upload at entry — while removing ad-scripts and dead bloat, and fixing a live brief-passthrough bug.

**Architecture:** Keep the v3 backend untouched (Perplexity corpus → DeepSeek fan-out of 6 positioning sections → paid media plan). The onboarding UI uses the **rich wizard's presentation** (`src/components/onboarding/onboarding-wizard.tsx`) but renders the **`OnboardingV2Data` schema** (which already matches the canonical GTM doc 43/43). The reader (`AuditReaderShell`) is not touched.

**Tech Stack:** Next.js 16, Vercel AI SDK v6, Anthropic/Perplexity/DeepSeek, Supabase, Clerk, Railway worker. Tests: Vitest. TS: `tsc --noEmit` (root) + separate `research-worker` build.

---

## How to run this (fresh session, HQ-driven)

1. **HQ (you, Claude Opus)** drive each phase: read the phase, write/confirm the failing tests, implement (or dispatch a Codex worker at `xhigh` via the `codex` skill for bulk edits), then run an independent review (Claude `reviewer`/`tester` subagent) before the **gate**. Do not start phase N+1 until phase N's gate is green.
2. **TDD per phase:** red → minimal green → verify. Deletion phases (1, 2) use **guard tests + a green baseline that must hold** (you don't write a failing test to delete code; you write/keep a test that proves the thing is gone and that survivors still work).
3. **Worktree:** Work on a child branch off `feat/v2-lab-section-wire`. If not already isolated, create it via `superpowers:using-git-worktrees` (branch name e.g. `feat/v3-onboarding-integration`).
4. **Two build baselines (critical):** the root `tsc`/Vitest and the `research-worker` build are SEPARATE. Root `tsconfig.json` excludes `research-worker`. The gate is "no NEW failures vs the Phase 0 baseline," not "zero errors" — both trees have known pre-existing errors (frontend: openrouter + chat-blueprint tests; worker: express/apify missing `@types/*`).
5. **Commit frequently** (one per task). Keep diffs atomic.

---

## Locked decisions (do not relitigate)

1. Backend unchanged: corpus → 6 DeepSeek positioning sections → paid media plan (7th).
2. **Onboarding = rich wizard's LOOK + `OnboardingV2Data`.** Do NOT use the rich wizard's own `OnboardingFormData` (covers only 22/43 canonical questions). Re-field the wizard shell to render V2 data.
3. Questions = exactly the canonical doc's 7 sections (embedded below). **De-dupe:** Target CAC asked once (keep `targetCac`, drop `goalTargetCac`); Avg LTV asked once (keep `avgLtv`, drop `ltv`). Update every consumer of the dropped keys.
4. **GTM motion (`gtmMotion`) derived** from the §1 sales-motion answer — never asked.
5. **Media Plan Setup = its own step.** `salesProcessDocs`, `salesLoomUrl`, `creativeCapacity`, `leadListAvailable` collected in a separate step, OUT of the 7 GTM sections (they feed the paid media plan).
6. Uploads collected **at entry** → feed corpus AND lab sections.
7. Remove ad-scripts entirely.
8. Keep the profile **Assets** tab (relocate `StyleRefsTab` out of `components/scripts`).
9. Retire `/onboarding/edit`; no separate account onboarding; no post-research re-edit flow.
10. `/research-v3` stays the entry route; final renaming deferred.
11. Leave `script_packs` DB table inert (no drop migration).

## Onboarding contract to preserve (verified by adversarial Codex review — breaking these silently breaks the fan-out)

- Wizard accepts `initialData: Partial<OnboardingV2Data>` + `initialPrefillMetadata: OnboardingPrefillMetadata`, builds `OnboardingReviewMetadata` (badges: AI-filled / User-edited / Missing / Needs-review), emits `onComplete(OnboardingV2Data, OnboardingReviewMetadata)`.
- `POST /api/research-v2/onboarding` REQUIRES `reviewMetadata`; `orchestrate` + `src/lib/research-v2/orchestration-session.ts:getOnboardingReviewMetadata` freeze it as `researchV2OnboardingReview` / `gtmBriefReview`. Preserve that shape exactly.
- `src/app/research-v3/page.tsx` seam (verify line numbers at execution): `WelcomeForm`→`startCorpus` (~229); `buildCorpusContext` (~39); corpus dispatch (~272); `CORPUS_COMPLETE`+prefill (~345); `handleOnboardingComplete` (~394-444); `orchestrate {run_id, executionMode:'lab'}` (~434).
- `OnboardingV2Data`/`OnboardingV2Schema` live in `src/lib/research-v2/onboarding-v2-types.ts`. Review-metadata builder: `src/lib/research-v2/onboarding-review.ts`.

## Canonical GTM questions (source of truth — onboarding asks EXACTLY these)

§1 **Product & Revenue Model** — 1 Company Name · 2 What the product does · 3 Who it's built for · 4 How customers buy [Product-led/Sales-led/Hybrid] · 5 Pricing model [Subscription/Usage/Per-seat/One-time+sub] · 6 Conversion path [Free trial/Freemium/Demo/Direct checkout] · 7 Avg price/ACV [<$1K/$1–10K/$10–50K/$50K+]
§2 **ICP + Pain** — 1 Ideal customer (company+persona) · 2 Industry · 3 Job titles · 4 Company size · 5 Geography · 6 Buying triggers · 7 Currently using instead · 8 Awareness level [Unaware/Problem/Solution/Product-aware]
§3 **Offer & Product Experience** — 1 Core features/outcomes · 2 First value moment · 3 Activation event · 4 Retention drivers
§4 **Pricing & Economics** — 1 Pricing tiers · 2 Target plan · 3 Avg LTV (if known) · 4 Target CAC (if known) · 5 Monthly ad budget
§5 **Competition & Positioning** — 1 Top competitors (≥3) · 2 Why customers choose you · 3 Loss reasons · 4 What competitors do better
§6 **Goals & Strategy** — 1 Primary goal (90 days) · 2 Monthly pipeline target · 3 Target CAC *(de-dupe → reuse §4)* · 4 Common objections · 5 Key promises · 6 Brand positioning
§7 **Current Marketing & Performance** — 1 Channels [Meta/Google/LinkedIn/Cold Email/Outbound/Organic/Other] · 2 Budget split · 3 What's working · 4 What's not · 5 Current CAC · 6 Avg LTV *(de-dupe → reuse §4)* · 7 Monthly revenue (MRR/ARR) · 8 Avg sales cycle · *(optional funnel metrics: visitor→signup%, signup→activation%, activation→paid%, demo→close%, 3–6mo growth trend)*
**+ Media Plan Setup step** (separate) — salesProcessDocs, salesLoomUrl, creativeCapacity, leadListAvailable.

`OnboardingV2Data` already has a field for every one of these (43/43). Field key map confirmed: companyName, productDescription, builtFor, salesMotion, pricingModel, conversionPath, acv, idealCustomer, industry, jobTitles, companySize, geographicFocus, triggers, currentAlternative, awarenessLevel, coreFeatures, firstValueMoment, activationEvent, retentionDrivers, pricingTiers, targetPlan, avgLtv(keep)/ltv(drop), targetCac(keep)/goalTargetCac(drop), monthlyAdBudget, topCompetitors, whyCustomersChooseYou, lossReasons, competitorAdvantages, primaryGoal90Days, monthlyPipelineTarget, commonObjections, keyPromises, brandPositioning, channels, budgetSplit, whatsWorking, whatsNotWorking, currentCac, monthlyRevenue, avgSalesCycle, growthTrend, (optional) visitorToSignup/signupToActivation/activationToPaid/demoToClose; (media-plan) salesProcessDocs, salesLoomUrl, gtmMotion(derive), creativeCapacity, leadListAvailable.

---

## PHASE 0 — Foundation (HQ)

**Objective:** Isolated branch, recorded baselines, decision records. No product code.

- [ ] **0.1 Branch/worktree.** Create child branch `feat/v3-onboarding-integration` off `feat/v2-lab-section-wire` (use `superpowers:using-git-worktrees`).
- [ ] **0.2 Record baselines** (write the numbers into this plan or a scratch note; every later gate compares against them):
  - `npm run test:run` → record pass/fail counts.
  - `npx tsc --noEmit` → record error count (expect pre-existing openrouter + chat-blueprint errors).
  - `cd research-worker && npm run build` → record worker error count (expect pre-existing express/apify `@types` errors).
- [ ] **0.3 Decision records.** Write `docs/adr/0008-single-corpus-fed-onboarding.md` (rich-UI look + V2 data + canonical GTM questions; supersedes nothing, complements 0002/0003) and `docs/adr/0009-remove-ad-scripts.md` (Audit = 6 sections + media plan; scripts feature deleted). Update `CONTEXT.md` glossary: add **Corpus**, **GTM Brief / Onboarding**, **Media Plan Setup**; note Audit closes with the media plan; note ad-scripts removed from product scope.
- [ ] **0.4 Commit:** `docs(v3): ADR-0008/0009 + CONTEXT glossary + baselines for onboarding integration`.

**Gate:** branch exists; baselines recorded; ADRs + CONTEXT committed.

---

## PHASE 1 — Ad-scripts removal (HQ spec → Codex → Claude QA)

**Objective:** Delete the ad-scripts feature end-to-end; keep the media plan and the Assets tab.

**Delete (whole):** `research-worker/src/scripts/` (pipeline, stages, refs, `__tests__`) · `src/app/api/scripts/` · `src/app/api/profiles/[id]/script-packs/` · `src/components/scripts/` · `src/components/workspace/scripts-phase.tsx` · `src/lib/scripts/`.
**Surgical edits:** `research-worker/src/index.ts` (drop `runScriptPipeline` import ~L26, `writeScriptPackUpdate` from supabase import ~L18, the `/api/scripts` route block ~L945-1003) · `research-worker/src/supabase.ts` (drop `writeScriptPackUpdate` ~L705-717) · `research-worker/src/planning/opus-planner.ts` (drop `AD_SCRIPTS_ADVISOR_SYSTEM` + the `'ad-scripts'` branch of `getStrategicPlan`; KEEP `'media-plan'`).
**Wider (Codex-found):** strip workspace `scripts` from `src/lib/workspace/types.ts`, `src/lib/workspace/pipeline.ts`, `src/components/workspace/artifact-canvas.tsx` (union/state/meta + post-media-plan "Generate Scripts" CTA) · remove scripts tab/CTA/`ScriptsPhaseContent` branch in `src/components/research/research-document.tsx` (~L16, ~L246, ~L266) · retitle copy in `src/components/assets/asset-style-refs.tsx:65` + `asset-proof-points.tsx:106`.
**Assets:** relocate `StyleRefsTab` out of `components/scripts`; in `src/app/profiles/[id]/page.tsx` drop the Scripts tab + `scripts`/`style-refs` from `TabId` (~L21-24, L182-202) but KEEP an Assets tab (rename id `assets`).

- [ ] **1.1 Guard test (red→green).** Add `src/app/profiles/[id]/__tests__/tabs.test.tsx` asserting the profile `TabId` union / tabs array does NOT include `'scripts'` and DOES include `'assets'`. Run → FAIL (scripts tab still present). Keep for the gate.
- [ ] **1.2 Media-plan safety test.** Add a worker test asserting `getStrategicPlan('media-plan', …)` still returns a plan and the media-plan schema (`research-worker/src/agents/subagents/schemas/paid-media-plan.ts`) is importable. Run → PASS now (proves independence before deletion).
- [ ] **1.3 Delete worker scripts + edits.** Apply the worker deletions/edits above. Run `cd research-worker && npm run build` → no NEW errors vs 0.2 baseline.
- [ ] **1.4 Delete frontend scripts + wider edits + Assets relocation.** Apply all frontend deletions/edits above. Remove orphaned scripts `__tests__` in the same diff.
- [ ] **1.5 Verify.** `npx tsc --noEmit` (no new errors) · `npm run test:run` (green; 1.1 now passes) · `cd research-worker && npm run build` (green).
- [ ] **1.6 Commit:** `feat(v3): remove ad-scripts feature; keep media plan + Assets tab`.

**Gate:** both builds at baseline; tests green; 1.1 + 1.2 pass; grep shows zero live references to `scripts/` modules, `runScriptPipeline`, `writeScriptPackUpdate`, `ScriptsPhaseContent`, `/api/scripts`.

---

## PHASE 2 — Bloat sweep (HQ spec → Codex → Claude QA)

**Objective:** Delete verified orphans + their test importers + stale route exceptions, without breaking live imports.

**Orphans (delete after grep-confirming no live importer):** `src/components/research-v2/{agent-artifact-surface,audit-artifact-canvas,artifact-zone,zone-activity,zone-error-card,section-narrative-renderer,run-section-button}.tsx` · `src/app/research-v2/managed-agents-prototype/`.
**Same-diff (Codex-found):** delete/update test importers `src/components/research-v2/__tests__/agent-artifact-surface.test.tsx` + `src/app/research-v2/__tests__/page-corpus-transition.test.tsx` (line ~44 references) · remove the `managed-agents-prototype` exception in `src/middleware.ts` (~L10).
**Legacy `/research` V1:** FIRST grep-confirm `src/components/research/` workspace imports (`CardContentSwitch`, `CompetitorAdEvidence`, `use-subsection-reveal`) are dead/migrated. Only then delete the `/research` + `/research/[sessionId]` routes and fix `src/app/dashboard/page.tsx` + `src/components/shell/app-sidebar.tsx` links to point at `/research-v3`.

- [ ] **2.1 Import-graph check.** For each orphan, `grep -rn "<basename>" src --include=*.ts --include=*.tsx` → confirm only self + its own test reference it. Record results.
- [ ] **2.2 Nav guard test (red→green).** Add a test asserting dashboard + sidebar links resolve to `/research-v3` (not `/research`). Run → FAIL. (Fixed in 2.4.)
- [ ] **2.3 Delete orphans + their tests + middleware exception.** Apply. Run `npx tsc --noEmit` → no new errors (no dangling imports).
- [ ] **2.4 Remove `/research` V1 (only if 2.1 confirms dead) + fix links.** Run 2.2 → now PASS.
- [ ] **2.5 Verify:** `npx tsc --noEmit` + `npm run test:run` green.
- [ ] **2.6 Commit:** `refactor(v3): delete orphaned research-v2 surfaces + legacy /research route`.

**Gate:** tsc + tests green; no dangling imports; all routes resolve; 2.2 passes.

---

## PHASE 3 — Onboarding unification (HQ spec → Codex → Claude DEEP review)

**Objective:** Rich wizard shell renders `OnboardingV2Data` as the 7 GTM sections + Media Plan Setup step, corpus-prefilled, wired into `/research-v3` fan-out; fix the brief-passthrough bug; retire V2 + `/onboarding/edit`.

- [ ] **3.1 Schema de-dupe (red→green).** Test: `OnboardingV2Schema` has NO `goalTargetCac` and NO `ltv`; `targetCac` + `avgLtv` remain. Run → FAIL. Then in `src/lib/research-v2/onboarding-v2-types.ts` remove `goalTargetCac` + `ltv`; update `SECTION_META`/`SECTION_SCHEMAS`. Grep every reader of the dropped keys and repoint to the survivors. Run → PASS + `npx tsc --noEmit` clean.
- [ ] **3.2 Fix the brief-passthrough bug (red→green) — high value.** Test `src/lib/research-v2/__tests__/corpus-to-research-input.test.ts`: given `OnboardingV2Data` with `industry`, `idealCustomer`, `coreFeatures`, `primaryGoal90Days` set, `corpusToResearchInput(...)` returns `ResearchInput` with `category`, `targetCustomer`, `keyOffers`, `primaryGoal` populated from those values (NOT defaults). Run → FAIL (code reads stale `industryVertical`/`primaryIcpDescription`/`coreDeliverables`/`primaryGoal` at ~L424-496). Fix `src/lib/research-v2/corpus-to-research-input.ts` to read the V2 keys (+ de-duped CAC/LTV). Run → PASS.
- [ ] **3.3 Corpus→prefill key bridge.** Test: `prefillFromCorpus` maps corpus `businessModel` → `salesMotion` (or stops emitting it) and derives `gtmMotion` from `salesMotion`. Implement in `src/lib/research-v2/prefill-from-corpus.ts`. Run → PASS.
- [ ] **3.4 Re-field the wizard to V2 data.** Read the live `src/components/onboarding/onboarding-wizard.tsx` + `step-*.tsx` + `auto-fill-panel.tsx` + `document-upload-panel.tsx`. Re-type them to `OnboardingV2Data`; lay steps out as the 7 GTM sections + a Media Plan Setup step; derive `gtmMotion`; panels' `onPrefillComplete` emit `Partial<OnboardingV2Data>`. Tests (`src/components/onboarding/__tests__/onboarding-wizard.test.tsx`): (a) renders a field for every canonical question; (b) `onComplete` emits `(OnboardingV2Data, OnboardingReviewMetadata)`; (c) `initialData` + `initialPrefillMetadata` hydrate fields with correct badges. Red → implement → green.
- [ ] **3.5 Onboarding-route contract test.** Test: `POST /api/research-v2/onboarding` 422s when `reviewMetadata` is missing; persists `researchV2OnboardingReview` when present. Confirm green (no behavior change — guards the contract for the swap).
- [ ] **3.6 Mount on /research-v3 + migrate /research-v2.** Replace the `OnboardingWizardV2` mount in `src/app/research-v3/page.tsx` (~L539) with the re-fielded wizard (same `onComplete` contract → `handleOnboardingComplete` unchanged). Do the same for `src/app/research-v2/page.tsx` (~L28, ~L526). Test: research-v3 onboarding submit → onboarding POST (with reviewMetadata) → `orchestrate` fires with `executionMode:'lab'`.
- [ ] **3.7 Delete V2 + retire /onboarding/edit.** After 3.6 green on BOTH surfaces, delete `src/components/research-v2/onboarding-wizard-v2.tsx` + its test; remove `/onboarding/edit` route + client.
- [ ] **3.8 Verify + commit** per step. Final: `npx tsc --noEmit` + `npm run test:run` green; `cd research-worker && npm run build` green (if touched).

**Gate:** wizard renders the 7 sections + media-plan step; corpus prefill populates with badges; submit → onboarding route → fan-out; 3.2 proves the brief now reaches all 6 sections; no remaining `OnboardingWizardV2`/`goalTargetCac`/`ltv` references; tests green.

---

## PHASE 4 — Upload at entry (HQ spec → Codex → Claude QA)

**Objective:** Collect URL + doc/transcript at the welcome screen; persist them; feed corpus AND lab sections; no race.

- [ ] **4.1 Await-before-corpus (red→green).** Test: `WelcomeForm` submit with attached files resolves upload persistence BEFORE its `onSubmit(url, uploads)` resolves (no corpus dispatch until uploads are persisted). Run → FAIL. Implement upload UI + the await in `src/components/research-v2/welcome-form.tsx` + `startCorpus` (`research-v3/page.tsx` ~L229). Run → PASS.
- [ ] **4.2 Real persistence (red→green).** Test: entry upload calls `POST /api/documents/upload` and writes a `business_profile_documents` row (mock Supabase) — NOT the prefill-only path that deletes the blob. Implement. Run → PASS.
- [ ] **4.3 Corpus injection.** Test: `buildCorpusContext` (`research-v3/page.tsx` ~L39) includes uploaded doc text and persists `uploadedDocPaths` to session metadata. Implement → PASS.
- [ ] **4.4 Lab-section injection (Codex-found path).** Test: uploaded-doc context reaches lab sections via `src/lib/research-v2/corpus-to-research-input.ts` / `src/app/api/research-v2/run-lab-section/route.ts` (NOT `dispatch-research.ts`, which the lab path doesn't use). Implement → PASS.
- [ ] **4.5 v3 tag mapping.** Test: `src/lib/documents/section-tagger.ts` maps an uploaded doc to v3 section IDs (`deepResearchProgram`, `positioning*`) so injection isn't filtered out by legacy tags. Implement → PASS.
- [ ] **4.6 Transcription.** Test: an audio upload at entry routes through `POST /api/transcribe` → `meeting-intel` context block → corpus/section context. Implement → PASS.
- [ ] **4.7 Verify + commit** per step.

**Gate:** upload a doc at entry → corpus context contains it AND a lab section receives it (real or mocked run); no race; tests green; both builds at baseline.

---

## PHASE 5 — E2E QA + verify (HQ / Claude QA)

- [ ] **5.1** Full dogfood via `/browse`: URL+upload → corpus → wizard (prefilled, 7 sections + media-plan step) → submit → fan-out → media plan → reader. Confirm NO scripts UI anywhere.
- [ ] **5.2** `npm run build` (exits 0) · `npm run test:run` (green) · `cd research-worker && npm run build` (green) — all vs baseline per `.claude/rules/verification.md`.
- [ ] **5.3** Screenshot/verify the wizard visually matches the old rich look. Write the verification report (build/test/manual/spec).

**Gate:** verification report passes all four checks.

---

## PHASE 6 — Land (HQ)

- [ ] **6.1** Merge `feat/v3-onboarding-integration` → `feat/v2-lab-section-wire`.
- [ ] **6.2** Update the ground-truth HTML + project memory with the new onboarding flow + scripts removal.
- [ ] **6.3** Commit/push per the user's normal flow (only when asked).

**Gate:** merged; ground-truth + memory updated.

---

## Self-review (run before declaring done)
- Every canonical GTM question (43) maps to a rendered field; the 2 de-dupes ask once; `gtmMotion` derived; media-plan inputs in their own step.
- No live references to: ad-scripts modules, `OnboardingWizardV2`, `goalTargetCac`, `ltv`, the Phase-2 orphans, `/research` V1.
- `corpus-to-research-input` reads V2 keys (3.2 test proves the brief reaches sections).
- Onboarding contract intact: `reviewMetadata` flows to `researchV2OnboardingReview`; orchestrate fan-out fires.
- Both build baselines hold; media plan still produces output.

## Reference docs (in-repo)
- Spec summary: `docs/2026-05-27-v3-onboarding-integration-plan.md`
- Canonical questions: embedded above (originated from the user's "AIGOS Onboarding Flow" doc).
