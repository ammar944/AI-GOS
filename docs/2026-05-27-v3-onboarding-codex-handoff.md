# V3 Onboarding Integration — Codex Continuation Handoff

**Date:** 2026-05-27 · **Executor:** Codex CLI at `model_reasoning_effort=xhigh`.
**Branch:** `feat/v3-onboarding-integration` · **Worktree:** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v3-onboarding-integration` (off `feat/v2-lab-section-wire` @ `a2ab19c3`).
**Authoritative detail:** `docs/2026-05-27-v3-onboarding-integration-plan.md` + `docs/adr/0008-single-corpus-fed-onboarding.md` + `docs/adr/0009-ad-scripts-removed.md`. This handoff records what's DONE, corrects stale plan assumptions, pins the contract, and scopes the remaining phases as **live E2E** work.

---

## 1. What is already DONE (do NOT redo — verify, then build on)

| Phase | Commit | Result |
|---|---|---|
| 0 Foundation | `f99e73bb` | ADR-0008 + ADR-0009 + CONTEXT.md glossary (Corpus, GTM Brief, Onboarding, Media Plan Setup) |
| 1 Ad-scripts removal | `c7019d68` | Whole feature deleted (worker `scripts/`, `api/scripts`, `api/profiles/[id]/script-packs`, `components/scripts`, `lib/scripts`, `scripts-phase.tsx`); `scripts` removed from the workspace `SectionKey` union + all consumers; `getStrategicPlan` keeps only `'media-plan'`; `loadHaynesFrameworks` removed; **StyleRefsTab relocated → `src/components/assets/style-refs-tab.tsx`**; profile Scripts tab dropped, Assets tab kept (id `assets`). |
| 2 Bloat sweep | `69931017` | 7 orphan `research-v2` components + 2 coupled tests deleted; `managed-agents-prototype` page + its `middleware.ts` exception removed. |
| 3a Brief-recovery bug | `7036d343` | `corpus-to-research-input.ts` now reads V2 keys (`industry`, `idealCustomer`, `coreFeatures`, `primaryGoal90Days`) first so the reviewed brief reaches all 6 sections. **This was the only data-layer part of Phase 3; the wizard re-fielding (3b) is still TODO.** |

**Baseline at this commit (your regression floor):** frontend `npx tsc --noEmit` = **0 errors**; `npm run test:run` = **1043 passed / 1 skipped**; `cd research-worker && npm run build` = **0 errors** (the "6 known errors" in older docs is STALE — the worker is clean now; keep it at 0).

## 2. Corrections to the original plan (these override `2026-05-27-v3-onboarding-integration-plan.md` where they conflict)

1. **KEEP legacy `/research/[sessionId]` V1.** The plan's Phase 2 said delete it; it is **still the live saved-report viewer** linked from the profile Research tab (`/research/${runId}` in `src/app/profiles/[id]/page.tsx`). It renders `ResearchDocument` (which was made scripts-free in Phase 1). Do **not** delete it. The V1→V3 saved-report migration (repoint the profile link to `/research-v3?runId=` and verify v3 renders historical runs) is a **separate future task**, out of scope here.
2. **Worker baseline = 0 errors** (not 6). Worker gate = stays at 0.
3. **De-dupe `ltv` trap:** the `ltv` references in `src/lib/media-plan/validation.ts` and `src/lib/ai/media-plan-chat-tools/explain-media-plan.ts` are **local variables / keyword strings, NOT the `OnboardingV2Data.ltv` field** — do NOT touch them. The real de-dupe surface is the schema + wizard + test fixtures (see Phase 3b).
4. **3a already done** — do not re-edit the 4 corpus reader keys.

## 3. The CONTRACT — DO NOT BREAK (this is why the wizard re-skin is safe)

The backend (`POST /api/research-v2/onboarding` → `orchestrate` freeze as `gtmBriefReview`/`researchV2OnboardingReview`) must see the **exact same shape** after the rebuild. Preserve end-to-end:

- **Data type:** `OnboardingV2Data` — canonical field keys are in `src/lib/research-v2/onboarding-v2-types.ts`. **Read that file; do not invent keys.** The 7 GTM question groups + the Media Plan Setup fields all live on this one flat type.
- **Wizard I/O contract** (currently implemented by `src/components/research-v2/onboarding-wizard-v2.tsx`): accepts `initialData: Partial<OnboardingV2Data>` + `initialPrefillMetadata: OnboardingPrefillMetadata`; builds `OnboardingReviewMetadata` (AI-filled / User-edited / Missing / Needs-review badges, per `src/lib/research-v2/onboarding-review.ts`); emits `onComplete(OnboardingV2Data, OnboardingReviewMetadata)`. The re-fielded rich wizard MUST reproduce this exact signature.
- **The seam** (`src/app/research-v3/page.tsx`, locate by symbol — line numbers drift): `WelcomeForm onSubmit={startCorpus}` → `startCorpus` (calls `buildCorpusContext`, dispatches corpus) → `CORPUS_COMPLETE` + prefill → wizard `onComplete={handleOnboardingComplete}` → onboarding POST → `fetch('/api/research-v2/orchestrate', { run_id, executionMode:'lab' })`. If `onComplete`'s `reviewMetadata` is malformed, orchestrate 422s / freezes null. **Verify the contract with the existing `src/app/api/research-v2/onboarding/__tests__/route.test.ts` and `onboarding-wizard-v2.test.tsx`.**
- **Dual-surface:** `OnboardingWizardV2` is mounted in **both** `src/app/research-v3/page.tsx` (the live entry) AND `src/app/research-v2/page.tsx` (legacy duplicate). Migrate **both** to the unified wizard, OR delete `/research-v2/page.tsx` — but do one of them **before** deleting `onboarding-wizard-v2.tsx` + its test, or a live import dangles.

---

## 4. Remaining phases (execute in order; commit + gate per phase)

### Phase 3b — Re-skin the rich wizard onto the V2 contract
**Goal:** the rich multi-step wizard's LOOK (step nav, progress, motion, cards, `AutoFillPanel`, `DocumentUploadPanel`) renders `OnboardingV2Data` and asks exactly the canonical 7 GTM question sections + 1 Media Plan Setup step.
**Files:** `src/components/onboarding/onboarding-wizard.tsx` + the `step-*.tsx` files (`step-business-basics`, `step-icp`, `step-product-offer`, `step-budget-targets`, `step-market-competition`, `step-customer-journey`, `step-brand-positioning`, `step-assets-proof`, `step-compliance`) — these currently render the nested **`OnboardingFormData`** (22/43 coverage); re-field them to the flat `OnboardingV2Data` (43/43). Keep `AutoFillPanel`/`DocumentUploadPanel` but their `onPrefillComplete` now emits `Partial<OnboardingV2Data>`.
**Layout = canonical question doc** `AIGOS Onboarding Flow (2).md`: §1 Product&Revenue (7) · §2 ICP+Pain (8) · §3 Offer&Experience (4) · §4 Pricing&Economics (5) · §5 Competition&Positioning (4) · §6 Goals&Strategy (6) · §7 Current Marketing&Performance (8 + optional funnel metrics) · **+ separate Media Plan Setup step** (`salesProcessDocs`, `salesLoomUrl`, `creativeCapacity`, `leadListAvailable`).
**De-dupes (drop these keys from `OnboardingV2Data` + every consumer):** drop `ltv` (keep `avgLtv`); drop `goalTargetCac` (keep `targetCac`). Consumers to update: `onboarding-v2-types.ts` (schema + zod), the wizard steps, the two test fixtures (`onboarding-wizard-v2.test.tsx`, `api/research-v2/onboarding/__tests__/route.test.ts`), and `prefill-from-corpus.ts` comments. **NOT** `media-plan/validation.ts` (local var — see §2.3).
**Derive `gtmMotion`** (`'SLG'|'PLG'|''`) from the §1 `salesMotion` answer — never ask it.
**Retire `/onboarding/edit`** (`src/app/onboarding/edit/` + its `__tests__`). Keep `src/app/onboarding/page.tsx` (the redirect to `/research-v3`, shipped in Phase A).
**Then** point `/research-v3` (and `/research-v2` or delete it) at the unified wizard and remove `onboarding-wizard-v2.tsx` + its test.
**Gate:** `tsc 0` · `test:run` green · `build 0` · **LIVE:** the wizard renders all 7 sections + Media Plan Setup, prefill badges show, submit → orchestrate fan-out fires (see Phase 5 stack).

### Phase 4 — Upload at entry
Per the plan's Phase 4. Key Codex-verified points: `DocumentUploadPanel` currently **deletes the blob (prefill-only)** — add real persistence (`/api/documents/upload` → `business_profile_documents`); entry submit must **await upload+persist BEFORE `startCorpus`** (kill the race); inject extracted text into `buildCorpusContext` and persist `uploadedDocPaths`; inject into sections via the **LAB path** (`corpus-to-research-input.ts`, NOT `dispatch-research.ts`); map `section-tagger.ts` tags to v3 IDs (or stop tag-filtering for v3); surface `/api/transcribe` for audio.
**Gate:** `tsc/test/build` green · **LIVE:** upload a doc at entry → corpus context includes it → lab sections receive it.

### Phase 5 — LIVE E2E QA (the priority — this is live-dogfood work, not unit tests)
Run the real stack and dogfood the whole flow (use the `qa` / `browse` skills):
- **Stack:** Terminal 1 `npm run dev` (app, `:3100` per v3 proof convention); Terminal 2 `cd research-worker && npm run dev` (`:3001`). `.env.local` needs `RAILWAY_WORKER_URL=http://localhost:3001`, `RAILWAY_API_KEY=dev-secret`, plus `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY` (corpus), `DEEPSEEK_API_KEY` (lab sections), `SEARCHAPI_KEY`, Supabase + Clerk keys.
- **Flow to prove:** fresh real URL → corpus (Perplexity) → unified wizard (prefilled, 7 sections + Media Plan Setup) → submit → 6-section lab fan-out → paid media plan → Audit Reader. **Confirm NO scripts anywhere** (no Scripts tab, no Generate-Scripts CTA, no `/api/scripts`). Confirm the reviewed brief reaches sections (the 3a fix — edit a field, see it reflected).
- ≥1 fresh real URL renders 6/6 + media plan, no error boundary, no `Synthetic:` / `example.com` strings.

### Phase 6 — Land
Merge `feat/v3-onboarding-integration` → `feat/v2-lab-section-wire`. Update the ground-truth HTML + memory. **STOP — do NOT merge lab-wire → main or touch prod (that's the separate Phase G cutover; bring Ammar a go/no-go).**

---

## 5. Execution conventions
- `model_reasoning_effort=xhigh`. Work only in the worktree above.
- TDD/verify per phase: failing test first where practical; **gate before each commit** (`tsc 0` / `test:run` green / frontend `build 0` / worker `build 0` / LIVE proof).
- Atomic, build-green commits per phase. Co-author trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- When deleting a module, sweep its barrel/registry refs **and** `__tests__/*` in the SAME commit (orphan tests emit `TS2307` and fail the gate — see `.claude/rules/learned-patterns.md`).
- Verify every path with `find`/`grep` before editing; locate seam code by symbol, not the line numbers in any doc.
- **Out of scope (do not touch):** legacy `/research/[sessionId]` V1; `lab-wire → main` merge; prod env; the lab engine / section registry / managed-agents **schemas** (load-bearing — ADR-0006).
