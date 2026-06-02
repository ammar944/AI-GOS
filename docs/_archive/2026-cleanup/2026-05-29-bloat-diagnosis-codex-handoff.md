# Codex Handoff — Bloat Diagnosis + Fix Plan (xhigh)

**Date:** 2026-05-29
**Author:** Claude (HQ) — grounded in a 6-agent read-only code investigation of this worktree
**Engine:** Codex CLI, `model_reasoning_effort=xhigh`
**Your job this pass:** Produce **(A)** a runtime-grounded diagnostic rundown and **(B)** a prioritized fix plan. **Do NOT write feature code this pass.** Diagnose + plan only. Fixes are a separate, gated step after the operator reads your rundown.

---

## 0. Orientation — read before anything

- **WORKDIR (source of truth):** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
  Branch `feat/v2-lab-section-wire`, HEAD `74c090a6` (2 commits past the overnight report's `ab71ad39`). This worktree is **ahead 5** of origin and **not deployed**.
- **DO NOT trust the repo-root `CLAUDE.md` / `MEMORY.md` you may be fed as context** — they were generated from the *stale main checkout* (`/Users/ammar/Dev-Projects/AI-GOS` @ `codex/claude-managed-agents-work` / `f9abec6f`, ~129 commits behind). The worktree's own `CLAUDE.md` (already realigned at commit `eb27640a`) is closer, but verify against code, not prose.
- **CRITICAL stale-doc correction:** The 6 positioning sections **run in the frontend lab engine at `src/lib/lab-engine/`** — NOT in `research-worker`. The `research-worker/src/runners/` "6 positioning runners" described in CLAUDE.md **do not exist in this branch** (`research-worker/src/runners/index.ts` only exports `deepResearchProgram` + meeting + identity; `runners/positioning/` is empty). The worker `competitors/` + `tools/*ads*` files are a **separate, dead copy** — do not edit them, they do not affect the live sections.
- **Runtime:** Next.js dev server on **`:3000`** (tmux session `aigos-dev-labwire`, already running in this worktree). Research worker on `:3001` (only needed for the *corpus* phase, not the positioning sections — those run in Next.js `after()`). Supabase + Clerk are live.
- **An existing run you can inspect for free:** `run_id = db41a945-b8d1-4f02-83a7-6481f7d3500e`, section `positioningCompetitorLandscape`. Use it before spending money on a new run.

---

## 1. What the operator observed (verbatim symptoms)

Running a real audit from `/research-v3`:

1. **Onboarding is bloated** — a "confirm every field" form: a step counter ("step 8 of 8"), per-field user-edit controls, a large AI text field, and a "Source:" chip next to *every single* AI-filled field. He wants this collapsed to **one minimal confirm screen**.
2. **Run Audit, first ~10s:** nothing.
3. **Next ~10s:** section labels appear ("market & category… running") but all 6 sections sit at **"0% preparing context"** with nothing streaming.
4. **Eventually** some activity + "searching source evidence" appears, but **no section body ever streams in** — the section just *appears* atomically.
5. **Section 5 failed.**
6. **The 3rd (competitor) section took a very long time.**
7. **"No tools wired in"** — he saw no tools firing and **no competitor ads** in the output, and suspects the previous two workflows never actually wired the competitor-ad engine.

---

## 2. Grounded hypotheses (from code) — your job is to confirm/refute each at RUNTIME

I already traced the code. Below is what the code says + the exact runtime check that settles it. **Validate every one against a real run / the DB / the env — do not take my word for it.**

### H1 — Onboarding bloat: it's one component, safe to gut, but it's SHARED
- The entire "confirm every field" UI is **one file**: `src/components/onboarding/onboarding-wizard.tsx` (~990 lines).
  - Step counter + progress bar: **687–712** (`'Step {currentStep+1} of {SECTION_META.length}'`, =8).
  - Desktop step-rail: **714–826**; mobile step-rail: **828–905**.
  - `FieldStateBadge` (the colored "AI-filled / Needs review" chip next to every field): component **159–174**, used at **395**.
  - Per-field **"Source: &lt;url&gt;"** chip: **398–402**.
  - Per-field editable controls (`renderField`/`renderFieldControl`): **352–578**.
  - Header literally reads **"GTM Brief Review" / "Confirm every field"**: **586–610**.
  - Large AI textareas: driven by `SECTION_META` field types in `src/lib/research-v2/onboarding-v2-types.ts:285-484`.
- **Load-bearing submit contract that MUST survive any redesign:** `handleSubmit` (**337–350**) validates the full `OnboardingV2Schema` (~30 required fields, `onboarding-v2-types.ts:162-204`) and calls `onComplete(parsed.data, buildOnboardingReviewMetadata(...))`. `research-v3/page.tsx` (**445–457, 554–570**) then POSTs to `/api/research-v2/onboarding` (server route `src/app/api/research-v2/onboarding/route.ts:38-54` re-validates `OnboardingV2Data` **and** `OnboardingReviewMetadata` — `fieldCount`, `pinnedFieldKeys`, `fields`) and only **on success fires `POST /api/research-v2/orchestrate`**. Drop the review metadata → 422 → orchestrate never fires.
- **⚠️ SHARED COMPONENT:** `/research-v2/page.tsx` (~543) mounts the **same** `OnboardingWizard`. Gutting it changes **both** v2 and v3.
- **Dead code (separate cleanup):** `src/components/onboarding/step-*.tsx` are only re-exported from `index.ts` and never rendered.
- **CONFIRM AT RUNTIME / WITH OPERATOR:** (a) Is the redesign **v3-only (fork the component)** or **shared (change both)**? (b) Does "no per-field edit" mean *read-only values with one Edit escape hatch*, or *keep inputs but drop the badge/source/reasoning chrome*? (c) "Large AI field" = a specific field or just that textareas render big? These are taste decisions — surface them, don't guess.

### H2 — Frozen "0% / preparing context" feed: events are BUFFERED, not flushed live
- **Root cause:** all 6 sections run via `runSectionViaAnswerTool` (`src/lib/lab-engine/agents/run-section.ts:2736-3108`). Its `onStep` callback (**~2842-2851**) **buffers tool events into a local array** and `flushBufferedEvents` (**2792-2797**) only runs **after the whole attempt resolves** (post-attempt **2888**, post-repair **2970**, or on a **120s** first-step stall **2868**). So for the entire multi-minute model loop, the newest *persisted* event stays `skill-loaded`.
- `deriveSectionPhase` (`src/app/api/research-v2/audit-state/derive-section-phase.ts:9-41`) keys off the **latest persisted event_type** → with `skill-loaded` newest it returns "Compiling context" → the feed shows **"Preparing context"** frozen. When the buffer finally flushes, phase jumps straight to "Searching source evidence" (the late burst the operator saw).
- **The "0%" is a different widget:** `SectionProgressStrip.completionPercent = round(completedCount/6*100)` (`src/components/research-v2/audit-reader-shell.tsx:815-884`) counts only **fully-committed sections**. There is **no per-section percent anywhere** — it's structurally pinned at 0 until a whole section commits.
- **Dead air at start:** `research-v3/page.tsx` fires orchestrate fire-and-forget and immediately mounts `AuditReaderShell` (**445-457, 562-570**); the first `use-audit-state` poll (`POLL_MS=2500`, `src/lib/research-v2/use-audit-state.ts:15`) returns empty until `seedOrchestration` writes rows **and** the worker reaches its first `appendEvent`. With zero events, `LiveActivity` renders only a spinner + skeleton.
- **The reader is 100% poll+DB — no SSE/WS** (Wave-2 handoff confirms). Every live signal must be DB-persisted to be seen.
- **CONFIRM AT RUNTIME:** Query `research_section_events` for a running section — do `tool-started`/`tool-finished` rows **cluster at the end** of the section (proves buffering) or arrive incrementally? Time the gap between orchestrate POST and the first event row.

### H3 — No body streaming: confirmed architecture fork (likely a DECISION, not a fix)
- Confirmed: the 6 sections use `agent.generate()` (blocking, `src/lib/lab-engine/agents/section-agent.ts:394`) and emit the entire section as **one atomic `answer` tool call** ("Submit the final structured section output as a single JSON object. Do not call with empty or partial input." — `answer-tool.ts:52-82`). `saveArtifact` commits the whole body in one patch (`supabase-run-store.ts:346-352`); the reader only renders `TypedArtifactRenderer` at `status==='complete'` (`audit-reader-shell.tsx:1508-1562`).
- A token/partial-streaming path **exists but is dead code** (`streamRunSection` / `streamSectionViaAnswerTool` / `writeArtifactPartial` / `data-artifact-partial`, `run-section.ts:408-507, 3110-3408`) — **zero production callers** (`lab-section-job.ts:41` wires only `runSection`).
- **The coupling cost (why this is a fork):** `structuralVerifier` (`run-section.ts:2679-2683`) + `evaluateEvidenceSupport` (`verification/evidence-support.ts:41-72`) require the **complete body** to extract and gate numeric/url claims; the repair loop rewrites the whole answer on a shortfall. Streaming the body before verification would show un-verified, possibly-fabricated numbers that then mutate on repair — directly conflicting with the no-fabricated-data invariant.
- **RECOMMENDATION to validate:** the operator's "watch it write" desire is better served by **making the existing phase/tool events live (H2)** than by reviving body streaming. Confirm whether he wants true token streaming (the fork) or just a live-advancing feed. Frame this as a decision in your rundown.

### H4 — "No tools / no competitor ads": the engine IS wired; a runtime KILL SWITCH disables it
**This refutes the operator's suspicion at the code level — the wiring is real.**
- `positioningCompetitorLandscape` declares `allowedTools = [web_search, firecrawl, adlibrary, google_ads, meta_ads, reviews]` (`src/lib/lab-engine/sections/section-registry.ts:143-152`).
- `buildToolMap` (`agents/tool-registry.ts:11-23`) wraps each allowed tool with a budget and passes a real `Record<string,Tool>` to the model (`run-section.ts:3471-3499, 3830-3858`).
- CompetitorLandscape additionally runs a **deterministic ad probe** (`run-section.ts:3539-3546` → `runCompetitorAdProbeSteps` **2179-2286**) that directly calls `google_ads.execute` + `meta_ads.execute` for up to 5 advertisers.
- `google_ads`/`meta_ads` delegate to `adLibraryAgentTool` (`tools/google-ads.ts`, `tools/meta-ads.ts`) which makes **live SearchAPI HTTP calls** to `https://www.searchapi.io/api/v1/search` (engines `google_ads_transparency_center*`, `meta_ad_library*`) — `tools/adlibrary.ts:219, 471-567, 636`. **Not a mock.** `tools/_shared.ts:82-97` = real `fetch()`.
- **THE KILL SWITCH (most likely root cause):** `getLabEngineAllowedTools()` in `src/lib/research-v2/lab-section-job.ts:88-90` returns `[]` (strips ALL tools from EVERY section) when **`process.env.LAB_ENGINE_LIVE_TOOLS === 'false'`**. With no `google_ads`/`meta_ads`, the probe takes its missing-tool branch and emits a `not_implemented` gap → **no ads, no tool activity**.
- **Repo docs admit the proof runs never exercised live tools:** `docs/2026-05-25-v2-wire-deepseek-ground-truth.html:439` — *"the accepted s25 proof used the cached Notion corpus with live tools disabled."* The one live-tools attempt "stalled on Voice/Demand and was not counted."
- **CONFIRM AT RUNTIME (this is the single highest-value check — Step Zero):**
  1. What is `LAB_ENGINE_LIVE_TOOLS` in the running dev server's env? (If it's the string `'false'`, that alone is the whole "no tools" complaint. `LAB_ENGINE_LIVE_TOOLS` is **not a secret** — you may print it.)
  2. Is `SEARCHAPI_KEY` **present** (presence only — **do not print it**)? Absent → `adlibrary` returns a `missing_credential` gap (`adlibrary.ts:636-639`).
  3. For `run_id db41a945`, inspect the CompetitorLandscape events: `google_ads`/`meta_ads` steps with `type:'result'` + non-empty `ads[]` (firing) vs `type:'gap'` with `reason: missing_credential | not_implemented | api_error` (the `message` tells you which).

### H5 — "Section 5 failed" = DemandIntent, most likely a quota gate
- Pipeline order: 1 MarketCategory, 2 BuyerICP, **3 CompetitorLandscape**, 4 VoiceOfCustomer, **5 DemandIntent**, 6 OfferDiagnostic.
- DemandIntent has the **strictest minimums** of any section: `validateDemandIntentMinimums` (`src/lib/lab-engine/artifacts/schemas/demand-intent.ts:132-192`) requires ≥10 keywords, ≥10 questions across ≥2 surfaces, ≥5 intent signals across ≥2 types, ≥4 venues across ≥2 types, ≥3 content gaps, ≥5 sources — on `.strict()` schemas.
- The answer-tool path allows only `answerToolMaxRepairAttempts = 2` (`run-section.ts:693`) before throwing `SectionRunnerError` (**3022-3030**). If the model under-produces and one repair doesn't close *every* quota, the section fails terminally.
- **NOT the verifier gate:** `getMaxUnsupportedAllowed` defaults to `Infinity` (`evidence-support.ts:56-72`) unless `LAB_VERIFIER_MAX_UNSUPPORTED` is set — off by default.
- Failure **is visible**: `section-failed` event → `derive-section-phase` "Needs review" → `section-card.tsx:132-166` renders a red card + Retry.
- **CONFIRM AT RUNTIME:** Read the `section-failed` event `metadata.error` string for the `positioningDemandIntent` `section_run_id` in the failing run. It contains the exact cause (e.g. `body.keywordDemand.keywords: have 6, need >=10`, or a Zod issue path, or a timeout). **This one value decides quota-miss vs Zod-parse vs timeout vs stall.**

### H6 — Competitor section slow + a TIMEOUT-HIERARCHY BUG
- CompetitorLandscape is structurally the heaviest: largest schema (8 body sub-sections, `competitor-landscape.ts:232-243, 301-641`), most tools (6) + `maxExternalLookups=6`, heaviest per-field URL validation, **and** the serial 5-advertiser ad probe that runs *before the model starts* (`run-section.ts:2179-2286, 2244-2283`).
- **Bug:** `LAB_SECTION_JOB_TIMEOUT_MS = 270_000` (`src/lib/research-v2/lab-section-dispatch.ts:14`) is **shorter** than the answer tool's own `answerToolTimeoutMs = 540_000` (`run-section.ts:680`), and the route `maxDuration` is `300` (`run-lab-section/route.ts:33-36`). So a slow CompetitorLandscape gets **guillotined at 270s** and recorded as a failure mid-flight, even though the answer tool thinks it has 540s.
- All 6 sections fan out simultaneously (`orchestrate/route.ts:86-149`, `Promise.allSettled`, **no concurrency cap** in this live path) into separate serverless invocations — they may contend on a shared upstream rate limit.
- **CONFIRM AT RUNTIME:** Did CompetitorLandscape **complete** (slow) or get **aborted at ~270s** (failed)? Check its final event/status and the elapsed time between `section-started` and terminal event.

---

## 3. Feature-flag reality (verified by grep — don't hunt for ghosts)
Only **three** env knobs are read in code:
- `LAB_ENGINE_PROVIDER` — `src/lib/lab-engine/ai/models.ts:54-72`. Default `anthropic` (Sonnet 4.5) when unset; valid: `anthropic | deepseek-direct | deepseek-ollama`.
- `LAB_VERIFIER_MAX_UNSUPPORTED` — `verification/evidence-support.ts:22-23, 56-72`. Unset/empty/NaN ⇒ `Infinity` ⇒ commit-with-honest-badge (gate does **not** block by default).
- `LAB_ENGINE_LIVE_TOOLS` — `lab-section-job.ts:88-90`. `'false'` ⇒ all tools stripped; anything else/undefined ⇒ per-section allowlists active.

**Zero code reads** for `ENABLE_POSITIONING_ORCHESTRATOR`, `NEXT_PUBLIC_ARTIFACT_UI_V2`, `NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS`, `ORCHESTRATOR_CONCURRENCY`, `MANAGED_AGENTS_POSITIONING_ENABLED` — legacy/deleted. Don't look for them.

---

## 4. What to do (procedure)

> **Cost discipline:** lead with the free DB/env checks. At most **ONE** controlled paid run (~$1.50–2) — **no loops** (project rule). State the run you did and stop.

**Step Zero (free — likely confirms H2, H4, H5):**
1. Read the dev server's effective env for `LAB_ENGINE_LIVE_TOOLS`, `LAB_ENGINE_PROVIDER` (print these — not secrets), and **presence** of `SEARCHAPI_KEY` + `ANTHROPIC_API_KEY` (presence only). Use `tmux capture-pane`/process env or your shell; per security rules, never print secret values.
2. Query Supabase (use the supabase MCP, `supabase` CLI, or psql with the connection already configured for this app — do not print credentials) for `run_id db41a945-b8d1-4f02-83a7-6481f7d3500e`:
   - `research_section_events` for `positioningCompetitorLandscape`: are `tool-started`/`tool-finished`/`gap` rows present? `result` with `ads[]` or `gap` with a `reason`? Do they cluster near the end (buffering)?
   - `research_artifact_sections` (or the failed `section-failed` event) for `positioningDemandIntent`: the exact `metadata.error`.
   - Timestamps to measure the startup dead-air and CompetitorLandscape elapsed time.

**Step 1 (one controlled grounding run, only if Step Zero leaves gaps):**
- Ensure `LAB_ENGINE_LIVE_TOOLS` is **not** `'false'` and `SEARCHAPI_KEY` present, then **rerun the single section** `positioningCompetitorLandscape` (cheapest path; reuse `run_id db41a945` via the rerun-section flow) — or a fresh full run if you must see all 6. Watch the event stream live.
- Capture: do ad tools fire with non-empty `ads[]`? Do events arrive incrementally or in an end-burst? Per-section timings. Does DemandIntent fail again + with what error?

**Step 2 — DELIVERABLE A (the rundown):** Per symptom (1–7): **Confirmed / Refuted / Partial**, the evidence (event rows, error strings, env values, timings), and the root cause. Explicitly correct the operator's "tools were never wired" belief with the kill-switch evidence (or, if Step Zero shows tools *were* on and still produced nothing, chase the next cause: `SEARCHAPI_KEY`, advertiser-match rejection in `advertiser-match.ts`, or budget exhaustion).

**Step 3 — DELIVERABLE B (the fix plan / the "workflow"):** Prioritized, each item = `title · files+lines · change · risk · verification`. Tag each as **[safe-to-execute]** (mechanical, no taste call) or **[needs operator decision]**. Suggested shape to refine against your runtime findings:

- **P0 [safe] Make tools actually fire:** confirm/flip `LAB_ENGINE_LIVE_TOOLS` (off-or-unset) + `SEARCHAPI_KEY` present. Add an explicit "live tools disabled" activity event when `getLabEngineAllowedTools()` returns `[]` so corpus-only mode is never again mistaken for broken wiring (`lab-section-job.ts:88-90`).
- **P0 [safe] Fix the timeout hierarchy:** reconcile `LAB_SECTION_JOB_TIMEOUT_MS` (270s) vs `answerToolTimeoutMs` (540s) vs route `maxDuration` (300s) so slow sections finish instead of being guillotined (`lab-section-dispatch.ts:14`, `run-section.ts:680`).
- **P1 [safe] Kill the frozen feed:** flush tool events **inside** `onStep` (await/fire-and-forget `appendEvent` per step, wrapped in try/catch so telemetry never aborts the run) instead of buffering to attempt-end; emit an early "reading sources" heartbeat after `skill-loaded`; optionally seed a `section-started` row synchronously to kill the startup dead-air (`run-section.ts:2842-2851, 2789`; mind the `flushBufferedEvents` cursor ordering at `2791-2797`).
- **P1 [needs decision] Onboarding redesign:** collapse `onboarding-wizard.tsx` to one minimal confirm screen (drop step machinery, per-field source chips, `FieldStateBadge`, heavy per-field chrome), **preserving** the `onComplete` + `buildOnboardingReviewMetadata` submit contract and the full `OnboardingV2Schema` payload. **Decision needed:** v3-only fork vs shared change (it's mounted by `/research-v2` too); read-only vs editable; what "large AI field" means.
- **P1/P2 [needs decision] "Watch it write":** decide live-event-feed (recommended; built on P1) vs true body token-streaming (architecture fork that conflicts with the verifier teeth — `evidence-support.ts`, `structuralVerifier`). Spell out the trade-off; recommend the feed.
- **P2 [safe-ish] DemandIntent failure:** pin to the actual `metadata.error` first; then soften `validateDemandIntentMinimums` to what the model reliably produces, or raise `answerToolMaxRepairAttempts`, or strengthen the SKILL.md counts — note this touches a quality gate.
- **P2 [safe] The "0%" chrome:** relabel (it's sections-complete, not progress) or wire a real per-section percent from phase ordering (`audit-reader-shell.tsx:815-884`).
- **P3 [safe] Doc-rot:** the worker `competitors/` + `runners/positioning/` dead trees; add `LAB_VERIFIER_MAX_UNSUPPORTED` to CLAUDE.md's live-knob list; note `MANAGED_AGENTS_*` is fully removed.

**Then STOP and present.** Do not start fixing — the operator wants to read the rundown and choose what the fix workflow tackles.

---

## 5. Non-goals / guardrails
- No feature code this pass (trivial temporary instrumentation to capture evidence is OK if reverted).
- No paid-run loops — one controlled run max.
- Don't touch `research-worker/src/competitors/`, `research-worker/src/runners/positioning/`, or worker `tools/*ads*` — dead in this branch.
- Don't reintroduce sequential single-section dispatch; orchestrate fan-out is canonical.
- Never read/print `.env*` or secret values; assert presence only.

## 6. Verification baseline (re-confirm from the worktree before/after)
At HEAD `74c090a6`: **FE** `npx tsc --noEmit` = 0, `npm run lint` = 0 errors (67 warnings), `npm run test:run` = 1139 passing. **Worker** (`cd research-worker`) build = 0, 324 tests. The worker has its own pre-existing `@types/*` baseline — capture it separately, don't inherit the FE gate. Baselines track the moving HEAD, so re-run rather than trusting any doc number.

## 7. Output
Write your two deliverables to `docs/2026-05-29-bloat-diagnosis-RUNDOWN.md` in this worktree, and print the prioritized fix plan (Section 3 above, refined) to stdout for the operator. Cite `file:line` for every claim, and for each of symptoms 1–7 state Confirmed/Refuted/Partial with the runtime evidence.
