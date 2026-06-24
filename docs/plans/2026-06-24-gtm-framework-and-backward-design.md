# AIGOS — GTM Framework Confirmed + Backward Design to the Media Plan

**Date:** 2026-06-24 · Source: two grounded workflows (`wf_80c0f875-63c` framework confirmation, `wf_85a65acb-035` backward design), each reading the authored `SKILL.md` + schemas. Companion to `docs/plans/2026-06-23-final-agentic-architecture.md`.

**North star:** the 13-block paid-media deck (`positioningPaidMediaPlan`) is the deliverable the team bills to clients. The 6 positioning sections + onboarding exist only to fill it. Read everything backward from that.

---

## 1. The framework is sound — one causal GTM argument, not 6 reports

Market picks the shelf → BuyerICP names who's on it + what moves them → Competitor frames what they'd buy instead → VoC supplies the language → Demand says capture-vs-create at the operator's CAC → Offer says whether the offer can absorb spend → PaidMedia resolves the cross-section contradictions into the deck. **Deliberately pre-launch-specific** (clients have no customers/spend/proof) — which is *why* VoC inverts to competitors. It would be the wrong framework for a mature client; that's a scope choice, not a gap.

### The 9 non-obvious framings (every section has a "VoC trap")
A naive reading of the section *name* builds the wrong thing. These are the real intent:

| Section | Generic (WRONG) | Framework (RIGHT) |
|---|---|---|
| Market | TAM/players/growth map | Commit to ONE shelf to buy traffic in; lead with the single "why now" asymmetry; TAM as a *posture*, never a fabricated $ |
| BuyerICP | "Alice, VP Fin, 35" persona | Evidence-grounded buyer; **anti-ICP (who is NOT the buyer) is load-bearing**; awareness = prior *belief state*, not funnel stage |
| Competitor | Feature-grid 2×2 | "What would they do instead" — **status-quo/DIY are first-class**; naming where you *lose* is a trust win; weakness = recurring across reviewers |
| VoC | Analyze *your* reviews | Mine **competitors'** reviews as PRIMARY; own-voice a labeled bonus; tag every quote subject-own/competitor-`<name>`/category |
| Demand | Top-10 keywords by volume | Capture-now vs create-later, judged vs the operator's CAC; content gap needs demand AND weak incumbent answer |
| Offer | Describe product/value-props | The SINGLE binding constraint blocking spend scale |
| PaidMedia | Fill a funnel template | Thesis from cross-section **contradiction**; cite a section only if `sufficiency.tier` ≠ insufficient, else gap |

**Cross-cutting law (all sections): honest gap > fabrication.** Drop it in the rebuild and the product collapses to slop.

### Implementation fidelity = HIGH, with 3 drift risks concentrated in prompt/runner logic (not schema)
1. **Demand** — a Jun-22 note hints an earlier exemplar leak genericized the operator-economics framing; verify it's hardened before rebuild.
2. **PaidMedia** — the "don't cite insufficient sections" law is enforced at generation/prompt time, not schema; easiest to lose in the agentic re-platform.
3. **BuyerICP** — downgrade-not-delete mode; a naive re-read of the artifact re-launders demoted rows. (This is also why a blanket `verifierDowngradeMode` flip on other sections launders — see the 2026-06-23 plan.)

---

## 2. The backward chain (the deliverable, traced to its sources)

```
ONBOARDING (52 fields today)        CORPUS (Perplexity deepResearchProgram)
   competitorSeeds ← topCompetitors    evidence + intelligenceTopics → sectionExcerpts
                    └──────── corpusToResearchInput() → ResearchInput ────────┘
                                         │
        ┌──────── 6 SECTIONS (parallel) ─┴───────────────────────────────────┐
        │ Market  BuyerICP  Competitor  VoC  Demand  Offer                    │
        └──────────────────┬──────────────────────────────────────────────────┘
                           ▼  positioningPaidMediaPlan (LAST, reads all 6)
   13 BLOCKS:  1 CampaignOverview ◄gtmBrief  2 Phases ◄gtmBrief  3 Audience ◄BuyerICP+$
   4 CreativeStrategy ◄gtmBrief[runner]  5 Angles ◄VoC+Demand+Market+Competitor
   6 CreativeFramework ◄Offer+VoC+Market  7 Funnel ◄Offer+BuyerICP  8 SalesProcess ◄gtmBrief[static]
   9 CompetitorMktg ◄Competitor+Market[ad spend=GAP]  10 CompetitorReview ◄VoC+Competitor
   11 ChannelSuggest ◄Offer+BuyerICP  12 KPIs ◄gtmBrief  13 CrossSectionInsight ◄all 6
   (Projected Results ◄gtmBrief+Offer+Demand, computed in code)
```

Clean template blocks (1,2,4,8,12) fill from the GTM brief. The **load-bearing synthesis** (3,5,6,9,10,11,13 + Projected Results) is where the deck earns its fee — and where it breaks.

---

## 3. The fulfillment gaps — why decks come out thin (ranked)

| # | Block | Why it can't be reliably filled | Severity |
|---|---|---|---|
| **G4** | Projected Results | Financial spine. CPC **hardcoded** (li=10/google=4/meta=1.5), never measured; CVR from blank onboarding; zero row-level grounding; ±20% band implies false precision | 🔴 |
| **G1** | Audience (B3) | From BuyerICP, which can **commit empty** (rollup-padding) → paid-media ships a fabricated "evidence gap" audience row; no readiness barrier fails it | 🔴 |
| **G3** | Competitor Review (B10) | Template wants exactly 3; schema has no min/max → when <3 found, the human fabricates rows 2–3 **outside the code** (silent human fabrication) | 🟠 |
| **G6** | Competitor Mktg (B9) | Needs competitor adPlatforms + estSpend; **no section captures competitor ad presence** (no Ad Library/Semrush); no competitor-attributed-ICP field → whole columns fabricated | 🟠 |
| **G2** | Funnel (B7) | min(1) but not in evidence-pack; empty Offer → confident scaffold rows with no source | 🟠 |
| **G5** | 4 of 10 array blocks | Only 6/10 blocks carry an evidence pack; the other 4 inject boilerplate when suppliers empty | 🟡 |
| **G13** | Cross-Section (B13) | sourceSections min(2) → normalizer appends synthetic `gtmBrief` leg → false two-source attribution | 🟡 |

**Root cause (the one alignment risk):** the schema forces a complete-**looking** deck (`.min(N)` floors) before it forces a **true** one — and the 4 most load-bearing blocks (Audience, Projected Results, Funnel, Competitor intel) have the *weakest* grounding contracts. The system is optimized to never ship a blank cell, which is the opposite of filling the template truthfully.

**Fix direction:** a buyer-eval gate that **fails the paid-media commit when a synthesized block ships confident content while its supplier section is empty/below-floor**; extend the evidence pack to all 10 array blocks; mark hardcoded-CPC projected rows "directional — not measured."

---

## 4. The onboarding reframe — "use the onboarding to get it right" (validates the owner's day-1 instinct)

The owner's first instinct ("we can make them do the onboarding fully… then go from there" — i.e. let the agent do onboarding) is **the right call, now concrete.** In the agentic rebuild, most onboarding questions are things an un-caged agent can *research* — asking the human for them is friction the agent should absorb.

**RESEARCH autonomously (stop asking):** identity/category/description (corpus-prefilled, agent confirms); **competitors** (← this dissolves the `topCompetitors`="idk" → empty-seed → starved-Competitor cascade entirely; keep the field only as an optional steer); ICP roles/triggers/awareness/objections/switching-stories (mine reviews, case studies, G2/forums); competitor ad presence + spend (agent-with-tools is the *right* owner of the B9 gap — the human can't supply it reliably); channel-truth (partially public; human version = cross-check).

**ASK the human (genuinely uninferrable — the real ~10-question onboarding):** budget + committed-vs-aspirational + confidence; primary 90-day goal/KPI (MQLs vs trials vs pipeline $); creative capacity + lead-list availability; target CAC / target volume; sales-process assets (URLs/Loom); the real CVR chain (visitor→signup→activation→paid) **if known** — these are the Projected Results inputs and are private analytics.

**Reframed onboarding ≈ 10 questions, all about money, goals, constraints, and private numbers the agent can't see.** Everything else the agent earns. (Also: today 12 Step-6 fields + `channelSignals` + `salesLoomUrl` are collected but never threaded — cut or wire; the 3 CVR fields + currentCac must be **wired**, they're the Projected Results inputs.)

---

## 5. What this means for the build (and for Market + VoC now)

**Principle: score sections by the TEMPLATE CELLS THEY FILL, not in isolation.** A VoC that scores 8 on its own card but returns 1 quote still ships a gapped Block 5. The value-read must check the downstream cells.

**VoC feeds Blocks 5, 6, 10 (the highest-value creative cells). The un-caged agentic VoC must produce:**
- ≥2 `painLanguage.quotes[]` with verbatim text + live `sourceUrl` (Block 5 angles).
- `objections.items[].howToHandle` + success language (Block 6 hooks).
- **≥3 switching stories** — why buyers *left a competitor*, from independent review sources — to kill G3 honestly (the cell humans fabricate by hand today).
- Readiness precondition: corpus evidence routed to `positioningVoiceOfCustomer` must be non-empty.

**Market feeds Blocks 5, 6, 9, 13. The un-caged agentic Market must produce:**
- The category power bet / positioning thesis → angles + hooks (B5/B6).
- One **falsifiable positioning claim** concrete enough to *contradict* what VoC finds → so Block 13 cross-section tensions are real, not the synthetic-`gtmBrief`-leg fake.
- TAM as a two-input posture, never a fabricated figure.

**Build aim:** the Market + VoC slice (un-cage agentic, per the 2026-06-23 plan) is now aimed at these specific cells. The live-run pass criterion is not "the section card looks good" — it's "Blocks 5/6/10 (VoC) and 5/6/9/13 (Market) fill with grounded rows, or honestly gap."

---

## 6. Scope note

This is alignment + understanding. It does NOT change the immediate Market+VoC slice mechanics (un-cage agentic, observable telemetry, VoC dead-path→honest gap, drop the laundering flag). It *sharpens the target*: score by template cells, and hold VoC/Market to the concrete outputs above. The onboarding reframe (§4) and the buyer-eval gate (§3 fix) are **orchestrator/paid-media-phase work — not this slice** — but are now locked direction.
