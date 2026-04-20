---
name: in-market-tier-routing
version: 1.0.0
category: media-plan
domain: strategy
description: Decision framework for allocating media-plan budget across three audience readiness tiers — in-market (3-4% of addressable audience), needs-convinced (~30%), cold-mass (rest). Promotes Jeremy Haynes' in-market tier framework from the scripts pipeline into media-plan budget allocation. Budget-gated so the tier mix cannot reintroduce the "budget sliced too thin" failure mode Mahdy flagged on 2026-04-19.
triggers:
  - channel mix and budget allocation
  - audience tier allocation
  - budget split across tiers
  - media plan block 1
canonical_source: src/scripts/refs/in-market-segments.md
---

# In-Market Tier Routing

## Purpose

Direct-response paid media has three audience readiness tiers. Each tier has different cost-per-conversion, creative requirements, and scaling dynamics. Allocating budget across tiers without discipline produces either (a) burning cold-mass budget at 5-10× the in-market CAC with thin creative budget per tier, or (b) concentrating only in-market and starving the funnel of the next cohort.

This methodology routes media-plan budget by tier using Haynes' framework AND respects the thin-budget discipline established in `channel-grounding.md` and Mahdy's round-2 feedback (campaigns capped at 2, single platform under $2k).

## Frameworks Applied

- **Jeremy Haynes — Direct Response Ad Creation Framework SOP.** Canonical reference at `src/scripts/refs/haynes-frameworks.md` + `src/scripts/refs/in-market-segments.md`. The tier definitions, tier-to-Schwartz mapping, and "master in-market first, then expand outward" principle are Haynes' — do NOT fabricate.
- **Chet Holmes 3% Rule** — referenced in `awareness-level-routing.md`. The 3% actively-buying slice is the in-market tier.
- **Thin-budget discipline** — Mahdy Etemad, 2026-04-19. Campaign count capped at 2 (`contracts.ts:532`). Platform tier gates in `channel-mix-skill.ts`. This methodology extends the same discipline to audience-tier allocation.

## The Three Tiers

Copied from `src/scripts/refs/in-market-segments.md` (single source of truth — do not fork):

### Tier 1: In-Market (3-4% of addressable audience)
- Already believe in the category / vehicle.
- Don't need "why" — need "which" or "who".
- Lowest cost to convert, shortest sales cycle.
- Maps to Schwartz: most-aware and product-aware.

### Tier 2: Needs Convinced (~30% of market)
- Want the outcome, not sure the method is right.
- Higher cost per conversion, higher no-show/churn risk.
- Maps to Schwartz: solution-aware and problem-aware.

### Tier 3: Cold Mass (rest)
- Not on the table initially. Education-first, long copy, slow build.
- Highest cost per conversion, chaotic lead quality if run at scale.
- Maps to Schwartz: unaware.

## Budget-Gated Allocation Table (LOAD-BEARING)

**This table is the coherence contract with existing thin-budget rules.** Tier allocation cannot introduce fragmentation before the platform rule in `channel-mix-skill.ts` allows fragmentation. When the budget permits only one platform, the tier mix permits only one tier.

| Monthly budget | In-market | Needs-convinced | Cold-mass | Rationale (mirrors platform tier rule) |
|---|---|---|---|---|
| Under $2k | **100** | 0 | 0 | Single platform + single tier. No axis allowed to fragment. "Master in-market first" (Haynes). |
| $2k–$5k | 80 | 20 | 0 | Secondary platform allowed → secondary tier allowed. Cold-mass still blocked — no budget for education. |
| $5k–$15k | 60 | 30 | 10 | Full multi-platform → full 3-tier. Cold-mass capped at 10% (same spirit as the 70/20/10 platform rule). |
| $15k+ | 50 | 35 | 15 | Aggressive multi-platform → aggressive tier mix. Cold-mass still minority. |

Default tolerance: ±5 percentage points per tier. Deviation beyond tolerance requires rationale in `strategicFrame.funnelSplitRationale`.

## Tier-to-Schwartz Consistency Rule

The tier mix and awareness-level routing must agree. If the ICP's classified awareness level is `unaware`, a 100% in-market mix is internally incoherent — there is no in-market audience.

Alignment rule:

- If `awarenessLevelApplied` is `unaware`: tier mix must skew toward cold-mass if budget permits it (≥$5k), or flag `validationWarnings: "Unaware market × under-$5k budget: no coherent tier mix. Recommend deferring launch until budget clears multi-tier gate."`
- If `awarenessLevelApplied` is `problem-aware`: needs-convinced-dominant mix.
- If `awarenessLevelApplied` is `solution-aware`: 50/50 in-market / needs-convinced (solution-aware straddles both tiers in `in-market-segments.md`).
- If `awarenessLevelApplied` is `product-aware` or `most-aware`: in-market-dominant (per the mapping table in `in-market-segments.md`).

When awareness-level routing and the budget-gated table conflict, **respect the budget gate first** (Mahdy discipline) and flag the conflict in `validationWarnings`. Example: a $1,500/mo plan targeting a fully unaware market cannot be made coherent — the plan should flag the mismatch rather than fabricate a 100% cold-mass mix at $1.5k (which would immediately violate the thin-budget rule).

## Decision Rules

1. Classify the awareness level from `identityCard.awarenessLevel` (per `awareness-level-routing.md`).
2. Read `budgetSummary.totalMonthly` from the draft block 1 output (or the input budget constraint).
3. Select the budget-gated row from the table above. That is the starting mix.
4. Adjust within ±5 pp based on the awareness-level consistency rule.
5. If the awareness level + budget combination is incoherent (see rule above), output the in-range default mix AND add a warning.
6. Output the final mix in `strategicFrame.inMarketTierMix`. The three values MUST sum to 100 (±1 rounding tolerance).

## Forbidden Moves

- Cold-mass > 0% when budget < $5k. The thin-budget rule trumps every other consideration.
- Needs-convinced > 0% when budget < $2k. Single-tier discipline under the smallest budget gate.
- A tier mix that contradicts the awareness level without an explanation in `funnelSplitRationale`.
- Equal splits (e.g., 33/33/33) — Haynes' principle is concentration, not diversification. If the math wants equal splits, the budget gate has already been violated.

## Output Guidance

The `strategicFrame.inMarketTierMix` field is the structured output of this methodology. Block 1 fills it. Blocks 2 (audienceCampaign), 3 (creativeSystem), 5 (rolloutRoadmap), and 6 (strategySnapshot) consume it via `previousBlocksContext`:

- **Block 2** should produce segments in priority order matching the tier weights. If in-market is 60%, the first 60% of budget-weighted segments are in-market.
- **Block 3** should produce creative angles distributed across tiers per `in-market-segments.md` creative guidance (in-market = "you already know", cold-mass = story-driven build).
- **Block 5** rollout phases should start with the tier that has the most budget (usually in-market) and expand outward per Haynes.
- **Block 6** snapshot must report the tier mix as part of the strategic summary.

## Escalation

If the plan can only produce a coherent tier mix by violating the budget gate (e.g., genuinely unaware market + £1.5k budget + client insists on launch), output the in-range default mix AND add a top-level warning: `"Budget-awareness mismatch: tier mix capped at 100% in-market by budget gate, but awareness classification is unaware. Plan will under-perform until budget clears $5k threshold or awareness evidence strengthens."`
