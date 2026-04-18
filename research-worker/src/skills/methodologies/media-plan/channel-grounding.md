---
name: channel-grounding
version: 1.0.0
category: media-plan
domain: strategy
description: Every channel proposed in the media plan must trace to evidence. Prevents inventing channels the research never mentioned (e.g. TikTok for a B2B SaaS when no competitor runs TikTok ads and no ICP signal names TikTok).
triggers:
  - channel selection
  - platform recommendation
  - media plan block 1
---

# Channel Grounding

## Purpose

The media plan is only as trustworthy as its channel selection. Proposing TikTok because it sounds modern, or Google Ads because it's familiar, without evidence in the research, produces plans that fail in execution and erode trust.

Every channel in the output must trace to evidence. If a channel has no evidence, do not propose it — even if the budget could accommodate it. Concentrating on fewer evidence-backed channels beats spreading thin across unsupported ones.

## Evidence Hierarchy (strongest to weakest)

### Tier 1: Competitor ad activity (strongest)
A competitor running active ads on a channel is the strongest signal — the channel has been validated in the market by someone with skin in the game.

Source: `competitorIntel.competitors[].adCreatives[]` and `competitorIntel.competitors[].platforms`.

Rule: If 2+ competitors are running ads on a channel, the channel is a TIER 1 candidate.

### Tier 2: ICP preferred channels
The ICP researchers identify where the target audience spends attention. If the ICP persona lives on LinkedIn, LinkedIn is evidenced — even if no competitor runs LinkedIn ads.

Source: `icpValidation.channels[]` or similar persona-specific channel array.

Rule: A channel named in the ICP channel list is a TIER 2 candidate.

### Tier 3: Industry template defaults
For well-established verticals (SaaS, e-commerce, local service, etc.), the industry template names default channels. This reflects industry knowledge, not evidence-per-client, so it's weaker.

Source: `industryTemplate.channels[]` (loaded from `skills/templates/<industry>.md`).

Rule: A channel listed in the industry default is a TIER 3 candidate.

### Tier 4: Business-model template defaults
The business-model template (PLG / SLG / etc.) names default channels by model. Weakest source because it's global, not client-specific.

Source: `businessModelTemplate.channels[]`.

Rule: A channel listed in the business-model default is a TIER 4 candidate.

## Selection Rules

1. **Prefer Tier 1 and Tier 2 evidence.** A channel with competitor ad activity OR ICP channel signal is strongly preferred over an industry/model default.
2. **Every proposed channel must cite its tier.** In the `rationale` field for each platform, name the evidence source: "TikTok — competitor [X] running 12 active ads, ICP persona lists TikTok as primary discovery channel."
3. **Avoid channels with ZERO evidence tiers.** If a channel has no T1/T2/T3/T4 support, drop it. Do not propose.
4. **If all four tiers are silent, concentrate on fewer channels.** Better to go all-in on 1 platform with Tier 2+ support than to split across 3 platforms with no support.
5. **Negative signals count.** If the ICP explicitly says "never on TikTok" or the industry template flags a channel as unsuitable, do not propose it even if another tier suggests it.

## Forbidden Moves

- Proposing a channel because it's "popular" or "emerging" without evidence.
- Proposing a channel because the budget is large enough to afford it, without evidence.
- Proposing multiple channels that sum to the budget when one channel has strong evidence and the others have none — concentrate instead.
- Proposing a channel to achieve arbitrary "multi-platform diversification" without per-channel evidence.

## Output Format

Every `platforms[]` entry in `channelMixBudget` must include the evidence source in the rationale:

```json
{
  "name": "Meta",
  "role": "primary-acquisition",
  "monthlySpend": 2500,
  "percentage": 85,
  "rationale": "Tier 1 evidence: 4 of 6 competitor ads active on Meta, top performers using video demos. Tier 2: ICP persona lists Facebook + Instagram as primary social platforms. Aligns with business model (PLG) and awareness level (unaware) routing.",
  "evidenceTier": 1
}
```

Where `evidenceTier` is 1–4 (strongest to weakest).

## Escalation

If the plan could only find Tier 4 evidence for all candidate channels (i.e. research is thin), add a plan-level warning: `"Channel selection based on business-model defaults only — recommend gathering competitor ad intel and ICP channel preferences before scaling beyond pilot phase."`

## Examples

### Example 1: Choros.io (Tier 1 → should have passed, didn't)
- Research surfaced 6 competitors but none had active ads (scraping issue, not a market issue).
- Runner should have reverse-searched keyword intents on Meta Ad Library, found competitors running ads, and used THOSE as Tier 1 evidence.
- Instead: proposed Meta + Google + YouTube with Tier 4 (business-model default) evidence only.
- Correct behavior: concentrate on Meta only (strongest business-model + awareness-level fit), flag "thin competitor ad intel" warning.

### Example 2: Strong Tier 1 match
- Research: 3 competitors running 40+ ads total on Meta.
- ICP: Facebook + Instagram named as primary.
- Output: Meta at 80%+ budget, cite Tier 1 evidence explicitly.

### Example 3: Conflicting signals
- Research: No competitor ads found.
- ICP: LinkedIn named as primary.
- Business-model default (SLG): LinkedIn primary.
- Output: LinkedIn at majority, Tier 2+4 evidence. Include warning "no competitor ad intel available; recommend pilot at <£4k before scaling."
