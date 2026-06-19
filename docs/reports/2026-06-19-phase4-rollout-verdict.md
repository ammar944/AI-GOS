# 2026-06-19 — Phase 4 Rollout Verdict (BuyerICP pilot closed; Step 2 re-scoped from evidence)

Branch `refactor/architecture-deepening`. Commits `29b46bb8` (pilot) + `00f95f7d` (foundation).

## TL;DR

- **Step 1 (BuyerICP pilot): DONE, strict-harness proven, Codex-reviewed, committed.** The section that shipped 0 personas / confidence 0 for weeks now commits 4 grounded personas at prod-default verifier settings with 0 `.invalid` URLs and reconciled, honestly-tiered coverage.
- **Step 2 (other 6 sections): re-scoped.** The harness proved the handoff's "mechanically flip every section to downgrade mode" assumption is wrong. Only 3 sections fail to commit (Market, Demand, Offer), and their fix is **not** the BuyerICP gate flag — it is honest gap/inference authoring with the strong gate intact. Details below. NOT yet executed.
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

## State

- `main`-mergeable increment on the branch: 2 commits (`29b46bb8`, `00f95f7d`). Tree otherwise carries the pre-existing in-flight lanes + scratch (`.agent-native/`, `CLAUDE-FABLE-5.md`, scratch HTML) — untouched, not staged.
- BuyerICP pilot is the proven template; Step 2's 6-section conversion (3 to unblock honestly + 3 to enrich + renderer) is the remaining work, re-scoped above. Not started.
