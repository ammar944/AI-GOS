# v3 Soak → Teardown → Promotion — Codex Handoff

> **Date:** 2026-05-26 · **Branch:** `feat/v2-lab-section-wire` · **Author:** Claude (spec) → Codex (execute)
> **Status of the build:** the v3 lab pipeline is **built and proven**. Perplexity `sonar-pro` corpus (Phase 1, s18) → DeepSeek 6-section fan-out → paid-media 7th section → real in-section tools → ≥3-cited-URL proof gate, all verified on **3 fresh authenticated URLs** (Ramp / Vanta / Webflow, s19) with 0 synthetic / 0 example.com / 0 Anthropic hits.
> **What's left is NOT new AI building.** It is: a 48h soak, a deletion-only teardown, and a production promotion. This doc specs all three.

---

## Gate reality (read first)

The ground-truth doc gates teardown (Phase F) and promotion (Phase G) behind:
`3 fresh URLs + paid-media terminal section + green baselines + 48h soak`.

**Three of those four are already met** by the s19 proof. **The only remaining blocker is the 48h soak.** Therefore:

- **Phase S (soak readiness)** is **ungated — Codex executes now.**
- **Phase F (teardown)** is **gated solely on a green 48h soak.** Spec it now, execute after the soak passes.
- **Phase G (promotion)** is gated on F + a human prod-cutover. Human-operated; Codex preps only.

---

## DECISION REQUIRED — provider scope (affects Phase F size)

The ground-truth budget/decisions lock says: *"DeepSeek rollout — provider-switch, reversible, default stays Anthropic."*

- **Default (this doc assumes this):** keep the Anthropic provider path present-but-gated. Teardown removes the legacy *modes/runtime*, **not** the Anthropic model option.
- **If you choose "DeepSeek-only" ("keep 1" = one provider):** teardown additionally rips the Anthropic corpus/section/skills paths. This **reverses a documented lock** and removes the metered fallback — higher risk. See **Phase F-provider** for the exact extra deletions; do not execute that sub-phase without explicit sign-off.

**👉 Owner: confirm `keep-anthropic-gated` (default) or `deepseek-only` before Phase F executes.**

---

## Codex execution contract

- Run every `codex exec` at `-c model_reasoning_effort=xhigh`.
- **Worker build baseline:** `cd research-worker && npm run build` currently emits **exactly 6 known baseline errors** (express/apify missing `@types/*`). "Green" = *no 7th error*, not zero. Capture the baseline BEFORE editing the worker.
- **Frontend gate:** `npx tsc --noEmit` = 0 errors.
- **Full verify (all phases):** `npm run test:run` (~1079 pass / 1 skip) · `npm run build` (exit 0) · `npm run lint` (0 errors / ~65 known warnings) · worker build = 6-error baseline.
- One atomic commit per sub-task; conventional-commit messages.
- Do not introduce model-routing splits or speculative infra (per project feedback: stay surgical).

---

# PHASE S — Soak readiness (EXECUTE NOW, ungated)

Goal: make the 48h soak *runnable and measurable*, and fix the one known reader bug that the soak will repeatedly hit.

## S1 — Fix the `runId` rehydrate-on-hard-refresh bug

```
GOAL:    A completed run, when its /research-v3 reader is hard-refreshed (cold SSR, no client state),
         rehydrates fully from runId — sections + paid-media + verdict all restored.
NON-GOALS: No redesign of the reader. No change to dispatch/orchestrate. Frontend only.
FILES (start surfaces — reproduce before trusting any of these):
  - src/app/research-v3/page.tsx           (runId from searchParams ~L87; hydrateFromRunId ~L131–161;
                                            rehydrate useEffect ~L165–180 — note it appears to hydrate
                                            only when phase === 'onboarding', which is the prime suspect
                                            for a COMPLETED run not restoring)
  - src/lib/research-v2/session-state.ts   (inferPersistedResearchV2State — phase inference from
                                            runId/researchResults/onboardingData/jobStatus)
  - src/lib/journey/research-realtime.ts   (polling on activeRunId; resets on runId change?)
CONSTRAINTS: Named exports, kebab-case, @/* imports. Match existing reader patterns.
STEPS:
  1. REPRODUCE FIRST. Load a completed run (use an s19 run id, e.g. Ramp 749f38ff-7e92-4ab6-aef8-5c06d19d48be)
     at /research-v3?runId=...&section=..., hard-refresh, record exactly what is lost (sections? verdict?
     paid-media tab? whole reader?). Do NOT assume the root cause.
  2. Trace from the reproduction to the phase-inference / hydrate gate. State the root cause in the commit body.
  3. Fix at the root (likely: rehydrate sections/paid-media for a completed run, not just the onboarding phase).
  4. Add a regression test that asserts a completed-run cold load restores sections + paid-media.
VERIFY: new test fails before / passes after; targeted reader tests green; tsc 0; build exit 0.
```

## S2 — Soak harness

```
GOAL:    A script that exercises the full v3 pipeline on a cadence over ≥48h and records every run's
         outcome, so regressions surface as data.
NON-GOALS: Not a load test. Not headless-bypassing the real flow for the primary signal.
APPROACH (recommended; implementation flexible):
  - PRIMARY (catches error-boundary + true end-to-end): a Playwright persistent AUTHENTICATED context
    (Clerk token refresh needs a live browser context — see src/middleware.ts; orchestrate/run-lab-section
    do auth()→401, src/app/api/research-v2/orchestrate/route.ts ~L157–167) that starts a /research-v3 run
    on a small rotating URL set every N minutes and asserts 6/6 + paid-media render with no error boundary.
  - SUPPLEMENT (higher-frequency stuck-queued watch, no UI): poll the read API directly.
CONSTRAINTS — abort conditions are mandatory (project rule: paid APIs never loop unbounded):
  - Soak runs DeepSeek-only (no Anthropic) to stay off the metered path; assert 0 Anthropic hits.
  - Hard cap total soak runs and cumulative cost (DeepSeek ≈ $0.10/run; bound Perplexity corpus calls).
  - Stop on first hard regression (see gate below) and on the run cap.
FILES: new scripts/soak-harness.ts (+ README). Reuse Supabase admin client at src/lib/supabase/server.ts.
VERIFY: dry-run (1–2 cycles) locally; confirm it records pass/fail per run and honors the run cap + abort.
```

## S3 — Soak monitoring / alerting

```
GOAL:    A watch that turns "is the soak healthy?" into a pass/fail readout, hooked to real signals.
SIGNALS (from src/app/api/research-v2/audit-state/route.ts):
  - research_artifacts.status == 'error'                 → audit-level failure
  - research_section_runs.status == 'error'              → section failure
  - research_section_events where event_type == 'error'  → failure breadth
  - STUCK-QUEUED: a section_run in 'queued'/'running' past its staleness threshold
    (dispatch thresholds: default 5min, corpus 15min — src/app/api/research-v2/dispatch/route.ts ~L66–69)
    without children_complete advancing.
NOTE: observability today is DB-resident (research_section_runs.telemetry JSONB + research_section_events),
      not an external tracer. If Langfuse/OTel is in fact wired, prefer extending it; otherwise build the
      DB-polling watch. Confirm which before building.
VERIFY: point the watch at an s19 run id and confirm it reports "healthy/complete"; simulate an 'error'
        row and confirm it flags.
```

---

# SOAK RUN (human-operated gate)

Deploy the branch to a **stable preview** (Vercel preview + `cd research-worker && railway up` — NOT main),
run S2 against it for ≥48h, watch via S3.

**Green-soak pass criteria (unblocks Phase F + G):**
- ≥48h continuous, zero error-boundary regressions, zero stuck-queued runs that don't self-resolve.
- Section p95 stays under the 180s watch-line (s19 was 107–139s).
- 0 Synthetic / 0 example.com / 0 Anthropic in artifact sweeps.

---

# PHASE F — Lean teardown (GATED on green soak · verify-first)

Deletion only. The ground-truth keep-list is load-bearing — **over-deletion breaks the build**, so Codex
runs a discovery pass to produce the exact diff, then deletes, then proves green. The lists below are a
**verified prior** (all CONFIRMED-DELETE paths were checked to exist 2026-05-26), not a blind kill-list.

### F-core — CONFIRMED DELETE (exist; unconditional)
- `src/app/research-v2/page.tsx` — old landing page, replaced by `/research-v3`
- `src/app/research-v2/__tests__/page-corpus-transition.test.tsx` — orphan test (deletes with page)
- `src/app/research-v2/__tests__/page-one-pager.test.tsx` — orphan test
- `src/app/research-v2/managed-agents-prototype/` — prototype route (already 404-gated)
- `src/components/research-v2/audit-reader-shell.tsx` — v2-only renderer; `/research-v3` uses `BattleshipShell`
  (VERIFY: `grep -rn "audit-reader-shell\|AuditReaderShell" src/` returns only the v2 page + its tests)
- `src/lib/managed-agents/` — managed-mode runtime (Phase-1 legacy, superseded by the lab engine)
- `src/app/api/webhooks/managed-agents/route.ts` — managed-agents webhook ingress

### F-core — REFERENCES TO CLEAN (deletes above leave dangling refs)
- `src/app/api/research-v2/orchestrate/route.ts` — remove the `'managed'` branch (~L219–262) and collapse
  the `executionMode` enum from `['draft','deep','managed','lab']` → `['lab']` (the proven path).
  draft/deep are legacy worker modes (~L285–292); confirm the worker still needs a mode arg or drop it.
- All 6 `MANAGED_AGENTS_*` reference sites: `src/app/api/webhooks/managed-agents/route.ts`,
  `src/app/api/research-v2/orchestrate/route.ts`, `src/lib/managed-agents/{client,webhook-handler,agents,start-audit}.ts`
  → after deleting the managed-agents tree, remove the flag reads + env-var docs (CLAUDE.md, .env examples).
- `src/middleware.ts` — remove the `/research-v2/managed-agents-prototype` allowlist entry.

### F-core — VERIFY-FIRST (ambiguous; Codex confirms before deleting)
- **Old media-plan pipeline `src/lib/media-plan/*`** — the PRE-v3 standalone generator, distinct from the
  lab-engine paid-media 7th section. It may still back `/api/chat/media-plan-agent` (post-research review).
  Decide WITH the owner: is the old review tool being retired too? Confirm lab-engine does NOT import it:
  `grep -rn "lib/media-plan" src/lib/lab-engine src/app/api/research-v2` (expect none).
- **draft/deep mode removal** — confirm no live caller passes `executionMode: 'draft'|'deep'` before collapsing.

### F — KEEP (DO NOT DELETE — load-bearing)
- **All `src/app/api/research-v2/*` routes:** orchestrate, dispatch, run-lab-section, rerun-section,
  onboarding, audit-state, abort-section, chat, _capabilities. (These ARE the v3 backend.)
- `src/lib/research-v2/*` — the shared state machine / session / orchestration logic (v3 depends on it).
- `src/lib/lab-engine/*` — the execution engine, section registry, the paid-media 7th section schema.
- Lab tool adapters, registry allowlists, the live-tools gate, schema mirrors.
- The Railway corpus path (`deepResearchProgram` on the worker).
- `/research-v3` flow + `src/components/research-v3/*`.

### F-provider — CONDITIONAL (only if `deepseek-only` is signed off; else SKIP)
Removes the Anthropic option entirely (reverses the reversible-switch lock):
- `research-worker/`: `src/anthropic-skills.ts`, Anthropic client/auth in `src/runner.ts`, anthropic status in
  `src/capabilities.ts`, `@anthropic-ai/sdk`-based tool wrappers.
- `src/lib/ai/providers.ts`: Anthropic provider + `CLAUDE_*` model maps.
- Drop `@anthropic-ai/sdk` from `package.json` (frontend + worker) only after the above compile clean.
- KEEP regardless: `deepResearchProgram` corpus (provider-agnostic) and orchestrate routing.

**Phase F VERIFY:** worker build = 6-error baseline (no 7th) · `npx tsc --noEmit` 0 · `npm run test:run` green
(sweep for orphan tests referencing deleted modules) · `npm run build` exit 0 · `npm run lint` 0 errors.

---

# PHASE G — Promotion (human ops; Codex preps only)

```
GATED ON: green soak + Phase F + human prod-cutover decision.
STEPS:
  1. PR feat/v2-lab-section-wire → main (Codex drafts PR body: scope, proof links, gate evidence).
  2. Confirm prod env: DeepSeek key, RESEARCH_DEEP_PROGRAM_MODEL=sonar-pro, ORCHESTRATOR_CONCURRENCY,
     route maxDuration=300 (Vercel Pro). (Human — secrets.)
  3. Deploy worker separately: cd research-worker && railway up. (Human.)
  4. Authenticated production proof: 1 fresh URL → 6/6 + paid-media, 0 synthetic/example/Anthropic.
  5. Follow-up (not a blocker): key rotation; rollback = previous Vercel deploy.
```

---

## Open items folded in (not blockers)
- **runId rehydrate** → S1 above.
- **T1.1 paid-Anthropic E2E** → stays gated/optional; DeepSeek superseded it. No action unless `deepseek-only`
  is rejected and you want the Anthropic E2E proven.
- **Langfuse/OTel** → confirm whether wired; if not and you want prod tracing, that's a post-G add, not a gate.

## Sources
- `docs/2026-05-25-v2-wire-deepseek-ground-truth.html` (live log, sessions 18–19; Phase F/G gate + keep-list)
- `docs/2026-05-26-v3-scope-and-plan.md`, `docs/2026-05-26-v3-codex-goal-handoff.md` (9 decisions / 7 phases)
