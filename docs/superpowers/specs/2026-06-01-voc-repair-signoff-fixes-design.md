# Design — Close the E2E sign-off blockers (VoC timeout, repair storm, stale-artifact)

**Date:** 2026-06-01 · **Branch:** `feat/v2-lab-section-wire` · **Base:** `8243ac52`
**Author:** Claude (HQ, ultracode) · validated by a 14-agent diagnostic workflow + adversarial verification + independent code trace.

## Problem (from live run `210ee90b` @ `8243ac52`)
- `positioningVoiceOfCustomer` → `status=error` "lab section job timed out after 270000ms"; its artifact section stayed `running, sourceCount=0, error=null` (frozen card).
- System-wide repair storm: 5-6 repair events per section. Competitor 273.9s (worse than prior 186.8s).

## Validated causal model — one spine + one independent bug

### Spine: the repair loop is decoupled from the evidence gate
- Repair continue-condition: `attempt.artifact === null || attempt.evidenceSupportShortfall !== undefined` — fires on the **raw presence** of any unsupported load-bearing claim (number/url, +quote for VoC).
- Actual pass/fail gate: compares unsupported count against `maxUnsupportedAllowed` = `getMaxUnsupportedAllowed` = **Infinity by default** (`LAB_VERIFIER_MAX_UNSUPPORTED` unset). The gate **never rejects**.
- Net: every section burns up to `answerToolMaxRepairAttempts = 2` full agentic re-runs (fresh `ToolLoopAgent`, ≤12 steps, re-invoking live tools) to ground claims it will accept regardless. **Wasted work = the storm = the latency multiplier behind B4 and VoC's timeout.**
- Lives in BOTH paths: production `runSectionViaStructuredBodyStream` and fallback `runSectionViaAnswerTool` (duplicated loops). Production is default (`LAB_SECTION_STREAMING` ON).

### VoC accelerant
`buildVoiceOfCustomerCandidatePrepass` runs on the critical path: up to 3 **serial** live tool calls (reviews → web_search → firecrawl) with **no deadline** (Competitor's ad probe IS bounded to 30s). The answer-tool `overallDeadline` is recomputed `Date.now()+255s` **after** the prepass, so prepass time is excluded and the inner 255s guard cannot fire before the outer **270s** job `AbortController` (`LAB_SECTION_JOB_TIMEOUT_MS`). Prepass + draft + 2 tool-heavy repairs > 270s.

### Independent bug: asymmetric terminal write
`markSectionError` (`supabase-webhook-adapter.ts`) updates **only `research_section_runs`** (→error). The commit path (`commit_artifact_section` RPC) writes **both** tables. So a failed/timed-out section leaves `research_artifact_sections` stale at `running, error=null`. The reaper can't heal it (its guard needs `status='running'`, but the row is now `error`). `sourceCount=0` is a symptom of abort-before-commit.

### Myths killed
- Zombie/duplicate-runner theory **disproven**: `claim_section_run` is live in the DB; the storm survives it → gate-driven, not duplicate-driven.
- `20260601_claim_section_run.sql` is **already applied** (out-of-band; not in tracked history). Removed from task list.

## Fixes (full close-out, approved)

**#1 — Re-tie repair trigger to the gate.** Shared helper `shouldRepairAttempt(attempt, maxUnsupportedAllowed)` = `attempt.artifact === null || getUnsupportedLoadBearingCount(attempt) > maxUnsupportedAllowed`. Replace the condition in both repair loops. With default Infinity gate, unsupported-claim repairs become a no-op (artifacts already commit today → provably no-worse). Real schema/Zod failures (`artifact === null`) still repair. Grounding pressure stays available via finite `LAB_VERIFIER_MAX_UNSUPPORTED`. *Gate + unit verifiable.*

**#2 — `markSectionError` dual-table write (migration-free TS).** After the `research_section_runs` update, add a guarded `research_artifact_sections` UPDATE (`status='error'`, `error=<payload>`, `updated_at=now()`) scoped to the section's `artifact_id`+`zone`, guarded `.neq('status','complete')` so it can't clobber a committed sibling. *Gate + unit verifiable.*

**#3 — Bound + parallelize VoC prepass.** Wrap prepass tools in a ~45s timeout signal (same pattern as `competitorAdProbeDeadlineMs`); run reviews+web_search concurrently, firecrawl as optional recovery. Make the answer-tool/structured `overallDeadline` subtract elapsed prepass time so the inner guard fires before 270s. *Deadline sizing calibrated by live run.*

**#4 — Section-level cumulative budget + abort guard.** `sectionDeadline = sectionStart + answerToolTimeoutMs`; each attempt's `overallDeadline = min(passed-in, Date.now()+255s)`; at the top of each repair loop, break-and-commit `bestCommittableAttempt` (or terminal-fail) once near `sectionDeadline`, and short-circuit on `input.signal.aborted`. Makes 270s structurally unreachable from the repair path. *Abort-guard part: gate verifiable; budget sizing: live calibration.*

**Quick wins:** fix the false "255s is the binding inner guard" comment (`run-section.ts:719-733`); trim `competitorAdProbeDeadlineMs` 30s→~15s.

## Non-goals / gated
- No new migration (terminal-write is TS-only per decision). Dedicated RPC = optional later hardening.
- `20260601_research_section_events_zone_index.sql` stays unapplied (user-gated).
- No push/deploy (user-gated). `LAB_VERIFIER_MAX_UNSUPPORTED` stays at its current default; flipping it finite is a separate product call.

## Verification
All 5 gates green (tsc 0 · lint 0 · tests · app build · worker build). Then ONE live ramp.com E2E in Codex confirms VoC fits under budget, repair counts drop, failed sections render clean cards, and calibrates #3/#4 sizing. Handoff doc to be written.

## Residual unknowns the live run resolves
1. VoC prepass wall-clock + repair-iteration count → whether #3 deadline alone closes the gap or #4 budget is also load-bearing.
2. Dominant validation failure: strict Zod parse (enum/url/8192-token truncation) vs `validateMinimums` (cardinality). If token truncation, high-cardinality sections may need a `structuredOutputMaxTokens` raise (not covered by #1).
3. Per-repair latency under live tools — if one repair ≈150-250s, #1 is a hard prerequisite, not just the biggest lever.
