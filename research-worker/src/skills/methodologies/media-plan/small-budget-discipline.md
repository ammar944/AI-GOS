---
name: small-budget-discipline
version: 1.0.0
category: media-plan
domain: strategy
description: Decision framework for sub-$5k monthly budgets. Aggregates Halbert's first-dollar test, Haynes' concentration-not-diversification principle, and Justin Brooke's single-campaign-first rule into a tight set of rules that prevent the "spread too thin across 3 platforms and 4 campaigns" failure Mahdy flagged on Choros ($3k split across Meta/Google/TikTok). Budget under $5k → ONE platform, ONE campaign, ONE tier, ONE creative angle at launch. Every axis of fragmentation must be earned by evidence.
triggers:
  - small budget allocation
  - single platform decision
  - campaign count ceiling
  - media plan blocks 1 and 2
canonical_source: src/scripts/refs/haynes-frameworks.md
---

# Small Budget Discipline

## Purpose

Mahdy's round-3 feedback on Choros was unambiguous: "3k budget is nowhere near sufficient to be split tested across multi platform, let alone multi campaigns on a platform." The system had produced a plan splitting $3k across three platforms (Meta / Google / TikTok) with multiple campaigns each. That plan was structurally unlaunchable — no axis had enough spend to learn.

Small-budget discipline is the counter-rule: under $5k/mo, every axis of fragmentation (platform, campaign, tier, creative angle) must start at ONE and only widen when the data earns the second.

## Frameworks Applied

- **Gary Halbert — "First Dollar Test"** (see `benchmark-selection.md`). Sub-$3k is a PMF diagnostic, not a scaling exercise.
- **Jeremy Haynes — Concentration Principle** (see `in-market-tier-routing.md`). "Master in-market first, then expand outward." Equal splits are forbidden because they're diversification, not concentration.
- **Justin Brooke (Adskills) — Single Campaign First**. Run ONE conversion campaign until it's broken. A second campaign is only earned by statistically confident learnings from the first.
- **Mahdy Etemad — Thin-Budget Rule** (2026-04-19, round 2). Campaign count capped at 2. Round-3 tightening: at under $5k, campaign count capped at 1. The platform tier gate in `channel-mix-skill.ts` already forbids multi-platform under $2k — this methodology extends the same discipline to every other axis.

## The Five Axes and Their Ceilings

At small budget, every axis starts at 1. Each axis has its own gate for widening:

| Axis | < $2k | $2k–$5k | $5k–$15k | $15k+ |
|---|---|---|---|---|
| Platforms | 1 | 1 | 2 | 3 |
| Campaigns per platform | 1 | 1 | 2 | 3 |
| In-market tiers | 1 (all in-market) | 2 (in-market + needs-convinced) | 3 | 3 |
| Creative angles at launch | 2-3 (same campaign, A/B test) | 3 | 4-5 | 5+ |
| Ad sets per campaign | 2 | 2 | 3 | 3-4 |

**Coherence rule**: the platform ceiling is the master gate. If only 1 platform is allowed, campaign count must also be 1 (can't split across platforms you don't have). If only 1 campaign, tier count is 1 (can't allocate to tiers you're not running). This is why the table cascades.

**Round-3 specific tightening**: at $2k–$5k, platform count drops from the previous round's "primary + secondary" (2) to **1**. This is the direct response to Mahdy's Choros feedback. The previous rule was too permissive.

## The Budget-Math Discipline

A simpler version of the same rule: a platform needs at least $1,500/mo of spend to learn anything meaningful inside 30 days.

- $3k across 2 platforms = $1,500/each. Right at the floor — usually too little.
- $3k across 3 platforms = $1,000/each. Below the floor. Mahdy's "nowhere near sufficient" applies here.
- $3k on 1 platform = $3k. Clears the floor. Has a chance to actually learn.

If your math can't justify $1,500/mo per platform, the platform count is too high.

## Creative Angle Policy Under Small Budget

One platform, one campaign, one tier — but **multiple creative angles** inside that single campaign. This is the ONLY axis that should fragment at small budget.

- 2-3 angles tested against the same audience at launch.
- Angles must anchor to different pain points from ICP research (not 3 variations of the same hook).
- Split-test at the ad level, not ad set level, to avoid fragmenting audience.
- After 7-14 days or 50 conversion events (whichever first), kill the loser, keep the winner.

Creative is how small-budget plans learn. Platform/campaign fragmentation is how they fail.

## Forbidden Moves (Explicit)

- Recommending any platform that is not cited in at least one of: `competitorIntel.competitors[].adActivity.platforms`, `icpValidation.channels`, or `strategicSynthesis.platformRecommendations`. See `channel-grounding.md` for the full rule. At small budget especially, an un-grounded platform (Mahdy's "not sure where tik tok ads came from") is the most common failure mode.
- Campaign count > 1 when `budgetSummary.totalMonthly < 5000`. The `validators/media-plan.ts` validator enforces this — do not fight it.
- Platform count > 1 when `budgetSummary.totalMonthly < 5000`. Same validator enforcement.
- Equal-split platform percentages (50/50) under $5k. If two platforms are allowed, one must be primary (≥70%) and one secondary — not a coin flip.
- Suggesting "test all three platforms to see which wins" at <$5k. You don't have the budget to get a clean read. You have enough to pick one and commit.
- Budget allocations where any individual platform allocation < $1,500/mo. The floor is load-bearing.

## Decision Rules

1. Read `budgetSummary.totalMonthly` from the draft Block 1 output (or the input budget constraint).
2. Cascade down the ceiling table: platform ceiling first, then campaign, then tier, then creative.
3. Pick the single primary platform using the grounding rule (`channel-grounding.md`) + competitor evidence from `competitorIntel`.
4. If awarenessLevel is `unaware` and budget is under $5k, prefer Meta / YouTube (visual education) over Google Search (which captures intent the user doesn't have yet). See `rollout-skill.ts` awareness-gated phasing for context.
5. Emit `strategicFrame.funnelSplitRationale` that explicitly names the single platform + single campaign + single tier decision (e.g., "Under $5k DR cold-launch → single platform (Meta), single conversion campaign, 100% in-market tier. Concentration, not diversification.").
6. If the campaign array has only 1 entry, fill the `singleCampaignRationale` field (required by schema when `campaigns.length === 1`) with a one-sentence Brooke-anchored justification.

## When to Widen

A second platform is earned, not assumed. The conditions:

- At least 30 days of data on platform 1.
- Platform 1 has cleared the first-dollar test (see `benchmark-selection.md`): ≥1 paying customer acquired for <50% of cumulative spend.
- Budget has increased to clear the next gate ($5k for platform 2).
- Secondary platform is still grounded per `channel-grounding.md`.

If ANY of those conditions is missing, platform count stays at 1.

## Why This Exists

The Choros plan Mahdy reviewed suggested $3k split across three platforms. Each platform got $1k. At $1k/mo a platform cannot:
- Clear its own daily-spend minimum on most objectives.
- Run more than one creative test with statistical confidence.
- Produce enough conversions to exit the algorithm's learning phase.

Result: $3k spent, zero learnings. Mahdy's round-2 rule (max 2 campaigns) is insufficient because it doesn't gate the platform axis. Round-3 adds the platform gate and the $1,500/mo platform floor. Together they make sub-$5k plans actually launchable.

## Output Guidance

- Block 1 `platforms[]` array: length 1 when totalMonthly < $5k.
- Block 1 `strategicFrame.inMarketTierMix`: `{ inMarket: 100, needsConvinced: 0, coldMass: 0 }` at < $2k; `{ inMarket: 80, needsConvinced: 20, coldMass: 0 }` at $2k-$5k. Matches `in-market-tier-routing.md`.
- Block 2 `campaigns[]` array: length 1 when totalMonthly < $5k, with `singleCampaignRationale` set.
- Block 2 `segments[]`: 2-3 segments max under $5k, all priority ≥7.
- Block 3 `angles[]`: 2-3 angles under $5k, all anchored to different ICP pain points.
- Block 5 Phase 1: single-platform soft launch (no "launch Meta AND Google simultaneously" language at < $5k).
