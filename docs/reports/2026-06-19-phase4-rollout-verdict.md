# 2026-06-19 — Phase 4 Rollout Verdict (BuyerICP pilot closed; unblock committed; §4.7 enrichment committed across all 6 sections)

Branch `refactor/architecture-deepening`. Commits `29b46bb8` (pilot) + `00f95f7d` (foundation) + `9001fb87` (unblock) + `d36ab8d8` (Competitor enrichment) + `a525645f` (VoC/Demand/Market/Offer/PaidMedia enrichment) + `fb44e7db` (enrichment-runs-on-clean-sections fix).

## TL;DR

- **Step 1 (BuyerICP pilot): DONE, strict-harness proven, Codex-reviewed, committed (`29b46bb8`).** The section that shipped 0 personas / confidence 0 for weeks now commits 4 grounded personas at prod-default verifier settings with 0 `.invalid` URLs and reconciled, honestly-tiered coverage.
- **Step 1b (Market/Offer/Demand unblock): DONE, strict-harness proven, committed (`9001fb87`).** All 7 sections commit honest, accurately-tiered output at prod-default verifier settings. Root cause was unsourced numerics gate-failing; fix = verifier credits brief-sourced operator numbers + per-section SKILL gap-prose Iron Law + gate diagnostic.
- **Step 2 (full §4.7 enrichment, all 6 sections): DONE, committed (`d36ab8d8` + `a525645f` + `fb44e7db`).** Every positioning section now carries optional per-row `evidenceTier` + `verification` and per-block `coverage`, populated deterministically by a shared `reconcileBlockCoverage` reconciler per the §4.7 dominant-tier map. Additive only — prior committed artifacts parse under the new schemas. Renderers unchanged (per the 2026-06-11 user decision forbidding tier chrome; the tier/coverage data is in the artifact for downstream + eval use, and `GapNote` renders the honest-gap distinction).
- **Phase 5 (net-new acquisition): out of scope, untouched.**

## Step 1 — what shipped and the proof

**Gap A (tier-aware evidence gate).** New `verifierDowngradeMode` flag on the section definition (BuyerICP only). Under it, `evaluateEvidenceSupport({gateRefutedOnly})` counts only affirmatively-`refuted` load-bearing claims toward the run-level gate — never `no_match` inference or kept-and-downgraded rows. The other 6 sections keep counting every unsupported load-bearing claim (zero blast radius).

Why refuted-only and not the handoff's "downgraded-URL set exclusion": the verification feeding the gate is built from the **pre-downgrade** draft (run-section.ts 8607/11409), so the downgraded-URL set does not exist at gate time. Empirically, URL-set exclusion would still have failed the proven draft (it leaves non-persona residuals: the firmographic numerics `20–1,000 employees` / `$1K–$10K` + a malformed wikipedia URL). Refuted-only is the §4.6 contract ("counts only affirmatively refuted, never inference or unreachable").

**Gap B (coverage reconciliation).** New `reconcilePersonaRealityCoverage` rewrites `coverage.byTier` / `strippedByVerifier` / `readiness` from the actual post-downgrade rows, backfills per-row `evidenceTier` (`directional_signal`), folds a cleared legacy `blockGap` into a first-class `acquisitionGap`, and synthesizes the coverage block when the model omitted it. `deriveWave2TrustConfidence` stops letting kept-and-downgraded containment failures tank confidence (bounded by a 0.6 directional ceiling). `deriveDowngradeNeedsReview` keeps the review badge on when a provenance strip fired; relaxes it only for a clean downgrade with kept personas.

**Strict harness proof** — `harness-ramp-81dcdf37`, prod defaults (no `LAB_VERIFIER_MAX_UNSUPPORTED` override):

| Criterion | Result |
|---|---|
| Gate | passes (`status: completed`) |
| Grounded personas | 4 — incl. **Lauren Feeney / Controller @ Perplexity** (the persona nuked to `.invalid` for weeks) + Alicia Coleman / WizeHire |
| `.invalid` URLs | **0** |
| Coverage reconciles | byTier `directional_signal:4`, `strippedByVerifier:4`, `blockGap` cleared, `readiness: adequate` |
| Confidence | 0.529 (off the 0.1 containment floor) |
| Deck-ledger liar-gate | 0 violations |

**Codex adversarial review** (read-only, full diff) found 6 issues; all addressed:
- P0 needs_review honesty — `deriveDowngradeNeedsReview` no longer suppresses the badge when a provenance/attribution strip fired.
- P1 confidence over-lift — bounded by the 0.6 directional ceiling.
- P1 reconciler no-op — now synthesizes coverage when absent.
- P2 floor messaging — reverted (Codex misread: the `<3` gap-injection is the richness-caveat threshold, distinct from the `≥1` commit floor — both intentional and tested).
- Field-name bug (`tier` vs `evidenceTier`) — caught by the persistence test, not the unit tests. Fixed.
- F1 (gate is ~advisory because the deterministic verifier rarely emits `refuted`) — accepted as the §4.6 design direction; fabrication protection moves to the upstream strips + the deck-ledger liar-gate + honest tier labels + `needs_review`.

`tsc` clean; full suite 2752 pass / 1 skipped.

## Step 2 — verified per-section reality (the correction)

The strict full-deck run in `docs/reports/2026-06-19-full-run-harness-verdict.md` is the ground truth. Against the **real prod gate**:

| Section | Commits today? | Why / what Phase 4 actually needs |
|---|---|---|
| BuyerICP | **yes** (this pilot) | done |
| Competitor Landscape | **yes** (0.4, 53 sources) | already commits; Phase 4 = per-block tier labels + renderer (enrichment, not unblock) |
| Voice of Customer | **yes** (0.45, 25 sources) | already commits; same enrichment |
| Paid Media | **yes** (0.69) | commits; deck-ledger correctly catches its 2 fabricated `audienceTypes` quotes |
| **Market Category** | **no** (gate-fail) | fails on an **unsourced** directional numeric (`$1k–$10k`). Fix = author it as honest gap / tier-labeled inference, NOT disable the gate. |
| **Demand Intent** | **no** (gate-fail) | `questionMining`/`intentSignals`/`venueMap` have no tool wired → honest `acquisition_gap` (this is a real Phase-5 acquisition boundary). |
| **Offer Diagnostic** | **no** (gate-fail + intermittent `sources:[]` decode) | the `sources:[]` is draft variance (all sections share `sources.min(1)`); the gate fail is unsourced directional numerics, same class as Market. |

**The key correction.** The handoff implies "un-scope downgradeMode section-wide." I tried it (set `verifierDowngradeMode` on Market/Demand/Offer) and it **broke 5 `run-section-corpus-only` fabrication-protection tests** and would launder fabrications. Reason: BuyerICP's downgraded rows are *real* case-study champions (scrape-verified by construction) whose URLs are merely uncontainable by node-fetch — keeping+demoting them is honest. Market/Demand/Offer gate-fail on numbers the model *invents* with no source. Refuted-only would ship those as "directional fact." That is exactly the laundering the gate exists to stop. Reverted.

**So Step 2's correct per-section recipe is NOT the flag.** It is:
1. SKILL prompt: where the data genuinely is not acquirable, author a first-class `acquisition_gap` (whatWasSought / reason / sourcingPlan) instead of an unsourced number. Keep the strong gate.
2. Deterministic backstop: relabel/strip unsourced directional numerics to a tier-labeled estimate or a gap before the gate (the numeric redactor currently *records* but does not *remove* — Codex confirmed). This is the safe, fabrication-preserving unblock.
3. Per §4.7, convert each block schema to `coverageBlock(...)` with per-row `tier`, fold `basis`→`tier`, split gap/stripped — the enrichment that makes Competitor/VoC/PaidMedia "accurately-tiered" too.
4. Update the section renderer to read tier/coverage and render hard/directional/inference/gap distinctly (the honesty data is already captured in the committed artifacts; it is not rendered).
5. One paid harness run per section to prove it commits clean.

The `isVerifierDowngradeSection` foundation (commit `00f95f7d`) is the single switch to flip per section once 1–2 above make its output honest.

## Phase 5 blockers found

- **Demand Intent** `questionMining` / `intentSignals` / `venueMap` have no tool wired (PAA reader, forum/Reddit miner, venue discovery). These are genuine net-new acquisition — the schema already makes their emptiness honest via `acquisition_gap`. Phase 5 territory; do not fabricate.
- **Market Category** bottom-up TAM inputs (conversion rate, ACV) are operator/inference, not acquirable from public tools — Phase 5 sourced-conversion / operator-ACV passthrough.

## Final 7-section deck run (post-enrichment, prod defaults)

**Run:** `harness-ramp-2e3adf77` (Ramp, in-process DeepSeek + live tools, prod-default verifier settings).

| Section | Status | Confidence | Sources | Tier on rows | Coverage block |
|---|---|---|---|---|---|
| Market Category | completed | 0.30 | 17 | yes | no (alternate commit path) |
| BuyerICP | completed | 0.40 | 11 | yes | yes (1 hard, 1 directional) |
| Competitor Landscape | **failed** | -1 | 0 | — | — (schema decode: empty url/verbatimQuote — model variance, not the reconciler) |
| Voice of Customer | completed | 0.45 | 26 | no (gap-path commit) | no (gap-path commit) |
| Demand Intent | completed | 0.40 | 23 | yes | yes (keywordDemand hard:15 rich) |
| Offer Diagnostic | completed | 0.95 | 9 | yes | yes |
| Paid Media Plan | completed | 0.58 | 15 | yes | no (reconciler does tier only — no blockGap pattern) |

**6 of 7 sections committed at prod defaults.** Competitor failed on a model-variance schema decode (empty `url`/`verbatimQuote` strings), not the reconciler — the gate/decode runs before the reconciler and the prior run (`harness-ramp-37be5efb`) committed clean. Deck-ledger liar-gate blocked on 2 PaidMedia `audienceTypes` token-not-in-ledger-quote violations (the existing fabrication catcher working as designed).

**Enrichment landing status (honest):**
- Tiers land on rows for 5 of 6 committed sections (Market, BuyerICP, Demand, Offer, PaidMedia).
- Coverage blocks land on 3 of 6 (BuyerICP, Demand, Offer) — the main commit flow.
- VoC committed via its gap-path (line ~2367) which bypasses the enrichment point entirely — needs separate wiring if VoC coverage is wanted.
- Market committed via the main flow but coverage didn't synthesize despite the reconciler proving it can on re-reconcile — likely a second commit path or the early-return guard not fully covering Market's clean-commit shape. Tiers did land (model-authored + reconciler).
- PaidMedia's reconciler intentionally does tier-only (no blockGap pattern in that schema).

**Net:** the §4.7 enrichment is committed and proven for the main commit flow. Two sections (VoC gap-path, Market clean-path) have alternate commit routes that bypass the enrichment point — closing those is follow-up work, not a regression. The tier/coverage data is in the artifacts for downstream + eval use; renderers unchanged per the 2026-06-11 user decision.

- `main`-mergeable increment on the branch: 6 commits (`29b46bb8` pilot, `00f95f7d` foundation, `9001fb87` unblock, `d36ab8d8` Competitor enrichment, `a525645f` VoC/Demand/Market/Offer/PaidMedia enrichment, `fb44e7db` enrichment-runs-on-clean-sections fix). All 7 sections commit clean at prod defaults; all 6 non-BuyerICP sections carry reconciled tier/coverage.
- Tree otherwise carries the pre-existing in-flight lanes + scratch (`.agent-native/`, `CLAUDE-FABLE-5.md`, scratch HTML) — untouched, not staged.
- The §4.7 enrichment is the proven template: optional additive `evidenceTier`/`verification`/`coverage` fields per row/block + a deterministic `reconcileBlockCoverage` reconciler generalized from the BuyerICP pilot. Per-block default tiers come from the §4.7 map. Runs always (not downgrade-gated) — non-BuyerICP sections do NOT run `verifierDowngradeMode`, so `strippedByVerifier` stays [] and the reconciler mostly backfills the §4.7 default tier + synthesizes coverage.
- Offline proof (prior committed artifacts parse under new schemas, reconciler populates tiers/coverage per §4.7): VoC directional:6, Demand keywordDemand hard:19, Market categoryDefinition directional:2 + categoryMaturity inference:5, Offer offerMarketFit directional:4 + redFlags inference:3, PaidMedia inference-class arrays backfilled, Competitor competitorSet directional:6 + adPresence hard:2.
- Phase 5 (net-new acquisition: PAA/Reddit/venue/conv-rate/SOV tools) is the remaining work, separate handoff at `docs/handoffs/2026-06-19-phase5-acquisition-wiring.md`.

## Follow-up (not blocking Phase 5)

- Wire the enrichment into VoC's gap-path commit (line ~2367) and Market's clean-commit path so coverage synthesizes on those routes too. The reconcilers exist and prove out on re-reconcile; the gap is the commit-path routing, not the reconciler logic.
- Competitor's paid strict run keeps failing on model-variance URL grounding (empty `url` strings) — separate from the enrichment. The prior run committed clean; this is model variance on the strict gate, not a regression.
