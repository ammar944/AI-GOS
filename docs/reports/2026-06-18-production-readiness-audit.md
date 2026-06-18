# AI-GOS Production-Readiness Audit — Execution Brief

**Date:** 2026-06-18
**Method:** Read-only deep audit. 4 parallel agents (per-section value-read, code/path truth, proof-harness state, cross-section coherence) + direct verification of agent claims against source code and persisted artifacts. No data, scores, run IDs, or proof invented. Every finding traces to a real artifact, file:line, or named report.
**Subject audited:** Ramp, run `d2abf018`.
**Branch audited:** `refactor/architecture-deepening` (uncommitted patch set of 5 of 6 leverage-ordered fixes from `docs/reports/2026-06-17-content-quality-grounding.md`).
**Companion docs:** `docs/plans/2026-06-17-research-presentation-model-plan.md`, `docs/reports/2026-06-17-gap-rootcause-and-8of10-roadmap.md`, `docs/reports/2026-06-17-e2e-3subject-findings-gaps.md`, `tmp/research-quality-review/p0a-p1-p0b-status-2026-06-17.md`.

---

## Latest persisted state (what was actually judged)

- **Latest persisted Ramp dump:** `tmp/grill/ramp-current-status/` (2026-06-17 17:16) — reflects COMMITTED code only (`6b1bc3ed` P0a + P0b, `353c60bc` P1-VoC-count, `5fbf5b98` WS1 telemetry-strip). The uncommitted patch set (case-study mining, keyword-discovery, numberVariants, prose reconciliation, gap-renderer) has **never run live**.
- **Latest judge verdict:** `tmp/judge/d2abf018/verdict.json` (2026-06-17 16:07) = **overall 6.7/10, `noFabrication:false`, `wouldPay: with-caveats`** — but it judged the **pre-P1** dump (`ramp-post-p0`, VoC count=3). The current dump has count=2. **The verdict is stale.**

---

## 1. Overall verdict

**Not production-grade. Estimated true state ≈ 6.5/10, trending toward 7 with the uncommitted patch set — still below the 8 bar.**

The app is no longer "vibe-coded slop" — there are real assets (eyeball-verified competitor ad wall, coherent paid-media math, real G2 quotes, a sharp exec thesis, deterministic cross-section evidence-pack inheritance). But it is **not proven**: the uncommitted patch set (5 of 6 leverage fixes) has **never run live**, has **known defects** (numberVariants false-positive, missing competitor guards, missing BuyerICP second-gate), and the **only fabrication finding is stale** — the VoC count contract is already fixed in code and in the persisted dump, just not re-judged. Two sections (BuyerICP, VoC) remain unbuyable as rendered. The app is **code-patched, not product-proven**, and one patch (BuyerICP) ships in the exact false-progress mode the grounding report warned against.

---

## 2. Section-by-section table

| # | Section | Score est. | Status | Blockers | Proof needed | Next action |
|---|---|---|---|---|---|---|
| 1 | **Market Category** | 6 → ~7 patched-unproven | Patched, unproven, **defective** | `numberVariants` emits bare `13` → `$13B` matches `$13M` (false-positive risk the report explicitly forbade); bottomUpTam genuinely missing | Code test ($13B-vs-$13M negative case) + live rerun | **Bound `numberVariants` to exact-magnitude** (drop bare-digit variants when a magnitude suffix matched); add negative test |
| 2 | **Buyer ICP** | 2 → ? patched-unproven | Patched, unproven, **highest risk** | Timeout carpet-bomb still in current dump; case-study mining real but unproven live; **second source-liveness persona-grounding gate NOT addressed** (mandatory-same-wave per report); venue reorder not done | Live BuyerICP solo rerun on uncommitted HEAD + persona count grep | **Land the second-gate fix in the same wave** before any live rerun, else false progress |
| 3 | **Competitor Landscape** | 7.5 | Product-proven on ad library; **patch incomplete** | `!isSubject` gate missing → Ramp's 6 verified inflate competitor clamp; recruiter-post "verified" adjective not downgraded; no buyer-eval check after normalizer | Code test (subject-exclusion + recruiter downgrade) + value-read | **Add `!isSubject` filter + recruiter heuristic + post-normalizer buyer-eval check** |
| 4 | **Voice of Customer** | 3 → ~5 patched-unproven | Count contract **fixed & in dump** (2 quotes/2 URLs); permalink patch **partial & overstated** | Trustpilot listing scrape returns 0 anchors (probe-proven) → 28 of 31 clean quotes still rejected; no directional fallback lane built; report's "31 quotes pass admission" claim unmet (~10 will) | Live VoC rerun + quote/domain grep; honest directional-lane decision | **Re-judge current dump first** (flips noFabrication); **decide directional lane** for Trustpilot; build it or document the honest cap |
| 5 | **Demand Intent** | 6.5 → ~7.5 patched-unproven | Patched, unproven, **partial** | `keyword_discovery` wraps **only 2 of 4** dead SpyFu endpoints; `MIN_SEARCH_VOLUME` not parametrized; no code-level forcing through provenance gate (prompt-only) | Live Demand rerun + non-branded keyword count grep | **Wrap the other 2 endpoints** (`getCompetingPpc/SeoKeywords`); parametrize `MIN_SEARCH_VOLUME`; verify ≥10 non-branded terms land |
| 6 | **Offer Diagnostic** | 6.5 | Product-proven (kernel), **internally contradicted** | Binding-constraint thesis rests on operator-asserted "40% CAC overshoot" (unsupported, `no_match`); contradicted by Ramp's "Get started for free" CTA that `strippedSubjectCtaClaims` removed; red-flags sharp but only 2 | Value-read + reconcile CTA-vs-pricing-opacity | **Reconcile the free-signup CTA with the pricing-opacity thesis** or reframe the binding constraint honestly |
| 7 | **Paid Media Plan** | 7 | Product-proven mechanics, **capped by upstream** | `evidencePack.status` renderer live (gap = "Unverified" pill) ✓; but gap audience cards still render confident `$money` allocation beside the pill (report mandated "test budget, not allocation"); inherits empty BuyerICP/Demand → 13/25 rows gap; `$833/day` unsupported | Rendered UI inspection + live rerun after upstream fixed | **After BuyerICP+Demand land**: change gap audience rows to "test budget" not `BudgetBar`; spot-check `$833/day` provenance |
| 8 | **Exec synthesis** | 6.5 | Real thesis, **noisy fact ledger** | `factLedger.acv` reads span $1K–$10K, $50K+, **and $13B** (valuation leaked into ACV — bug); monthly-budget winner picked as $100 not $25K; thesis rests on unverified 40% | Value-read + fact-ledger hygiene | **Fix ACV/valuation contamination** in fact extraction; validate the 40% or label it operator-asserted in the thesis |

---

## 3. Cross-section systemic issues

1. **Provenance is real; depth is not.** The deterministic `evidencePack` inheritance (`paid-media-evidence-pack.ts:637-688`) is the strongest part of the app — every Paid Media row traces to a real upstream locator or honestly says "section-level only." But **13/25 rows are gap** because the upstream sections (BuyerICP `personas:[]`, Demand `keywordDemand.blockGap.foundCount:0`) are empty. The capstone cannot target *who* to buy media against — the one thing a media buyer needs most.
2. **Carpet-bombing persists in degraded sections.** `ramp-current-status/positioningBuyerICP.json` still stamps "section exceeded its time budget — rerun to retry" into **every block** (clusters, buyingContext, personaReality…). This is the WS2/RPM problem the plan *dropped* on the bet that "full sections have nothing to apologize for." That bet is **unproven** — no full BuyerICP run exists post-patch. The 10-line `isOfferDiagnosticHonestlyUnavailable` generalization was never done.
3. **The stale-fabrication trap.** The judge ran on the pre-P1 dump. Re-judging `ramp-current-status` almost certainly flips `noFabrication:true` — but nobody has done it. This is the cheapest, highest-leverage proof step on the board and it's sitting undone.
4. **Uncommitted ≠ unproven ≠ correct.** All 5 new fixes pass unit tests, but 3 have the exact defect class the grounding report warned against (unbounded magnitude, missing subject gate, missing second-gate). Unit green here is **not** product truth — the P4 meta-root-cause ("tests bypassed the router and prepass") is still in effect for the new patches.
5. **Fact-ledger contamination.** $13B valuation leaking into ACV is a silent trust-killer the exec thesis rests on.

---

## 4. Recommended execution order (leverage, not effort)

1. **Re-judge `ramp-current-status`** (zero code, zero cost). Confirm `noFabrication:true`. If it flips, the headline blocker (the only fabrication finding) is gone *on the committed code path*. (~15 min)
2. **Fix the 3 patch defects before any live rerun** — cheap, prevents burning a $4/24min run on defective code:
   - Bound `numberVariants` to exact-magnitude + negative test.
   - Add `!isSubject` gate + recruiter downgrade to `reconcileAdEvidenceProseWithVerifiedCounts` + post-normalizer buyer-eval check.
   - Land the BuyerICP second source-liveness persona-grounding gate (mandatory-same-wave) OR explicitly document why case-study mining makes it unnecessary.
3. **Commit the patch set** (see §6) — atomic, with the defect fixes folded in.
4. **One live Ramp rerun on confirmed-HEAD** (`/api/research-v2/rerun-section` for BuyerICP + VoC + Demand + Paid Media; ~$4). Dump to `tmp/grill/ramp-post-patch/`.
5. **Grep gates on the fresh dump**: BuyerICP `personaReality.personas.length ≥ 3` (was 0); Demand non-branded keyword count ≥ 10 (was 0); Paid Media gap-row count drops as upstream fills; Market `marketSize.signals.length ≥ 2`; no `$13B`-matches-`$13M` false positive.
6. **Re-judge + value-read** the fresh dump. Target Ramp ≥ 7.5, `noFabrication:true`.
7. **3-subject sweep** (Ramp/Fathom/Plain) only after Ramp is green. Target all three ≥ 8.

---

## 5. What NOT to work on yet

- **Do not** touch the eyeball-verified competitor ad wall (Ramp's 6 verified Meta creatives with live permalinks) — the judge praised it; regressing it costs more than the gaps.
- **Do not** touch operator-vs-sourced number labeling (ACV/$18K LTV/$4,200 CAC/SpyFu volume) — the prior trust-killer is fixed.
- **Do not** touch the review/persist path (`commit-patch.ts`, `attachAgenticReview`) — the root-cause report refuted the "review drops additive fields" hypothesis; it's a clean passthrough.
- **Do not** build the RPM tier-classifier (WS2 was correctly dropped) — until a full BuyerICP run proves the carpet-bomb is gone, the 10-line inline `isOfferDiagnosticHonestlyUnavailable` generalization is enough *if* BuyerICP fills.
- **Do not** add a `validateMinimums` hard-gate to the VoC gap builder or per-domain caps to the admissibility track (report explicitly forbids).
- **Do not** start acquisition-depth work (multi-domain VoC, more competitor creatives, question mining) until the mechanical proof is green — otherwise the system still can't prove what it already has.
- **Do not** declare any lane closed on unit tests alone (the P4 trap).

---

## 6. Merge/commit guidance for the uncommitted patch set

**Do not commit as-is.** The patch set has 3 known defects and has never run live. Recommended:

1. **Fold the 3 defect fixes** (numberVariants bounding, competitor `!isSubject`+recruiter+post-normalizer-check, BuyerICP second-gate-or-document) into the patch set first.
2. **Commit atomically as one feature commit** on `refactor/architecture-deepening` with a message naming all 6 fixes (e.g. `feat(research): WS3-5 grounding — market containment, voc permalinks+trust, competitor prose clamp, buyer-icp case-study mining+own-exec reject, demand keyword-discovery, paid-media gap rendering`). Reference `docs/reports/2026-06-17-content-quality-grounding.md`.
3. **Exclude scope creep** from the commit: `CLAUDE-FABLE-5.md` (unrelated), and decide on `scripts/zz-probe-*.mjs` + `zz-build-ramp-research-input.ts` (probe harness — keep untracked or separate commit, don't bundle with the feature). `scripts/zz-drive-e2e-airtable.mjs` multi-subject change is harmless harness generalization — separate commit or leave staged for the e2e step.
4. **Pre-commit verification (honest)**: `npx tsc --noEmit` (0 errors), `npm run test:run -- src/lib/lab-engine/agents src/lib/lab-engine/sections src/lib/lab-engine/agents/verification src/components/research-v2` (expect the new tests green + the 2 VoC suites' committed counts to drop where dupes existed — that's correct, not a regression). Do **not** claim the live path is proven — only that units are green.
5. **Post-commit**: tag the commit hash in the next checkpoint report so the live rerun can be tied to a confirmed-HEAD.

---

## 7. The one next implementation prompt for Opus/Codex

> **GOAL:** Close the 3 known defects in the uncommitted grounding patch set so a live Ramp rerun is safe to burn, then prove the committed code path is fabrication-free.
>
> **NON-GOALS:** No new acquisition depth, no RPM/tier-classifier, no touch to the review/persist path, the competitor ad wall, or operator-vs-sourced labeling. No live rerun yet.
>
> **FILES:**
> - `src/lib/lab-engine/agents/verification/source-liveness.ts` (+ `__tests__/source-liveness.test.ts`)
> - `src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts` (+ `__tests__/with-normalized-competitor-ad-evidence.test.ts`)
> - `src/lib/lab-engine/agents/run-section.ts` (the `reconcileAdEvidenceProseWithVerifiedCounts` call site ~L4847)
> - `src/lib/lab-engine/agents/buyer-icp-acquisition.ts` OR `buyer-persona-case-study-mining.ts` (second persona-grounding gate)
>
> **CONSTRAINTS:** TypeScript strict, no `any`. No lowering any truth floor. No admitting laundered/paraphrase/fabricated evidence. Match existing style. RED-first tests that fail on current HEAD then pass after. Do not touch the review/persist path.
>
> **STEPS:**
> 1. **Bound `numberVariants` to exact-magnitude equivalence.** When `magnitudeMatch` succeeds (a suffix like `b`/`million`/`thousand` is present), do NOT emit the bare `noCommas`/`noCurrency` digit-only variants for the `containsNumber` substring test — a `$13B` claim must not match a page saying `$13M` or `$13`. Keep the expanded-digit and letter/word variants. Add a RED-first test: `containsNumber("$13M page", "$13B")` → `false`; `containsNumber("$13 billion page", "$13B")` → `true`. Verify the existing `:74/368/438` fabrication assertions still pass (they're name/company mismatches, unaffected).
> 2. **Add the missing competitor guards.** (a) Gate `reconcileAdEvidenceProseWithVerifiedCounts` on `!isSubject` — pass only non-subject groups when computing `totalVerified`, so Ramp's 6 verified creatives don't loosen the clamp for Brex/Airbase prose. (b) Add a conservative recruiter-post heuristic `/hiring|we're hiring|join our team/i` that downgrades the adjective "verified" → "recruiter-post" (downgrade adjective only, never delete a creative). (c) Add a buyer-eval check **after** the normalizer runs on real output (not authored-to-pass). RED-first tests for both: subject creatives excluded from `totalVerified`; recruiter-post ad gets adjective downgrade.
> 3. **Resolve the BuyerICP second-gate question.** Per `docs/reports/2026-06-17-content-quality-grounding.md` line 78, the source-liveness persona-grounding gate (the "could not be independently verified" gate that shipped 0 personas in a divergent `ramp-fresh` capture despite no timeout) must be fixed in the same wave as the timeout+own-exec fixes, or the section still reads ~1/10. **Decide and document**: either (i) fix the gate so a non-timeout persona capture passes honestly, OR (ii) make case-study mining the documented primary gate-clearing path and prove the Perplexity-led path is no longer reachable as the sole source. If (ii), write the reasoning into `docs/reports/` and add a test asserting case-study champions clear containment on re-fetch. Do not silently leave it unaddressed.
>
> **VERIFY:** `npx tsc --noEmit` exits 0. `npm run test:run -- src/lib/lab-engine/agents src/lib/lab-engine/sections src/lib/lab-engine/agents/verification` all green, with the 3 new RED-first tests passing and no existing test regressing. `git diff --check` clean. Then, separately and NOT in this task: re-judge `tmp/grill/ramp-current-status/` with `scripts/zz-judge-run.mjs` and report whether `noFabrication` flips to `true` (it should, since the count contract is already fixed in that dump) — this is a read-only proof step, no code change.

---

## Evidence reviewed

- `AGENTS.md`, `CLAUDE.md`, `docs/source-map.md`, `docs/AGENTS.md`
- `docs/reports/2026-06-17-content-quality-grounding.md`
- `docs/reports/2026-06-17-gap-rootcause-and-8of10-roadmap.md`
- `docs/reports/2026-06-17-e2e-3subject-findings-gaps.md`
- `docs/plans/2026-06-17-research-presentation-model-plan.md`
- `tmp/research-quality-review/gap-rootcause-roadmap-review-2026-06-17.md`
- `tmp/research-quality-review/p0a-p1-p0b-status-2026-06-17.md`
- `tmp/judge/d2abf018/verdict.json` (6.7, noFabrication:false — judged pre-P1 dump)
- `tmp/grill/ramp-current-status/*.json` (8 section artifacts + `_manifest.json`)
- `tmp/probe/voc-permalinks-ramp.json`, `tmp/probe/casestudy-plainfetch-ramp.json`
- `git --no-pager diff` over the 19 modified + 11 untracked files on `refactor/architecture-deepening`
- `git --no-pager log --oneline -15` (confirmed P0a/P0b/P1 committed; new fixes uncommitted)
- Source: `src/lib/lab-engine/agents/verification/source-liveness.ts:439-490`, `src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:1215+`, `src/lib/lab-engine/agents/run-section.ts:4847/9423-9489`, `src/components/research-v2/section-renderers/paid-media-plan.tsx:369-458`, `paid-media-plan-deck.tsx:166-188`

## 4-agent findings (raw)

Four parallel read-only agents were dispatched. Their full outputs are reproduced here for traceability.

### Agent A — Per-section rendered value-read (media-buyer)

> Judge says 6.7 overall, `noFabrication:false`. My read: **6.2**. Two sections are honest gaps, one is a real asset, the rest are mid.

**1. positioningMarketCategory — 6/10** — Good category frame, empty market sizing. Worth paying for: 5 sourced keyFindings with real URLs (Contrary, Stampli, Precoro); `categoryMaturity` stage="growing" with 4 supportingSignals each carrying sourceUrls; `categoryPowerBet` anchors on the real $25K/mo budget. Fake/thin: `marketSize.signals:[]`, `bottomUpTam.inputs` all `"evidence-gap"`, `reachableRevenueEstimate:"Not enough public evidence: directional only — not computed"`, `structuralForces.forces:[]`, 11 unsupported claims incl. `"Ramp $13B valuation"` (no_match) and `"Ramp customer count"` (no_match), `confidence:0.4`. Fix: fetch keyword volume + ACV to compute bottomUpTam. Status: Needs patch.

**2. positioningBuyerICP — 2/10** — Total failure sold as honest gap. Every block = `"Not enough public evidence: section exceeded its time budget"`. `personaReality.personas:[]`, `firmographicCuts:[]`, `awarenessDistribution.levels:[]`, `clusters.venues:[]`. `confidence:0.1`. Sources = 5 placeholder `ramp.com/#section-gap-N`. Worst: the 5 "candidates" are Eric Glyman (Ramp CEO), Dan Wernikoff (Ramp COO), Gene Lee (Ramp PMM) — sellers, not buyers — plus a podcast host and a CPA firm CEO. Zero promoted. Fix: mine G2/Capterra reviewer identities + case-study champions. Status: Needs patch.

**3. positioningCompetitorLandscape — 7.5/10 (strongest)** — Real ad-library evidence with live creative URLs. `adEvidence` with 6 verified domain-matched Ramp Meta creatives — real copy ("Cursor, Notion, Perplexity, and Vercel all run on Ramp"), landing URLs, firstSeen/lastSeen. Brex 29 Meta creatives (withheld, `identityConfidence:"low"`), Airbase LinkedIn hiring posts, BILL null-copy. The "no competitor runs coherent verified paid acquisition" read is genuinely useful. Fake/thin: Ramp `rawCounts.google:0, linkedin:0` (Meta-only); Brex `verifiedCount:0`. Fix: prose reconciliation. Status: Product-proven on ad library; patch needed for narrative.

**4. positioningVoiceOfCustomer — 3/10** — Two real quotes, metadata lies about three, Trustpilot evidence scraped then discarded. 2 verbatim G2 quotes: *"Though Ramp integrates with many accounting software brands, it does not connect with ours. We still have to download a spreadsheet."* and *"The lack of banking integration with Campfire has been a bit of a bummer..."* Judge flagged `noFabrication:false` — `foundCount`/`foundPainQuoteCount` says 3, only 2 emitted. `successLanguage.quotes:[]`, `objections.items:[]`, `decisionCriteria.criteria:[]`, `switchingStories.stories:[]`. `confidence:0`. Worst: acquisitionLedger shows Trustpilot reviews *were* scraped — *"The platform is great but the onboarding is terrible"*, *"Ramp is very manual and causes a lot of additional work"*, *"deceptive freemium model"* — all rejected `insufficient_independent_domains` despite Trustpilot being independent. Validator-driven self-harm. Fix: promote the already-acquired Trustpilot/TrustRadius quotes. Status: Needs patch.

**5. positioningDemandIntent — 6.5/10** — Real SpyFu data plus honest non-branded gaps. `keywordDemand` — "ramp" 27,200/mo at $1.15 CPC, difficulty 73; ramp pricing 44, reviews 23, alternatives 32, each with top3RankingDomains. Comparison-intent finding with 6+ competitor-page URLs. 3 `orderedMoves` with concrete $200/day probe. Fake/thin: `venueMap.venues:[]`, `contentGaps.gaps:[]`, `intentSignals.items:[]`, `questionMining.questions:[]`. `"$200/day"` and `"0.5%"` are `strippedNumericClaims` (unverified). `confidence:0.4`. Fix: run the 50+ non-branded query probe. Status: Needs patch.

**6. positioningOfferDiagnostic — 6.5/10** — Sharp red flags, but the binding constraint is internally contradicted. 3 `redFlags` (AP depth vs Tipalti/Stampli, banking claims unvalidated, $18K LTV unvalidated). `orderedMoves[0]` = publish transparent pricing. `singleBindingConstraint` articulation. Fake/thin: `"40%"` overshoot is `status:unsupported, reason:no_match`. `containmentPassRate:0.33`. `strippedSubjectCtaClaims` removed *"Every paid-search prospect must enter a demo-gated evaluation"* because Ramp's site shows **"Get started for free"** — the opaque-pricing thesis is contradicted by observed CTAs but `whyBinding` still says *"Not enough public evidence: subject-site CTA claim removed."* `confidence:0.33`. Fix: reconcile the free-signup CTA with the pricing-opacity claim. Status: Partially product-proven; binding-constraint logic internally broken.

**7. positioningPaidMediaPlan — 7/10** — Coherent 2-phase plan with row-level evidence packs. 5 `kpis`, `campaignPhases` at $25K/mo, 5 `anglesToTest`, `creativeFramework` grounded in real G2 + competitor data, `crossSectionInsight` linking demand + offer tensions, `projectedResults` honestly flags `$3,000 is cost per free-trial signup, NOT customer CAC... modeled customer CAC = $12,000–$30,000`. Fake/thin: `audienceTypes[3].dailyBudgetProvenance:"unknown"` ($153/day). `salesProcess` all empty URLs. Many `evidencePack.status:"gap"`. `feasibilityAudit` marks all 4 audiences `verdict:"unknown", volumeBasis:"missing measured keyword volume"`. `"$833/day"` unsupported. `counts_toward_rollup:false`. `confidence:0.81` is generous. Fix: tie audience budgets to measured keyword volume. Status: Code-patched (traceability live) but product value capped by insufficient upstream.

**8. Executive Synthesis — 6.5/10** — Clear single thesis, ranked decisions, but fact ledger noisy and thesis rests on unverified 40%. `executiveThesis` is a real one-liner. 4 `decisions` with `confidenceGrade` (A/B/C/C) and `provesWrongIf` thresholds. Contradictions surfaced. Fake/thin: thesis depends on "40% CAC overshoot" which is operator-asserted. `factLedger` `acv` `disputed:true` with readings spanning $1K-$10K, $50K+, **and $13B** (valuation leaked into ACV — bug). `monthly-budget` winner picked as "$100" not $25K. `fidelityStrikes` removed `"90%"` and `"0.2%"`. 6 contradictions. Fix: clean fact extraction. Status: Mechanically patched; fact-ledger hygiene still broken.

**Bottom line:** Only CompetitorLandscape (7.5) and PaidMediaPlan (7) clear a buyer's bar. VoC and BuyerICP are unbuyable. The 40%-CAC thesis driving the whole run is operator-asserted and internally contradicted by Ramp's own "Get started for free" CTA. The uncommitted patches are all still required.

### Agent B — Code/path truth of uncommitted patches

**Fix 1 — Paid Media Renderer (WS4) — FULL.** `paid-media-plan.tsx:369-382` adds `evidenceGapCell` reading `row.evidencePack?.status === 'gap'` → amber "Unverified — section-level citation only" pill, wired into audience/angle/review/channel columns (`:407,431,441,458`). Deck adds `GapStatusMarker` (amber left-border) on audience cards, angle articles, both insight pages, channel suggestions. Deck test asserts gap row renders 1 marker, grounded row renders 0 — genuine. **Missing:** the report's "proposed *test* budget (not a BudgetBar allocation)" for gap audience rows is NOT implemented — gap audience cards still render the same `money(audience.dailyBudget)` allocation. Buyer sees an amber chip beside a confident budget number. Partially buyer-facing correct. **Dependency:** P0a `withPaidMediaEvidencePack` wiring present at HEAD (committed `6b1bc3ed`).

**Fix 2 — VoC Permalinks (WS3/WS5) — PARTIAL (probe proves the gap).** `reviews.ts:168` adds TrustRadius regex to `reviewPermalinkPatternSources`; `buildReviewPermalinkResolver` now extracts TrustRadius per-review anchors. `trustradius.com` added to `site:` query and trusted-host set. Wiring complete for TrustRadius. **RED FLAG (honesty gap, not floor-lowering):** probe `tmp/probe/voc-permalinks-ramp.json` proves **Trustpilot listing scrape returns `mdLen:170, linkCount:0, anchorHits:{}`** — zero per-review anchors. The Trustpilot regex is shape-correct but the resolver will find nothing; Trustpilot bodies fall back to the listing URL and stay rejected. The report's mandated fallback ("clearly-labeled directional lane") was **not built**. Of 31 clean quotes: G2 (6) + TrustRadius (4) ≈ 10 can now pass; Trustpilot's 28 cannot. The "31 clean quotes pass admission, clearing 6/3 floor" claim is **not met**. No floor lowered. Headline outcome overstated.

**Fix 3 — Market Containment (WS3) — PARTIAL (bounding defect).** Bidirectional magnitude ($13B↔$13 billion) yes (`source-liveness.ts:461-472`); whitespace-insensitive yes (`:485`). Test assertions genuine. **RED FLAG (false-positive risk):** **NOT bounded to exact-magnitude equivalence.** `numberVariants('$13B')` still emits the bare `13` variant (from `noCurrency`/`noCommas` at `:443`), and `containsNumber` uses `haystack.includes('13')` — so a `$13B` claim matches a page saying `$13M` (or `$13`, or any `13` substring). The report explicitly mandated "bounded so $13B doesn't match $13M." No test asserts the negative case. Pre-existing weakness, but the fix was supposed to close it and didn't.

**Fix 4 — Competitor Prose (WS4) — PARTIAL (two mandates missing).** `reconcileAdEvidenceProseWithVerifiedCounts` (`competitor-ad-adapter.ts:1215-1252`) clamps prose DOWN: integer overclaim and vague-large words (`dozens/hundreds/many` when `totalVerified ≤ 2`) → deterministic summary. Wired at `run-section.ts:4847` inside `withNormalizedCompetitorAdEvidence`. Tests thorough. **RED FLAG (bar not raised as mandated):** (1) **`!isSubject` gate MISSING.** Wiring passes `normalizedAdEvidenceGroups` unfiltered. Ramp's 6 verified creatives inflate `totalVerified`, loosening the clamp for competitor prose. (2) **Recruiter-post downgrade MISSING.** No `/hiring|we're hiring|join our team/` heuristic anywhere. (3) Buyer-eval check "added AFTER the normalizer" — not in this diff.

**Fix 5 — Buyer ICP (WS5) — A+B full, C explicitly deferred (RED FLAG).** Root cause A (timeout) fixed: `run-section.ts:9426-9437` clamps `prepassDeadlineMs` to `remainingMs - labSectionEmitFloorMs`. Genuine. Root cause B (subject-own-exec) fixed: `personaCompanyReconcilesWithSubject` catches "Eric Glyman — CEO — Ramp" via company-label slug equality + registrable-domain match; wired into `buildBuyerPersonaCandidates`. Test asserts the exact case + back-compat. Robust. **C — case-study mining:** REAL acquisition, not a stub. `buyer-persona-case-study-mining.ts` makes live Firecrawl v2 map+scrape calls, bounded, abort-aware. Probe confirmed real pages fetched with real named attributions ("Bill Cox — New Way's VP of Finance", "Lauren Feeney — Controller, Perplexity"). Wired into prepass, merged AHEAD of Perplexity leads, pages pushed to evidence pool (both answer-tool + structured paths). **Venue reorder NOT done** — `BUYER_PERSONA_VENUES` still `[public_voices, reviewer_identities]`; `case_study_champions`/`event_speakers` remain second-pass. **RED FLAG:** **Second source-liveness persona-grounding gate (Fix C) NOT addressed.** Report line 78: "Ship A+B+second-gate together or the section still reads ~1/10. Shipping A alone would *look* like progress falsely." No diff touches the persona-grounding gate. The case-study mining *sidesteps* it, but Perplexity-led personas would still hit the divergent gate and ship 0. This is the exact false-progress mode the report warned against — mitigated only because case-study champions are now the primary, gate-clearing path.

**Fix 6 — Demand Discovery (WS5) — PARTIAL (2 of 4 endpoints).** `keyword-discovery.ts` wraps `getMostValuableKeywords` (domain) + `getRelatedKeywords` (seed) with per-row `spyfuKeywordUrl` permalinks, $0 CPC → null, 429→`rate_limited`, 500→`api_error`. Registered in `TOOL_CATALOG` and `positioningDemandIntent.allowedTools`. Order-sensitive pin updated. Tests genuine. **Missing:** **Only 2 of 4 dead endpoints wrapped.** `getCompetingPpcKeywords` and `getCompetingSeoKeywords` remain dead code. `MIN_SEARCH_VOLUME` is **not parametrized** — not even referenced in the new tool. Routing "through `keyword_volume`'s provenance gate" is prompt-only, no code-level forcing.

**Scope:** One out-of-scope modified file — `scripts/zz-drive-e2e-airtable.mjs` (multi-subject config, harmless harness generalization). New `scripts/zz-probe-*.mjs` + `zz-build-ramp-research-input.ts` are probes consistent with the report's "probe before building" mandate. `CLAUDE-FABLE-5.md` untracked — unrelated.

**Summary:** Fixes 1, 5A, 5B, 6-core are real and wired. Fix 2 is honest but **overstates outcome** (Trustpilot non-viable per probe; no directional lane). Fix 3 has a **bounding false-positive risk**. Fix 4 is **missing two mandated guards**. Fix 5 **ships without the mandatory second-gate fix** — the exact false-progress mode the report flagged, partially mitigated by case-study mining becoming the primary gate-clearing path. Fix 6 wraps **2 of 4**. No patch lowers a truth floor or admits laundered evidence; no stubs pretend to be real acquisition (case-study mining and keyword-discovery are live).

### Agent C — Proof harness and run state

**Test state:** `package.json` scripts: `test`, `test:run`, `test:gate` (4 gate suites), `lint`. **No `typecheck` script** — `npx tsc --noEmit` run manually. Test logs `tmp/baseline-tests.log` (Jun 16 14:45, 2386 tests passed) and `tmp/final-tests.log` (Jun 16 15:21, 2387 passed) **both predate the uncommitted patches.** No test log postdates the working-tree changes. Evidence the uncommitted patches were tested: **NONE.**

**Committed vs uncommitted:** HEAD = `8ae9152b`. Committed: `6b1bc3ed` (P0a+P0b), `353c60bc` (P1-VoC-count), `5fbf5b98` (WS1 telemetry). `git --no-pager diff --stat`: 19 files, +769/−54. `git status --short`: 19 M + 11 ??. The case-study mining / keyword-discovery / numberVariants / prose-reconciliation / gap-renderer work is **UNCOMMITTED**.

**Live run artifacts:** `tmp/grill/` latest full = `ramp-current-status` (Jun 17 17:16, run d2abf018) — reflects committed code only. **No run postdates the uncommitted patch set** (untracked files are 23:02–23:29; latest full grill dump is 17:16). Grep on `ramp-current-status/*.json`: `acquisitionLedger` 2 hits in BuyerICP ✓ (P0b committed); `evidencePack` 25 hits in PaidMedia ✓ (P0a committed); `keyword-discovery`/`numberVariants`/`keywordDiscovery` **0 hits** in Demand ✗; mined named-persona output **0 hits** in BuyerICP ✗; `personaReality.personas` still `[]` (0 of 3 required). `tmp/zz-section-out/_dump-positioningBuyerICP.json` (Jun 17 23:40) is the only artifact postdating the untracked `buyer-persona-case-study-mining.ts` (23:29) — partial evidence the new BuyerICP code was exercised, single-section env-gated dump, no manifest, no paired judge verdict, not a full run.

**Dump/judge scripts:** `scripts/zz-dump-run-sections.mjs`, `zz-judge-run.mjs` (21 KB), `zz-drive-e2e-airtable.mjs` (4 subjects: airtable/ramp/fathom/plain via `E2E_SUBJECT`, ~$4/24min, CDP to existing Chrome, Clerk-authed, polls Supabase read-only, writes `tmp/e2e-grill-<subject>/`). Judge harness latest = `tmp/judge/d2abf018/verdict.json` (Jun 17 16:07, 6.7, noFabrication:false) — judged `ramp-post-p0` (count=3), NOT `ramp-current-status` (count=2). Predates uncommitted patches.

**DB/run state:** Run IDs in artifacts: `d2abf018` (Ramp, only post-fix full run), `c9bc2056`/`3b568ea0`/`09f694d7` (Airtable, pre-fix), `0dc9720b` (old, pre-fix). **No `scripts/check-run.mjs`/`watch-run.mjs`** at `scripts/`; `tmp/check-run.mjs` is a one-off.

**Build/lint:** `tsconfig.json` + `eslint.config.mjs`. Baseline tsc logs exit=0.

**Missing proof to call product-ready:** (1) Live full Ramp rerun on UNCOMMITTED HEAD — no such run exists. (2) Re-judge on `ramp-current-status` (count=2 dump) to confirm `noFabrication` flips true — current verdict judges stale count=3 dump. (3) 3-subject sweep (Ramp+Fathom+Plain) all ≥8 + `noFabrication:true` — none of Fathom/Plain have post-fix runs. (4) Grep gates on the post-patch dump for the new uncommitted fixes. (5) Value-reades still open: BuyerICP persona promotion (0/3), VoC independent-domain depth (1/3, g2.com only).

Per `docs/reports/2026-06-17-gap-rootcause-and-8of10-roadmap.md` §3: Steps 1-3 DONE (committed); Step 4 PARTIAL (dump reflects committed code, not uncommitted); Step 5 green on P0a/P0b/P1 but **re-judge NOT run on count=2 dump**; Step 6 NOT STARTED.

### Agent D — Cross-section coherence and Paid Media inheritance

**Paid Media inheritance — real but partial.** Deterministic, conservative, not cosmetic. Each synthesized row carries an `evidencePack` with `status: "grounded"|"gap"`, `sourceSection`, and `refs[]` pointing at exact upstream `body.<array>[i]` locators with verbatim excerpts. Built by `withPaidMediaEvidencePack` (`run-section.ts:12607`), matches anchor tokens from `researchInput.committedPositioningArtifacts` against each synthesized row's salient text (`paid-media-evidence-pack.ts:637-688`). Coverage on this run (4 audienceTypes): Slot 3 (Competitor) grounded on `body.competitorSet.competitors[0]`; Slot 4 (VoC) grounded on 2 refs into `body.painLanguage.quotes[0,1]`; Slot 1 (MarketCategory) **gap**; Slot 2 (DemandIntent) **gap**. Of 5 `anglesToTest`, 3 gap. Of 6 `channelSuggestions`, **all 5 actionable ones gap**. Of 3 `competitorMarketingInsights`, all 3 grounded. Upstream gap propagation: BuyerICP `personas:[]` → PaidMedia LinkedIn channel gap; Demand `keywordDemand.blockGap.foundCount:0` → non-branded audience gap; MarketCategory no per-row structure → gap. So Paid Media gaps are **honest echoes of upstream evidence gaps**, not independent failures. Mechanism sound; inputs weak.

**Executive synthesis — real thesis, sharp.** `_manifest.json.executiveThesis`: *"Ramp's paid-search program can become a true demand-capture engine only after it removes the pricing opacity that inflates trial-start CAC by 40%, because every non-branded investment downstream depends on prospects being able to self-qualify before they talk to sales."* Real synthesis chaining three sections (OfferDiagnostic → DemandIntent → PaidMedia). `crossSectionInsight[0]` deepens it: tension name "Brand-defense moat vs. demand-capture engine," `sourceSections: ["positioningDemandIntent","positioningOfferDiagnostic"]`, contrarian inversion. Sharpest GTM insight in the dump.

**Demand → Paid Media — structural link shallow.** Schema link is section-enum only. The evidence-pack matcher calls `genericArrayCandidates(body, "keyword")` anchoring on `keyword` identity field. **No structural link between PaidMedia keyword rows and Demand's `keywordDemand` rows** — Paid Media has no keyword row schema. Audience slot 2 references Demand only at section level. The new `keyword-discovery.ts` feeds Demand; Paid Media consumes it only indirectly via model prose. No row-level structural link.

**VoC → Paid Media — real, quote-grounded.** Audience slot 4 refs `body.painLanguage.quotes[0,1]` with verbatim excerpts, `evidenceKind: painQuote`, `sourceSection: positioningVoiceOfCustomer`. Verbatim quote-level link. Real.

**Competitor → Paid Media — grounded but missing verifiedCount.** All 3 `competitorMarketingInsights` grounded on `body.competitorSet.competitors[i]`, but refs cite `oneLinePositioning` + `verbatimHeroCopy` only — **no row references Competitor's `verifiedCount` or `adEvidence.advertiserGroups`**. Every competitor row "angles" reads "Not enough public evidence: angles missing." Partial link.

**Buyer ICP → Paid Media — broken by upstream failure.** `personaReality.personas = []`, `blockGap.foundCount: 0`. PaidMedia LinkedIn channel row cites BuyerICP at section level only (gap). The `archetype` strings are model-synthesized from Competitor/Market prose, not from BuyerICP personas. `dailyBudgetProvenance: "model-estimated"`. **Single biggest inheritance break.**

**Consistency — manifest records 6 conflicts (5 critical).** `_manifest.contradictions` flags 5 critical numeric conflicts, all "resolved: true" but with setAsideCount up to 18 (monthly-budget). monthly-budget: Demand $200, MarketCategory $25,000/mo, OfferDiagnostic $18,000/$25K/$50K, PaidMedia $25,000/$100 → 18 readings, winner $100. acv: OfferDiagnostic $1K–$10K vs $3,000 vs PaidMedia $50K+ → critical. cac-target: 15 readings, winner $12,000–$30,000 (PaidMedia's modeled customer CAC) — contradicts OfferDiagnostic's $4,200 (trial-start CAC), but PaidMedia's `projectedResults[0].customerCacBandBasis` explicitly disambiguates. keyword-cluster:non-brand-capture-ceiling: Demand 100 measured vs PaidMedia "6+" → critical. **No TAM→budget reconciliation exists** (audience sizing uses `volumeBasis: "missing measured keyword volume"` for all 4 audiences → feasibility verdict "unknown" for all 4).

**Capstone test — biggest coherence failure:** A media buyer reading PaidMedia + exec thesis gets a coherent strategic narrative (Phase 1: pricing page + branded defense; Phase 2: non-branded probe; Phase 3: conquest) with clear KPIs and kill-switches. But they **cannot size a single audience** — `feasibilityAudit.verdicts` are all "unknown" with `matchedKeywords: []`. The capstone fails operationally because its capstone inputs (BuyerICP personas empty, Demand non-branded keywords empty) leave audience sizing ungrounded. **Single biggest cross-section coherence failure:** the BuyerICP → PaidMedia link is structurally present in code (`buyerICPCandidates` at `paid-media-evidence-pack.ts:573`) but **vacant in this run** because `positioningBuyerICP.personaReality.personas = []`. Every PaidMedia audience row falls back to model-synthesized archetypes with `dailyBudgetProvenance: "model-estimated"` and no firmographic/triggers inheritance. The capstone cannot target who to buy media against — the one thing a media buyer needs most.

**Code wiring confirmed:** `run-section.ts:12607-12610` calls `withPaidMediaEvidencePack({ artifact: verifierGate.artifact, committedArtifacts: researchInput.committedPositioningArtifacts })`. `paid-media-evidence-pack.ts:637-688` builds the pack per row; `enumerateUpstreamCandidates` (line 567-588) dispatches to `buyerICPCandidates` / `voiceOfCustomerCandidates` / `competitorLandscapeCandidates` / `genericArrayCandidates("keyword"|"offerSignal"|"marketSignal")`. Matching is anchor-token overlap (line 659-667), ≥1 overlap = grounded, else gap with the verbatim note "No exact upstream row in ${sourceSection} matched this synthesized row; cited at section level only." The wiring is real, deterministic, and the gap notes match the JSON exactly.