# Autonomous Deslop + Wire Session — 2026-05-29 (overnight)

> **Operator asleep ~3h. Claude = HQ (plan/review/gate/commit). Codex (`xhigh`) = executor.**
> **Branch / SoR:** `feat/v2-lab-section-wire` @ baseline `25618cf8` (== `origin/main`). Lab-wire worktree only.
> **Grounded in:** `docs/2026-05-29-state-of-the-app-assessment.md` (the 22-agent audit) + `docs/2026-05-29-verifier-teeth-codex-handoff.md`.

## Goal (operator, verbatim intent)
Get the app into materially better shape: **deslop** (delete dead/duplicate architecture, merge, remove unused code), **wire** the unfinished-but-built machinery (verifier teeth, streaming), use the relevant skills to stay aligned. Stop when it's wired + desloped + committed with green gates. DeepSeek/Codex unlimited. Provider decision: **DeepSeek confirmed.**

## Stop condition (when I halt)
Dead architecture deleted (worker + frontend managed-agents) · verifier teeth wired · streaming/phase honesty wired (as far as safely lands) · all committed to `feat/v2-lab-section-wire` · **every commit gated green** (FE tsc/lint/test + worker build/test) · feat branch pushed (backup) · final report written. NO main push (auto-mode blocks it; operator fast-forwards on wake). NO deploy (standing flag).

## Operating rules (safety while unattended)
1. **Gate before every commit:** FE `tsc --noEmit` + `lint` + `test:run` for FE changes; worker `build` + `test:run` for worker changes. Never commit a red baseline. Reversible deletions only (git-tracked).
2. **Atomic commits**, one task each, path-scoped (`git commit -- <paths>`) so unrelated dirty files don't get swept.
3. **Codex edits only; Claude commits.** Codex runs `codex exec -C <lab> -c model_reasoning_effort=xhigh -s workspace-write` (can't commit — linked-worktree .git is outside its sandbox; that's intentional). I review the diff + gate + commit.
4. **Sequential on hot files** (`run-section.ts` is shared by verifier-teeth + streaming → never parallel). Parallel only on disjoint trees.
5. **Verify "dead" before deleting** (grep for live callers; look at the target).
6. Push `feat/v2-lab-section-wire` after each green commit (durable backup).

## Task plan + status

| # | Task | Executor | Files (disjoint group) | Status |
|---|---|---|---|---|
| 0 | Audit + verifier spec | Claude (done) | docs/ | ✅ committed earlier / drafted |
| 1 | **Deslop A:** delete dead worker agent tree (`research-worker/src/agents/` + `agent-tools/` + tests) | Claude | worker | 🟡 in progress (build gating) |
| 2 | **Deslop B (FE-1):** extract `buildCommitPatch`+`createSupabaseWebhookAdapter`→`research-v2/`; delete managed-agents runtime (agents/client/start-audit/signature/webhook-handler/supabase-adapter/section-artifact-schemas + __tests__) + webhook route + `MANAGED_AGENTS_*` flags. KEEP `schemas/` (task 4). | Codex | src/lib/managed-agents (runtime), api/webhooks | ⬜ queued |
| 3 | **Wire 1:** verifier teeth + sourceUrl enforcement (per handoff spec) | Codex | lab-engine/agents/run-section.ts + verification/ | ⬜ queued |
| 4 | **Deslop C (FE-2):** single-source section schemas — repoint ~8 renderer type imports off `managed-agents/schemas/` to the canonical lab-engine source (or pure-rename if shapes differ); delete `managed-agents/` entirely; keep `normalizePickedArtifact` boundary; tsc 0, no `as any`. | Codex | managed-agents/schemas, renderers | ⬜ queued |
| 5 | **Wire 2:** streaming/phase honesty — emit real per-section phase transitions (kill the hardcoded "Reading sources"); implement-or-delete dead "Wave X of Y" telemetry; wire partial streaming if it lands safely. | Codex | run-section.ts telemetry, supabase-run-store, audit-state, reader | ⬜ queued (after 3) |
| 6 | **Align:** doc-rot sweep (CLAUDE.md managed-mode block, CONTEXT.md, SKILL.md) → describe lab engine + DeepSeek provider-agnostic framing | Codex/Claude | docs, CLAUDE.md | ⬜ queued |
| 7 | Final: full gates, push feat, report | Claude | — | ⬜ |

## Running log
- `T0` Baseline `25618cf8`, gates trusted-green (re-verified by audit QA agent). codex 0.130.0 authed. lab-wire deps + .env.local present.
- `T1` Task 1 dispatched: dead worker tree staged for deletion, worker build gating in background.
