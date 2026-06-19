# Research Pipeline Master Plan — "stop manufacturing the wrong answer"

**Date:** 2026-06-18
**Branch:** `refactor/architecture-deepening`
**Status:** Plan (proof-of-spine landed uncommitted; remainder unstarted)
**Reconciles:** `docs/reports/2026-06-18-gap-to-8-session-findings.md` (value program) + `tmp/research-quality-review/b0d12b45-empty-sections-map.html` (plumbing diagnosis) + the offline schema-vs-data probe (this session).
**Feeds:** `/visual-plan` (later).

---

## 1. Root cause — reconciled, three altitudes of the same incident (run b0d12b45)

The Ramp E2E run looked empty/bloated and the buyer-eval gate HARD-FAILED. Three investigations converged:

- **Plumbing (empty-sections map):** a false `6/6` rollup fired while BuyerICP was still running, so the Paid Media capstone synthesized over a gapped packet, and the reader stacked a confident executive memo + 29 "open questions."
- **Value (gap-to-8):** BuyerICP starves to 0 personas under 6-way fan-out (solo rerun gets 3); VoC ships shallow (48 promotable quotes dropped by a count cap); plus narrow bugs (E3 budget-fact contamination, G1 reader leak) and PRICING=0.
- **Schema-vs-data probe (this session) — the decisive reframe:** we are **NOT data-starved**, and the schema is **NOT a uniform straitjacket**. 3 of 6 sections (Demand, Offer, Market) already fill honestly when given data + time (Demand/Offer are the *reference* floor-OR-blockGap shape). The two broken surfaces manufacture the *wrong* answer by opposite plumbing bugs:
  - **BuyerICP manufactures EMPTY.** On the deadline path, `buildDeadlineExhaustionHonestGapBody` hardcoded `personas:[]` and **discarded the named customer champions the prepass had already acquired**. The acquisitionLedger `not_selected` labels were a *mirror of the empty body*, not a quality decision; the schema's identity validators never even fired.
  - **Paid Media manufactures CONFIDENT.** Hard `.min(1)` required arrays + `synthesizeProjectedResultsFromPhases` *fabricate* rows to beat the floor, so it ships a launch-ready $833/day buy with 15/29 claims unsupported and all feasibility verdicts "unknown".

**Dominant cause = two plumbing bugs (manufacture-empty + manufacture-confident), not rigid schemas and not missing data.** Verdict tally: schema/floor/code-forced = 2 (BuyerICP, PaidMedia); mixed floor+data = 1 (VoC count cap); healthy schema, bug one layer down = 2 (Market verifier over-strip, Offer cosmetic); genuinely healthy = 1 (Demand); genuinely data-starved = 0.

---

## 2. The spine decision — gate the consumer, not the section (three axes)

The ADR-0010 ("readiness is annotation, never a gate") vs ADR-0012 ("never strand; salvage-commit; one post-wave auto-rerun on hard-fail only") tension is **not real** — it was one overloaded "ready" signal. Separate three axes:

| Axis | Who decides | Blocks? | Honors |
|---|---|---|---|
| Completion (did it finish) | deterministic | never | ADR-0012 never-strand |
| Coverage (grounded\|thin\|missing) | deterministic annotation | never | ADR-0010 never-gate |
| **Capstone-admission (NEW)** | deterministic predicate over load-bearing inputs | only the downstream consumer, for ≤1 bounded rescue, then degrades | both |

Reject hard-fail/block (dead-ends an unattended client run). The capstone, when its load-bearing inputs are thin after rescue, degrades its **deliverable type** (a deterministically-assembled "directional brief", no capstone LLM call), not just a confidence badge.

---

## 3. Process foundation (FIRST) — offline replay harness

The actual month-long process failure was debugging in production. The codebase already supports sandbox-first; it's just unwired.

- **Seam:** `RunSectionDeps` (`run-section.ts`) is a fully injectable dependency bag — every LLM call (`runAnswerTool`/`runWriterPass`/…) and `fetchImpl` is injected. A single section runs end-to-end with zero live API calls.
- **Fixtures:** `tmp/accept/b0d12b45/*.json` (corpus + 6 sections + manifest); `scripts/zz-build-ramp-research-input.ts` builds the ResearchInput; `scripts/zz-buyer-eval.mjs` + `zz-gap8-section-gates.mjs` are existing value/gate harnesses.
- **Build:** `scripts/zz-replay-section.mjs <sectionId> [--record|--replay]` (~150 lines): fixed corpus → run ONE section offline (recorded/stubbed providers + cached page snapshots) → offline value-read (local judge agent, never API per the operating rule) → iterate at ≈$0.
- **Per-section gate:** ship a section only when its replay (a) commits a non-gap body from the fixture, (b) the offline judge rates ≥8/10 for media-buyer usefulness, (c) zero unsupported load-bearing claims.

---

## 4. Fix queue (priority; each tied to root cause + verification)

> Reshape exactly 1 surface, soften 1 cap, fix 1 wire, fix 1 verifier, then the plumbing. Offer/Demand untouched.

### F0 — BuyerICP candidate-threading **[PROVEN, uncommitted]**
Thread the in-memory `BuyerPersonaCandidate[]` into the deadline gap body; promote grounded named champions (gate-respecting) instead of `personas:[]`.
- **Root cause:** manufacture-empty (the discard).
- **Status:** landed on branch — `promoteDeadlineBuyerICPPersonas` + wiring in `run-section.ts`; new test `run-section-buyer-icp-deadline-rescue.test.ts` (RED→GREEN); tsc 0; 95/95 BuyerICP-adjacent tests pass.
- **Verify (next):** replay BuyerICP offline against the b0d12b45 fixture → commits ≥3 grounded personas; then one live solo rerun to confirm end-to-end.

### F1 — Paid Media → readiness-aware reshape **[the one genuine reshape]**
Add body-level `planReadiness: full|directional|blocked` + optional `evidenceGap`; give the hard arrays the same `|| blockGap` escape Offer has; gate confident audience/KPI slots on feeder coverage; in `blocked`, assemble a directional brief deterministically (no capstone LLM call).
- **Root cause:** manufacture-confident. **Supersedes** the implicit "always emit a full confident plan" (ADR-worthy — see §6).
- **Verify:** replay capstone with thin BuyerICP → emits `directional`/`blocked`, never a confident $/day buy; no fabricated projection rows.

### F2 — VoC count-cap softening **[floor-soften, not reshape]**
`VOC_CANDIDATE_PACK_MAX_SIZE` / per-domain cap → keep-best-N ranking so promotable-but-capped quotes aren't dropped for count; keep the honest "directional, no permalink" framing.
- **Root cause:** the one real count-cap. **Verify:** replay VoC → ≥ the floor of promotable quotes survive; buyer-eval VOC-EMPTY clears.

### F3 — Market verifier containment fix **[verifier, not schema]**
When a cited 200 page is JS-rendered/non-textual (SpyFu tables, SPA, YouTube), treat containment as unknown→keep-with-needs_review (same as 403s) instead of hard-DROP; stop the perverse 403-kept/200-dropped asymmetry; share the SpyFu-as-sourced transform with `marketSize.signals`.
- **Verify:** replay Market → `marketSize.signals` populated from the same SpyFu volume already trusted for TAM.

### F4 — Rollup / readiness-barrier plumbing **[still needed; now downstream]**
Typed fail-closed allow-list rollup (count only the 6 positioning `section_kind`s; unknown kinds never count); event-driven re-rollup so the capstone is gated behind F0's rescue (no "wait" — dispatch from the rescue's own `after()` continuation, `run_id+'paid_media'` single-writer key, rescue lane ≤1-wide, fence the original runner before re-write).
- **Root cause:** the false-6/6 race. **Verify:** rollup hits 6/6 only after all 6 positioning sections; Paid Media queues strictly after BuyerICP; `deepResearchProgram.counts_toward_rollup=false`.

### F5 — Reader honesty proportional to coverage
Drive off the same coverage object the gate reads: coverage strip on top, memo gated on coverage, open-questions capped ≤5 as ranked unblock-actions; "research blocked" state when core sections insufficient.

---

## 5. Definition of done (product 8/10 — unchanged from gap-to-8)

Three fresh confirmed-HEAD runs (Ramp / Fathom / Plain), each: `zz-buyer-eval` CLEAN · offline judge `--gate` ≥8, coherent, no fabrication · `wouldPay:"yes"` · **no section below 8** · clean reader screenshots. No 8/10 claim from unit tests or solo dumps — only the live full-run sweep counts. Every fix above first passes its offline replay gate (§3) before a live run is spent.

---

## 6. ADR / governance notes

- **F1 supersedes** the implicit "capstone always emits a full confident plan." Worth a superseding ADR (capstone is readiness-aware; may emit a directional/blocked deliverable).
- **F4 + the capstone-admission axis** extend ADR-0012 (auto-rerun now fires on salvage-thin-on-a-load-bearing-section, not only hard-fail) and qualify ADR-0010 (a gate on the *consumer's* confident mode, never on committing any section). Record as an amendment, not a reversal.

## 7. Reconciliation with gap-to-8 (continue, don't fork)

gap-to-8 Waves 1–2 (`21fa507c`, `76b87455`) are *why* Offer/Demand/Market are now healthy — this plan continues that thread. Its two remaining structural blockers (BuyerICP starvation, VoC depth) are F0 and F2 here, now with corrected root causes. The narrow bugs E3 (budget-fact contamination) and G1 (Competitor reader leak) fold in as small items alongside F5.

## 8. Open decisions for /visual-plan

- Capstone-admission critical set: ICP+Demand+Offer (recommended) vs ICP+VoC+Demand vs ICP-only.
- Worst-case deliverable: type-degraded "directional brief" (recommended) vs degraded plan + banner.
- Hard-fail-vs-auto-rescue posture confirmed as **auto-rescue** (gap-to-8 proves solo recovers); F4 wires it.
