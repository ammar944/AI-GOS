# Phase B — Acceptance Gate Verdict (provenance floor + LLM oracle)

**Date:** 2026-06-23 · **Branch:** `refactor/architecture-deepening` (working tree; scripts + gated artifacts uncommitted) · **Model:** GLM-5.2 via Ollama (`glm-5.2:cloud`); scoring/audit = Opus subagents.
**Method:** Built a thin deterministic provenance detector, adversarially verified it, ran all 21 Phase-A sections through GLM self-audit + deterministic remediation, re-scored the gated matrix, then closed the loop on the cells an independent LLM catch-net flagged. Workflows: detector `wf_607d6592` + patch `wf_c4aae6cf`; remediate `wf_8f138e9e`; rescore `wf_36964bf6`; loop-close `wf_5b88822d`.

## Verdict: 🟢 PHASE B PASS — Plain clears 7/7; acceptance architecture proven

**Stated bar (Plain ≤1 section <8): EXCEEDED — Plain is 7/7 ≥8 (clean sweep).** Overall 16/21 ≥8. The data-thin subject (the proxy for pre-launch clients) is fully trustworthy.

### Gated matrix (finalScore = min(medianValue, provenance ceiling))
| Section | Plain | Fathom | Attio |
|---|---|---|---|
| VoC | **8** ✓ | **8** ✓ | **8** ✓ |
| Market | **8** ✓ | 7 · | **8** ✓ |
| Buyer | **8** ✓ | 7 · | **8** ✓ |
| Competitor | **9** ✓ | **8** ✓ | 4 ✗ |
| Offer | **8** ✓ | 7 · | 7 · |
| Demand | **8** ✓ | **8** ✓ | **8** ✓ |
| PaidMedia | **8** ✓ | **8** ✓ | **8** ✓ |

medianValue is **8–9 in every cell** (the full-body re-read erased Phase A's title-only artifact) → **value generalizes across all 3 subjects, unconditionally.** Every gap below is a provenance ceiling, not a value problem.

## The four proven pieces (the production acceptance architecture)
1. **GLM self-audit fixes 92% of its own fabrications** (75→6 violations across 17 cells, no deterministic help; 14/17 cells driven to 0 by the model alone). The "lean on the model" architecture is empirical, not aspirational.
2. **Thin deterministic gate** (`scripts/provenance/gate.ts`, 7 checks: url/quote/number-not-in-transcript, invented_customer, invented_bidder, invented_volume_cpc, arithmetic_error, synthesized_evidence) — adversarially verified **recall 100% / FP 0%** on its coverage (40 TDD tests). It also surfaced **3 errors in the Phase-A human/agent audit** (Fathom VoC was not clean; two Attio "fabrications" were grounded carry-forward).
3. **LLM catch-net = the acceptance oracle.** The thin gate is necessary-but-not-sufficient: an independent skeptical reader caught a **laundered-quote class the gate misses** (quotes attributed to a source fetched as a domain but not as the specific page). This is the piece that makes any subject's deck trustworthy.
4. **Remediation loop converges** (self-audit → gate → catch-net → fix → re-audit), value preserved throughout (gated word counts flat-to-higher; fixes add honest-gap language, never delete analysis).

## Two tiers of provenance defect (the key nuance)
- **`ceiling-4` INVENTED (fatal):** fabricated entities/quotes/arithmetic. **Eliminated everywhere except 1 residual** (`attio/competitor`, loop drove it 2→1; needs one more targeted pass). Never ship one.
- **`ceiling-7` LAUNDERED (real data, off citation):** the *fact is verified*, the *source pointer is imperfect* (e.g. real investor names cited to businesswire when they came from reworked.co; a real quote attributed to the CEO when it was author narration). 4 rich-subject cells (fathom/market, fathom/buyer, fathom/offer, attio/offer), all now hedged/labeled directional. Categorically less dangerous than invention — a buyer can act on a true insight with a directional footnote.

## Open decision (sets the Phase C trust bar)
Is **`ceiling-7` (verified data, directional/labeled citation) acceptable for the supervised pilot deck**, or must every citation be source-perfect (`ceiling-9`)?
- Non-negotiable regardless: the `attio/competitor` `ceiling-4` invention gets cleared (zero inventions ship).
- Pilot is operator-supervised (Phase D), which argues ceiling-7-with-labeling is acceptable at pilot stage; citation-perfect can be a Phase C/D refinement. Pending owner confirm.

## Artifacts
- Detector: `scripts/provenance/gate.ts` + `scripts/zz-provenance-gate.ts` (+ 40 tests). Remediation: `scripts/zz-provenance-remediate.ts` (`--self-audit` + convergence).
- Gated bodies (0 deterministic-violations, value-preserved): `tmp/zz-agentic-glm-gated/<subject>/<section>/{body.md,violations.json}`.
- Spec: `docs/plans/2026-06-23-phase-B-provenance-gate-spec.md`. Phase A verdict: `docs/reports/2026-06-22-phase-A-cross-subject-verdict.md`.
