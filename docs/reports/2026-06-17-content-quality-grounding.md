# Content-Quality Grounding — the real path to 8/10 (Ramp run d2abf018)

**Date:** 2026-06-17
**Method:** 7-agent grounding swarm (one per low-scoring section + an adversarial scrub-to-pass guardrail). Every claim verified against the **real Ramp artifacts** (`tmp/grill/ramp-current-status/*.json`, `docs/reports/buyer-eval-d2abf018.*`) and **current code** — not memory. The bar is the **human value-read**, not code-level evals.
**Companion:** parent map `docs/plans/2026-06-17-research-presentation-model-plan.md`.

> **The headline:** the value is mostly **suppressed, not missing**. 4 of 6 fixes need **zero new data** — the strategist already had the evidence; gates dropped it or prose oversold it. Only BuyerICP + Demand need genuine new acquisition. **Guardrail verdict: CLEAN** — no fix lowers a floor or admits laundered/paraphrase/fabricated evidence; two fixes actively *raise* the bar.

---

## Leverage-ordered execution queue (DECIDED 2026-06-17)

Each fix = one tight Codex handoff, reviewed against spec, run through the proven loop. WS2 RPM continues in parallel as the readability floor.

| # | Section | Fix (one line) | Type | New data? | Risk |
|---|---|---|---|---|---|
| **1** | Paid Media (capstone) | Renderer reads `evidencePack.status` → gap rows render as "hypothesis to test", not confident allocations | classify | **none** | low |
| **2** | Voice of Customer | Per-review permalink resolver (Trustpilot/TrustRadius) so 31 clean verbatim quotes pass admission honestly | acquire-right | none* | med (live-scrape dep) |
| **3** | Market Category | Bidirectional + whitespace-insensitive magnitude containment → real $13B/70k corpus facts stop being dropped | classify | **none** | low |
| **4** | Competitor | Extend single-writer to clamp ad-evidence **prose** down to structured `verifiedCount` | classify / raise-bar | **none** | med |
| **5** | Buyer ICP | Budget-aware prepass + solo rerun (timeout) **+** subject-own-exec rejection **+** 2nd grounding gate | acquire + raise-bar | yes | high |
| **6** | Demand Intent | Wire the 4 dead-code SpyFu discovery endpoints as a `keyword_discovery` tool | acquire-right | yes | high |

\* VoC needs no new *acquisition* — only correct citation of already-scraped bodies — **but hinges on a live-scrape probe**: does the Trustpilot/TrustRadius index markdown actually expose per-review hrefs within `maxPermalinkAnchorDistanceChars` (6000)? Run **one** probe before authoring its handoff; if not, the honest fallback is a clearly-labeled directional lane.

---

## Per-section findings

### 1. Paid Media Plan — 3.5/10 — `present-but-dropped` (WS4)
- **Root cause:** `paid-media-plan.tsx` references `evidencePack` **zero** times; basis badges come from `provenanceLabel` + free-text regex, never the authoritative per-row `evidencePack.status` ('grounded'|'gap') that *is* computed (`paid-media-evidence-pack.ts:648/671`), *is* in the client schema (`paid-media-plan.ts:138`), and *is* persisted. So 13/25 rows (52%) flagged `status:'gap'` — incl. **60% of daily spend** ($500 of $833) — render identically to grounded rows. Separately the review LLM logged `removedItems[0]="Removed '$153/day (provenance unknown)'"` it never removed; the honesty guard `enforceReviewRemovedItemsHonesty` (`agentic-section-review.ts:380`) missed it because the quoted phrase is split across JSON keys / markdown `**` so the full-phrase bare-string match returns false.
- **Proof:** 25 rows w/ evidencePack: 12 grounded / 13 gap. "16 MQL" = $25,000×2÷$3,000 = 16.67 (budget÷your-own-target, `provenance:'derived'`). $153 still in `body.audienceTypes[3].dailyBudget`. (NB: `removedItems`/`upgradedMarkdown` do NOT reach the buyer — `commit-patch.ts:165` keeps canonical markdown — so Fix B is internal-log hygiene, lower priority.)
- **Fix A (buyer-facing, primary):** drive display from `row.evidencePack?.status`: gap audience rows → "Hypothesis to test — no matched upstream evidence" chip + proposed *test* budget (not a BudgetBar allocation); gap `channelSuggestions` → "Proposed (unvalidated)"; `dailyBudgetProvenance==='unknown'` ($153) → "budget unknown — needs client input". **Zero new data.**
- **Fix B (internal):** in `hasFalseRemovalClaim`, also test the numeric value-token inside the quoted phrase; if it still appears bare in searchText, the removal claim is false → drop. Add the d2abf018 entry as a fixture.
- **8/10 reads:** an honest two-tier deck — a small grounded core (Brex-vs $180/day backed by competitor row; reconciliation-pain audience backed by 2 real G2 quotes) clearly separated from explicitly-labeled "hypotheses to test" with test budgets. No confident allocation rests on an unvalidated query.

### 2. Voice of Customer — 2/10 — `acquired-then-rejected` (WS3/WS5 mixed)
- **Root cause:** admission gate runs BEFORE the selector and rejects on **URL shape**, not text quality. `getAdmissibleVoiceOfCustomerCandidates` (`run-section.ts ~L8683`) → `evaluateQuoteAdmission` (`quote-admission.ts:321`) → `isPermalinkishUrl` (`:153`). Only `g2.com/survey_responses/ramp-review-NNNNN` passes; Trustpilot `/review/ramp.com` and TrustRadius `/reviews` are killed. Upstream cause in `tools/reviews.ts`: `buildReviewPermalinkResolver` (`:177`) + `reviewPermalinkPatternSources` (`:160`) only resolve g2/capterra/trustpilot shapes and fall back to the **listing** URL when no per-review anchor is found (`:211`); TrustRadius isn't even in the `site:` query (`:1229`). So clean review *bodies* carry index URLs → stripped at admission → 3 honest domains collapse to 1 → `insufficient_independent_domains` → ships 2 quotes.
- **Proof:** ledger 79 rows: scrape/parser succeeded 71; promoted **2** (both g2 survey_responses), rejected 59 (`insufficient_independent_domains`=57). The 57 span 7 domains (trustpilot 28, stampli 9, g2 6, youtube 6, trustradius 4, getkleercard 3, capterra 1). Classified: **31 CLEAN first-person verbatim** (g2+trustpilot+trustradius), 9 third-party/paraphrase, 17 junk/DOM-chrome. Samples that SHOULD count: *"the onboarding is terrible… success manager… could only meet with us twice"*, *"the constant lowering of our credit limit when our bank balance decreases"*, *"exports fail when importing into QuickBooks"*, *"upload a bank statement once a month - painful!"*. Junk correctly excluded (youtube playback chrome, capterra methodology, trustpilot memo-paraphrase).
- **Fix (acquire-the-right-thing):** (1) `tools/reviews.ts` — add a TrustRadius per-review permalink pattern + extend `buildReviewPermalinkResolver` to resolve each parsed review block on a Trustpilot/TrustRadius **index** page to its owning per-review anchor (resolver already does this for g2); add `trustradius.com` to the `site:` query. → 31 clean quotes carry REAL per-review citations and pass `isPermalinkishUrl` honestly, clearing the **full 6-quote/3-domain floor**. (2) Optional directional-evidence lane for genuinely-permalink-less platforms — clearly labeled, never written into `painLanguage.quotes` as if permalinked.
- **No floor relaxed:** `isPermalinkishUrl`, human-voice check, truncated-fragment check, 6/3 floor all stay. Keep stampli/getkleercard (third-party) OUT of the verbatim floor.
- **Risk:** depends on the live index markdown exposing per-review hrefs — **probe before building**. Some clean rows carry a "See more" truncation tail → need a clean full-body re-scrape, not gate relaxation.
- **8/10 reads:** ~8-12 attributed verbatim complaints across G2/Trustpilot/TrustRadius, themed with intensity — field-grade buyer voice you pull ad angles + objection-handling from.

### 3. Market Category — 5/10 — `mixed` (WS3)
- **Root cause:** `numberVariants()` (`source-liveness.ts:439-468`) only expands magnitude **suffix→digits** (`$13B`→`13000000000`), never the word form, AND strips all whitespace from the needle (`13 billion`→`13billion`) while the haystack keeps single spaces. So `$13B` and `$13 billion` can never match the same live page. `containmentPasses()` (`:479`) requires every number to match → one co-located token (a `2025`, a trailing `+`) drops the whole row. `installBlockGapsForEmptiedBlocks` (`~:553`) then force-empties the block.
- **Proof:** corpus has $13B (conf-95 quote *"Today, Ramp is announcing a new valuation: $13 billion"*, `ramp.com/blog/behind-the-valuation-march-2025`) and 70,000 (conf-95, `ramp.com`) — clean first-party verbatim. Artifact: `marketSize.signals=[]`, all 3 signals dropped `reason="containment-mismatch"`, `containmentPassRate=0.5`; facts demoted to "(per client brief)" with an openQuestion asking the very number that's in corpus. (bottomUpTam keyword inputs are **genuinely missing** — corpus has zero keyword-volume data — so their gap is correct, not a bug.)
- **Fix (classify-don't-lower):** make `numberVariants()` bidirectional ($13B↔$13 billion, bounded to exact-magnitude equivalence) + whitespace-insensitive; treat a number as contained if it appears in a corpus excerpt the entailment verifier already matched (`matchedSourceRef.kind=corpusExcerpt`). Restores ≥2 real signals. bottomUpTam keyword formula stays an honest gap.
- **Risk:** keep `source-liveness.test.ts` green (containment-mismatch assertions @74/368/438 — confirm those are genuine fabrications, not the same false-negative).
- **8/10 reads:** 2-3 real, dated, subject-sourced trajectory signals ("Ramp valued at $13B, Mar 2025", "70,000+ companies") instead of "could not be independently verified"; top-down sizing anchored.

### 4. Competitor Landscape — 5.5/10 — `present-but-dropped` (WS4)
- **Root cause:** `adEvidence.prose` is free-text `z.string().min(1)` (`competitor-landscape.ts:278`) the model paraphrases UPWARD and nothing reconciles it. The verifier never extracts a claim for a bare integer ("29 Meta creatives") or the bare adjective "verified" (`claim-extractor.ts:57-92`). The single-writer clamp `normalizeCompetitorLandscapeBody` (`:582`) skips `adEvidence.prose`, uses `creatives.length` not `verifiedCount`, and only fires on `/(\d+)\s+verified/`. The structured layer is honest (renderer chip reads `verifiedCount`, shows basis='gap' for 0) but the prose printed above it launders `verifiedCount=0` into apparent live ad presence.
- **Proof:** prose "Brex has 29 Meta creatives… Airbase runs verified LinkedIn creatives" vs structured: Brex `verifiedCount=0`, `quarantinedCount=6`, `identityConfidence=low`; Airbase 6 "verified" LinkedIn = **5/6 recruiter posts** ("We're hiring a BDR!", "I'm hiring!…") + 1 product ad. Reject pile = genuine junk (null-headline google rows), no real ad wrongly dropped.
- **Fix (classify-don't-lower / raise-bar):** extend the existing single-writer with `reconcileAdEvidenceProseWithVerifiedCounts` — clamp prose counts/adjectives DOWN to structured `verifiedCount` and inject the quarantine qualifier; downgrade the adjective "verified" for recruiter posts (heuristic `/hiring|we're hiring|join our team/`). String-surgical (no model re-gen). Gate on `!isSubject` so Ramp's true "6 verified" claim is untouched. **Never delete a creative** — downgrade the adjective only. Mirror with a buyer-eval check (added AFTER the normalizer).
- **8/10 reads:** counts and "verified" mean exactly what `verifiedCount` says — "only Airbase runs a citable product ad; Brex/Rho are identity-unverified empty rows; Ramp's 6 verified Meta creatives are the only real ad wall" — buyer acts on the white space instead of discounting the section.

### 5. Buyer ICP — 1/10 — `mixed`, TWO failure modes (WS5)
- **Root cause A (timeout):** unconditional 70s buyer-persona prepass (`run-section.ts:10589`, `buyerPersonaPrepassDeadlineMs=70_000` @:9362, signal NOT clamped to remaining budget @:9373) on top of the agent loop inside a per-section 285s deadline (`LAB_SECTION_JOB_TIMEOUT_MS`, not divided across 6-way `Promise.allSettled` fan-out). Under contention → deadline-exhaustion → `buildDeadlineExhaustionHonestGapBody` (`:2715`) ships empty body + 5 fake `ramp.com/#section-gap-N` sources (`:2657`).
- **Root cause B (wrong-target):** no subject-own-exec exclusion anywhere (`isLikelyNamedBuyerIdentity` @`buyer-icp.ts:191` only checks name-token shape; `vendorSourced` is a label, never a rejection). In d2abf018 all 5 candidates were `event_speakers`; 3/5 were Ramp's own CEO/COO/PMM.
- **Root cause C (SECOND grounding gate — the concern):** a divergent capture (`ramp-fresh`) did NOT time out yet still shipped 0 personas via a source-liveness "could not be independently verified" gate. **Fixing A alone leaves it ~1/10.**
- **Proof:** artifact verdict "exceeded its time budget — rerun", `personas=[]`, all 5 sources `ramp.com/#section-gap-N`. Contrast: airtable run 09f694d7 shipped 10 real EXTERNAL personas w/ firmographics (same code, no timeout) — so the section CAN work.
- **Fix (acquire-right + raise-bar):** (A) budget-aware prepass — skip/clamp when remaining < ~150s; auto solo-rerun off the fan-out path on deadline-exhaustion (per learned-patterns: solo `/rerun-section` completes <285s). (B) reorder venues so `reviewer_identities` + `case_study_champions` run first, demote `event_speakers`; add a `subject_own_company` rejection (RAISES the bar). (C) fix the second persona-grounding gate **in the same wave**.
- **8/10 reads:** 3+ named EXTERNAL personas with firmographics + in-market trigger + reachable channel, sourced to real URLs, explicitly excluding the subject's own execs.

### 6. Demand Intent — 3/10 — `genuinely-missing` (WS5)
- **Root cause:** no keyword-discovery tool. `section-registry.ts:277` grants only passive probes; `keyword_volume` (`tools/keyword-volume.ts:105`) imports only `getKeywordsByBulkSearch` (you must already know the keyword; SpyFu returns 0 otherwise). The 4 real discovery functions — `getMostValuableKeywords` (`spyfu-client.ts:541`), `getRelatedKeywords` (:564), `getCompetingPpcKeywords` (:489), `getCompetingSeoKeywords` (:433) — are **dead code, imported nowhere live**, not in `TOOL_CATALOG`. `MIN_SEARCH_VOLUME=50` (:68) is applied only inside those dead functions → was NOT this run's blocker.
- **Proof:** artifact `keywordDemand.keywords` = 4 branded terms only ("ramp" 27,200/mo, "ramp pricing" 44, "ramp reviews" 23, "ramp alternatives" 32); `blockGap.foundCount=0`; all 9 verified claims `toolName="keyword_volume"`; **no keyword rows in any reject pile** — the discovery call was never made.
- **Fix (acquire-right):** add a `keyword_discovery` lab tool wrapping the existing endpoints; register in `TOOL_CATALOG` + add to `positioningDemandIntent.allowedTools` (**update `section-registry.test.ts` order-sensitive pin in the same change**); route discovered candidates through the existing `keyword_volume` tool so they pass the same row-level provenance gate; parametrize `MIN_SEARCH_VOLUME` (default 50; never a path to model-invented volumes — keep `demand-intent.ts` provenance gate intact). Target ≥10 non-branded terms w/ real volume+CPC.
- **8/10 reads:** a real non-branded keyword universe (spend management software, corporate card for startups, AP automation…) with SpyFu volume/CPC/difficulty + top-ranking domains — a buildable paid-search plan, not "we still need to probe 50+ queries."

---

## Guardrail verdict — CLEAN, with watch-items
All 6 fixes are acquire-the-right-thing or classify-don't-lower; **none cheats the value-read**; two (BuyerICP own-exec rejection, Competitor prose reconciliation) actively **raise** the bar.

- **Concern — Demand `MIN_SEARCH_VOLUME`:** the only downward-threshold touch. Verified it's a volume knob (admits more *real* SpyFu rows), not a truth floor. Keep default 50; never let a lowered floor become a path to model-invented volumes; keep coupled to the provenance gate.
- **Concern — BuyerICP second gate:** Fix A *surfaces* the source-liveness persona-grounding gate without resolving it. Ship A+B+second-gate together or the section still reads ~1/10. Shipping A alone would *look* like progress falsely.
- **Minor — Competitor:** add the new buyer-eval check AFTER the normalizer (so it verifies real output, not authored to pass current dishonest prose); keep the recruiter-post heuristic conservative and downgrade-adjective-only (a false "recruiter" tag would understate a real ad).

## Hard guardrails for every handoff (non-negotiable)
- Never lower a truth floor. Never admit laundered/paraphrase/fabricated evidence.
- The bar is the human value-read, not a green eval. A fix that only makes a gate green without making the output better is a failure.
- Verify against the real artifact + a live probe where the fix's viability depends on live behavior (VoC permalinks, BuyerICP timeout).
