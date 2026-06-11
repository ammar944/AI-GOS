# Architecture Deepening Plan — 2026-06-09

> Status: **APPROVED, in execution** on branch `refactor/architecture-deepening`.
> Goal: turn the highest-friction shallow/leaky modules in the research pipeline into **deep** modules — concentrate the recurring bug class, make the engine AI-navigable and unit-testable.
> Full verified findings + dependency graph + Phase-1 design + adversarial stress output: `docs/plans/2026-06-09-architecture-deepening-workflow-output.json`.

## How this plan was produced
4 parallel Explore agents found friction → a 13-agent ground-truth workflow (`aigos-arch-groundtruth`) **verified every claim against real code** (file:line + snippet), built the dependency graph, designed Phase 1, and **adversarially stress-tested** it (verdict: *needs-revision*; the six holes are folded in below). Three candidates got cheaper once verified.

## Locked decisions (2026-06-09)
- **Ship cadence:** ONE feature branch, each phase a revert-granular commit, **one** live ~$2 E2E gate at the end (`scripts/zz-verify-e2e-run.mjs`), then FF-merge — same pattern as the truthgate branch. (Tradeoff accepted over the recommended hybrid; keep tsc + targeted tests green per phase so the final gate is bisectable.)
- **c5 (dispatch authority):** FULL unification of the 4 completeness predicates, serialized **after** c4. Pin `run-lab-section/route.test.ts` autonomy gate; final E2E must assert paid-media dispatches exactly once.
- **c2 (provenance) — DEFAULT, re-confirm at Phase 3:** build the verifier to read structured **Provenance both directions** — trust `user-supplied`/`tool-measured` (kills operator-number false-fails) AND flag load-bearing numbers whose origin is `model-estimated`/`unknown` with no source (catches the BuyerICP/DemandIntent invented-number fabrications from the 2026-06-09 audit) — via ONE mechanism, without annotating every onboarding field. User was "not sure"; lock precisely at Phase 3 with fresh audit data. **LOCKED 2026-06-09 (9-agent design+stress workflow):** DERIVE origin from `matchedSourceRef` (no output-schema annotation) · ship BOTH directions (number flag/trust + quote attribution cross-check) · badge-only advisory (never hard-fail) · self-referential + Substack named-author OUT (~9/10 coverage). Stress pass DENIED the original "2 files / zero wiring / kills all 6 numbers" framing: 5/6 invented numbers aren't even claims today (need a field-keyed count extractor) and the gate drops flags on the clean-commit branch (need seam + badge wiring → 9 files). Spec: `docs/handoffs/2026-06-09-phase3-provenance-verifier-codex.md`.

## The roadmap (dependency-ordered)
Spine `1→2→3→4→5` is the lab-engine chain (each of 2/3/4 carves a piece out of 5, so 5 is last). 7 & 8 are independent (own sessions OK). c5 moved into the spine tail per the full-unification decision.

| # | Phase | Cand | Risk | Live E2E |
|---|---|---|---|---|
| 1 | Delete dead pipelines (`streamRunSection`, `streamSectionViaAnswerTool`, `callStructuredStreamAttempt`; ~1,022 lines) — **keep `StreamRunSectionDeps`** | c4-prep | low | no |
| 2 | `committable-gate.ts` — one deep module for "is this Artifact committable?" | c1 | med | yes |
| 3 | Provenance-aware verifier (the real fabrication fix) | c2 | high | yes |
| 4 | Section descriptor — collapse the ~52 `sectionId` string-matches | c3 | high | yes |
| 5 | Decompose the `run-section.ts` god-module (extract ad-probe, VoC prepass, normalizers, gap-builders, stall-guard) | c4 | high | yes |
| 6 | Dispatch-authority: unify 4 completeness predicates + dedup route helpers | c5 | high | yes |
| 7 | Delete the **dead** worker section-schema half (NOT a shared package) | c6 | low | no |
| 8 | Prefill non-answer normalization (~5 lines; the form-vs-probe drift) | c7 | low | no |
| 9 | Realtime payload contract + `saveArtifact` post-commit step extraction | c8+c9 | med | c9 only |

## Phase 1 (committable-gate) corrections from the adversarial pass — MUST honor when we build Phase 2
1. **`callStructuredAttempt` is NOT paid-media-specific** — it is the section-agnostic structured retry/repair path called 4× inside `runSection` (≈7780/7829/7901/8034) for ALL sections. The gate keys `loadBearingKinds` + the per-section hook off runtime `input.sectionId` in **both** live builders.
2. **Three live commit paths, not two** — `buildVoiceOfCustomerDeterministicSynthesisArtifact` (~run-section.ts:949) returns `ArtifactEnvelope|undefined` (undefined-as-fallback, no evidence-support, no error). Handle explicitly; do not blind-fold.
3. **Verdict union needs a slot for the 4 minimums-failed gap artifacts** (BuyerICP/Competitor/Offer/VoC) — else the honest-gap commit posture (`32cc78c4`/W1) regresses and runs stall <7/7.
4. **`loadBearingKinds` unification is a BEHAVIOR CHANGE for VoC-on-retry** (today `callStructuredAttempt` applies only the paid-media override, so VoC through it gets default kinds, not `+quote`). Add a regression test; do not call it a pure refactor.
5. **not-probed sentinel** stays a *contains/regex match* (constant = the phrase; matcher keeps substring semantics). A `===` constant would narrow it.
6. **`HookOutcome` needs a `soften-failed` terminal** (DemandIntent SpyFu softening can fail and must hard-fail with a specific error).
- Put `loadBearingKinds` on the Section descriptor **minimally in Phase 2** (or let the gate own it permanently) so Phase 4 doesn't re-touch the gate. Serialize c1→c2 (both touch the evidence-support seam).
- c2 also touches `structural-verifier.ts:516/551/569` (verdict source-ref reads), not just the two match paths. c6 worker schemas are **dead** (verify `finalizeRunnerResult` truly unreachable; capture the worker's pre-existing `@types` build baseline first).

## ADR alignment (verified, no re-litigation)
- **ADR-0002** (single structured output per Section): every phase keeps one Artifact per Section; the gate/descriptor consolidate around that single output — no per-brick tools, no envelope.
- **ADR-0010** (ARI; annotate the existing `ResearchInput`, single-writer; advisory ungate; DeepSeek-only; section work in Vercel `after()`): c2 annotates existing provenance; the gate keeps the advisory posture (`LAB_VERIFIER_MAX_UNSUPPORTED` default `Infinity` stays in the orchestrator gate, untouched); c5 keeps `orchestrate` awaiting only an ACK + the `claimSectionRun` CAS dedup. No evidence-ledger store / dossier / orchestrator control-plane.

## Verification gate per phase
`npx tsc --noEmit` clean (vs baseline) + targeted `npm run test:run -- <files>` (gate files listed per-phase in the workflow JSON) + `npm run build` exit 0. Live E2E only on run-path phases (2,3,4,5,6,9-c9), run ONCE at branch end per the cadence decision.
