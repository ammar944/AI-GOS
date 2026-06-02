# Codex Goal Handoff — AI-GOS v3 (the full arc)

**Date:** 2026-05-26 · **For:** Codex (`-c model_reasoning_effort=xhigh`) · **Seat:** executor.
**Worktree (run here):** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire` · **Branch:** `feat/v2-lab-section-wire`.
**Model owner:** Claude plans + reviews + writes each phase's task brief; Codex executes. This is a **large, multi-phase** effort — execute **phase by phase**, stop at each phase's QA gate, do **not** one-shot all of it.

> **⚠️ AMENDED 2026-05-26 — the current execution spec is `docs/2026-05-26-v3-bg-execution-handoff.md`. This handoff has been re-synced to that spec; the BG handoff remains authoritative if anything conflicts:**
> 1. **Sections use REAL in-section tools — NOT corpus-only.** The old "corpus-only DeepSeek lab path" framing + the live-tools-disabled anchor are **REVERSED** (ADR-0006): flip the gate on with each section's existing registry allowlist; bound the loop (`stepCountIs 4`, tightened `maxExternalLookups`); **delete** the synthetic backfill in `corpus-to-research-input.ts` and **relax** the `ResearchInput` floors (`competitorAds.min`, `corpus.excerpts.min`).
> 2. **Client-channel research step = sub-section #11, not #7** (structure doc + ADR-0005).
> 3. **Prod after D**, two-gate model; **full proof bar** (≥3 fresh URLs + 48h soak + no section >270s); **`feat/v2-lab-section-wire` → `main`** at G, retire `codex/claude-managed-agents-work`; managed-agents runtime deleted, schemas kept.
> Anchors, baselines, field-sync map, and gotchas #1–3/#5–6 below all still stand.

---

## THE GOAL (agent-bus goal statement)
> Take AI-GOS from "Phase A closed" to **v3 complete**: keep the front door on `/research-v3`, run the six positioning sections through the DeepSeek lab engine with bounded real in-section tools on top of the shared Railway corpus base, rebuild the audit reader as a per-section paginated experience with live sub-section reveal, add a skill-backed **Paid Media Plan** as the dependent seventh section, satisfy the multi-URL proof and soak gates, tear out the dead legacy paths, and promote to production — each step TDD'd and behind the verification gate.

## READ FIRST (do not re-discover — these are ground truth)
- **`docs/2026-05-26-v3-scope-and-plan.md`** — the phase/task narrative + the 9 locked decisions. THIS handoff adds the grounded anchors + protocol.
- **`docs/2026-05-26-media-plan-v3-structure.md`** — the Paid Media Plan section structure (12 sub-sections, schema, SKILL shape, gap analysis). Source of truth for Phase E.
- **`docs/research-sections.md`** — canonical sub-section spec for the 6 (named sub-sections; never a generic envelope).
- **`docs/2026-05-25-v2-wire-deepseek-ground-truth.html`** — status/history (T3.6 detail, the envelope-flatten bug + fix).
- **Prototypes (Desktop, throwaway visual reference):** `~/Desktop/aigos-v3-prototypes/{A-research-v3-audit-reader,B-progress-streaming-variants,C-paid-media-plan}.html`.

## ARCHITECTURE (unchanged — do not "fix" this)
- **Corpus** (`deepResearchProgram`) runs on the **Railway worker** (`research-worker/`, no timeout limit). **LOAD-BEARING — keep it.**
- **6 positioning sections** run on the **Next.js lab engine**: `POST /api/research-v2/orchestrate` (`executionMode:'lab'`) → `dispatchLabSectionJobs` → `POST /api/research-v2/run-lab-section` per section, ACK 202 + `after()`/`waitUntil` bounded by `maxDuration=300`.
- **Media plan** (Phase E) = a **dependent final wave** after the 6 commit.
- **Worker boundary:** `research-worker/` CANNOT import from `src/lib/`; schemas/types must exist on both sides (field-sync).

## BASELINES (the regression gate)
- **Frontend (2026-05-26 verification):** `npx tsc --noEmit` = **0**, `npm run test:run` = **1074 pass / 1 skip**, `npm run build` = **exit 0**. Do not regress these.
- **Worker (captured 2026-05-26):** `cd research-worker && npm run build` has **6 KNOWN pre-existing errors**, all unrelated to v3 — this is the worker baseline (a 7th error = your regression):
  - `src/index.ts(2,21)` TS7016 `express` has no declaration file (no `@types/express`)
  - `src/index.ts(229,21/27)`, `(237,27/33)` TS7006 implicit-any `_req`/`res` (×4)
  - `src/tools/apify-ads.ts(6,29)` TS2307 cannot find `apify-client`
  **Do NOT inherit the frontend's 0 as the worker gate — re-run and diff against these 6.**

## VERIFICATION GATE (every task — `.claude/rules/verification.md`)
Red→green TDD (failing test first). Then: `npx tsc --noEmit` 0 · `npm run test:run` green (≥ baseline + your new tests) · `npm run build` exit 0 · worker tasks also `cd research-worker && npm run build`. Live proof on `:3100` where the task is user-visible. **No "should work."**

## GROUNDED ANCHOR MAP (verified 2026-05-26)
| Task | Entry point (file:line) | Note |
|---|---|---|
| T3.7 flip | `src/app/onboarding/page.tsx:37` `redirect("/research-v2")` | → `/research-v3`. v3 page already sends `executionMode:'lab'`. |
| A1 renderers | `src/components/research-v2/section-renderers/{market-category,buyer-icp,competitor-landscape,voice-of-customer,demand-intent,offer-diagnostic}.tsx` | + `__tests__/`, `index.ts` |
| A1 flatten (EXISTS) | `src/types/positioning-artifact.ts` → `pickPositioningTypedArtifact` (:149), `dropEnvelopeOnlyKeys` (:140), `isPositioningTypedArtifact` (:62) | T3.6 fix. BuyerICP confirmed aligned; **verify the other 5's `data.body` keys vs each renderer's destructure.** |
| orchestrate | `src/app/api/research-v2/orchestrate/route.ts` modes `:42`, default `:216`, `dispatchLabSectionJobs` `:92/:277` | |
| live-tools guard | `src/lib/research-v2/lab-section-job.ts` `getLabEngineAllowedTools()` | Returns `[]` only when `LAB_ENGINE_LIVE_TOOLS === 'false'`; otherwise returns `undefined` so the lab engine falls through to each section's registry allowlist. Keep the gate, but the current Phase D/default path is live allowlists. |
| poll hook | `src/lib/research-v2/use-audit-state.ts` | progress UX (Phase C) |
| worker corpus | `research-worker/src/runners/deep-research-program.ts` | shared corpus base — LOAD-BEARING |
| **Media-plan field-sync (Phase E1) — 7 surfaces** | | add `positioningPaidMediaPlan` to ALL: |
| 1 | `src/lib/ai/prompts/positioning-skills/index.ts:16` `POSITIONING_SECTION_IDS` + `:34` `_LABELS` | the canonical 6 → 7 |
| 2 | `src/lib/journey/server/dispatch-research.ts:22` `SECTION_TO_TOOL` | + worker tool |
| 3 | `src/types/positioning-artifact.ts:20` `TYPED_ARTIFACT_KEYS_BY_ZONE` | |
| 4 | `src/components/research-v2/typed-artifact-renderer.tsx:413-423` switch | + new renderer (terminal page) |
| 5 | `src/lib/research-v2/intent-router.ts:13` | |
| 6 | `src/lib/research-v2/orchestrate-db.ts` + `orchestrate-client.ts` | auto via `POSITIONING_SECTION_IDS` import — confirm |
| 7 | worker: a runner in `research-worker/src/runners/` + its section registry + schema mirror | worker-side |

## CRITICAL GOTCHAS (grounded — these cause silent failures)
1. **A1 is verify-the-5, not build-the-flatten.** The flatten already ships. Per section, query the live `data.body` keys (SQL in the T3.6 handoff `docs/2026-05-26-t3.6-codex-handoff.md`) and diff against the renderer's destructure; add a render-regression test per section. A mismatch = blank render (not a crash) → must be caught.
2. **F1 teardown is surgical, NOT blind.** `SECTION_TO_TOOL` (dispatch-research.ts:22) mixes **dead** legacy entries (`industryMarket`, `competitors`, `icpValidation`, `offerAnalysis`, `crossAnalysis`, `keywordIntel`, `mediaPlan`) with the **LIVE** `deepResearchProgram` (corpus) + the 6 positioning. **Trace dead-vs-live before deleting anything.** When you delete a source file, the kill-list MUST also remove: its barrel/`index.ts` export, any registry/map entry (`SECTION_TO_TOOL`, `TOOL_RUNNERS`, `ToolName` union), and its `__tests__/*` (orphan tests emit `TS2307` and break the gate). (Learned-patterns, Phase 7.)
3. **Field-sync is 6+ places** (see anchor map). Missing one = runtime/type break. Verify each path with `find` before editing.
4. **Media plan = synthesis + ONE targeted client-channel research step** (sub-section #11 only). Everything else in the media plan synthesizes the 6 committed artifacts. The 6 positioning sections do use bounded in-section tools per Phase D; do not add unbounded research infrastructure or a second corpus-expansion pass. Never layer `Output.object` on the answer tool (the #411 trap).
5. **AI SDK v6:** `inputSchema` (not `parameters`), `maxOutputTokens` (not `maxTokens`); no `.min()/.max()` on Zod numbers sent to structured-output (use `.describe()`).
6. **Anchors are line-stamped as of 2026-05-26** — re-grep before editing; lines drift.

---

## PHASE BOARD (execute in order; QA gate between phases)
Narrative + verify per task: `docs/2026-05-26-v3-scope-and-plan.md`. Anchors: table above. Owner tags there. **At each phase end: stop, Claude reviews, Claude writes the next phase's focused task brief.**

- **Phase A — T3.7 (closed, gated):** A1 verify 6 renderer alignments (+per-section regression tests) · A2 fresh real-URL 6/6 proof on `:3100` *(needs the dev server + an authenticated session — coordinate with the user; the headless CLI can't reach the Clerk session)* · A3 flip `onboarding/page.tsx` to `/research-v3`. **Gate:** keep A1+A2/A3 evidence current before claiming regression-free status.
- **Phase B — per-section paginated reader:** tabs+next/prev, competitor tab-bar, clean verdict line, real typed sub-section renderers. Prototype A = visual ref (nav revised to paginated). Keep renderers **data-driven/editable** (future unified chat edits them).
- **Phase C — sub-section progressive reveal:** worker/lab emits per-sub-section commit events; reader renders the ticking checklist + "Wave X of Y · N running/queued/complete" header.
- **Phase D — real-tool sections + anti-fabrication gate:** run the six sections with bounded real in-section tools, delete synthetic backfill, relax `ResearchInput` floors, keep competitor `adPresence` field-sync, and surface query/search/synthesis/validation/commit steps for Phase C. **Gate:** fresh real URLs hit 6/6 with `LAB_ENGINE_LIVE_TOOLS=true`/default live allowlists, no `Synthetic:` strings, no `example.com`, no section >270s, and p95 watch-line tracked.
- **Phase E — Paid Media Plan section:** per `docs/2026-05-26-media-plan-v3-structure.md` — E1 7-surface field-sync + schema (managed-agents convention) + SKILL.md (fill-in-the-blanks, per-claim `sourceSection`) · E2 targeted client-channel research step (#11) · E3 brief fields (sales-doc links, SLG/PLG, creative capacity, lead-list) · E4 dependent final wave after 6/6 · E5 terminal-page renderer (prototype C).
- **Phase F — lean teardown (after A–E proven):** see gotcha #2. Remove `src/app/research-v2/` (page + `managed-agents-prototype` + tests), `src/lib/media-plan/` (20 files) + `src/components/media-plan/` (10 files), `src/app/api/chat/media-plan-agent/route.ts`, `src/lib/managed-agents/` + `src/app/api/webhooks/managed-agents/route.ts`, the orchestrate `draft/deep/managed` branches, and dead `SECTION_TO_TOOL` entries — **with a dead-code trace first; keep the corpus path.**
- **Phase G — prod (DeepSeek-only):** prod-cutover gate after Phase D real-data proof; full teardown/promotion gate only after the seventh section, multi-URL proof, and soak gates. Key rotation = tracked follow-up, non-blocking.

## COMMIT & COORDINATION PROTOCOL
- **Atomic commits per task**, scoped messages (`fix(...)`, `feat(...)`, `test(...)`), end with the Co-Authored-By trailer. Commit/push only when asked.
- **Agent-bus:** mirror this board as the bus goal + post Phase-A tasks; update task state as you go (per D9). Claude reviews each PR/diff at the phase gate.
- **A2 + G** need the user (authenticated `:3100`, prod env) — flag, don't fake.
- Update `docs/2026-05-25-v2-wire-deepseek-ground-truth.html` (`§07` board + live-status header) at each phase close.

## DEFINITION OF DONE (overall)
Fresh onboarding → `/research-v3` (lab path) → shared corpus base → 6 sections use bounded real in-section tools and reveal live as a per-section paginated reader → Paid Media Plan synthesizes them on its own terminal page with the targeted #11 client-channel step → all DeepSeek, schema-valid, rendered, no error boundary, no synthetic/example.com artifacts, no section >270s, p95 watch-line tracked, ≥3 fresh URLs proven, 48h soak complete; legacy paths gone; frontend tsc/test/build green; worker build no worse than the known 6-error baseline until that baseline is separately retired; promoted to prod.
