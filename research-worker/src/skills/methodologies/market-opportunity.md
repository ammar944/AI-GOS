---
name: market-opportunity-identification
version: 1.0.0
category: intelligence
domain: market-research
description: Methodology for identifying 1-3 timing-sensitive market opportunities a paid media buyer can exploit. Grounded in Schwartz awareness levels, Blue Ocean Strategy ERRC, Jobs-to-be-Done, Perry Marshall 80/20.
triggers:
  - marketOpportunities
  - industry research intelligence
  - market gap analysis
---

# Market Opportunity Identification

## Purpose

You are identifying 1-3 market opportunities that a paid media buyer can exploit RIGHT NOW based on the market research above. NOT hypothetical. NOT generic. Evidence-backed only.

## Frameworks Applied

- **Schwartz 5 Awareness Levels** — is the market Unaware, Problem-Aware, Solution-Aware, Product-Aware, or Most-Aware?
- **Schwartz 5 Sophistication Levels** — how saturated is the space? Are competitors still claiming basic benefits or have they moved to mechanism-level claims?
- **Blue Ocean ERRC Grid** — what factors can be Eliminated, Reduced, Raised, or Created relative to industry norms?
- **Jobs-to-be-Done** — what functional/emotional/social jobs is the customer hiring a product to do?
- **Perry Marshall 80/20** — which 20% of customer cohorts produce 80% of revenue?

## Qualifying Criteria — A Real Market Opportunity Has

1. **Specific evidence** from the research above (not general knowledge)
2. **Timing window** — why NOW, not 6 months ago or 6 months from now
3. **Competitor blindspot OR emerging trend** — an exploitable gap, not a saturated claim
4. **Exploitable by paid media specifically** — fits on Meta, Google, LinkedIn, TikTok, or YouTube (not product roadmap work)
5. **Revenue-moving** — the buyer persona converts in normal paid-media time horizons (days to weeks, not months)

If fewer than 4 of these 5 criteria are met, it's NOT a market opportunity — it's a hypothesis. Do NOT include it.

## Opportunity Archetypes (pick from these, not generic categories)

Each archetype must cite a specific finding from the research above.

**A. Sophistication Regression** — competitors all converged on the same claim; you can win by adding a unique mechanism or moving to identity-level marketing.
**B. Awareness Mismatch** — paid ads in this space speak to Product-Aware audiences, but 60% of the market is still Problem-Aware. Opening: create Problem-Aware copy.
**C. Eliminated Pain Point** — customers repeatedly cite a friction that NO competitor addresses. Lead with solving it.
**D. Trend-Rider** — an emerging behavior/platform/regulation opens a 3-6 month window before saturation.
**E. Blue Ocean Factor** — ERRC analysis reveals a factor everyone Raises that you could Eliminate (or vice versa), reducing cost and differentiating simultaneously.
**F. Underserved Cohort** — 80/20 analysis shows a high-LTV segment (often 15-25% of customers) that industry ads do not target.
**G. Unaddressed Job-to-be-Done** — customers hire category products for an emotional/social job, not the stated functional one. Competitors lead with functional.

## Decision Rules

- IF research has fewer than 3 distinct market signals → return empty array
- IF no competitor analysis in context → you cannot identify "blindspot" opportunities; focus only on trend/awareness archetypes
- IF all findings point to saturated claims (Sophistication Level 4+) → at least one opportunity MUST be Archetype A or E (mechanism or Blue Ocean)
- IF timing window is >12 months or <2 weeks → it's not paid-media-exploitable; skip

## Scoring Rubric (for "size" field)

- **Small**: Serves a niche cohort (<20% of total addressable). Revenue impact <10% lift.
- **Medium**: Broad cohort (20-50% of TAM). Revenue impact 10-30% lift.
- **Large**: Core cohort or category expansion. Revenue impact >30% lift.

If you cannot estimate cohort size from the research, default to Small. Do NOT inflate.

## Scoring Rubric (for "difficulty" field)

- **Low**: Creative-only change (new angle, new hook). Deployable in <7 days.
- **Medium**: Requires new landing page, audience, or funnel stage. Deployable in 2-4 weeks.
- **High**: Requires offer structure change, new product positioning, or cross-functional work. >1 month.

## Timing Rubric

- **Now**: Evidence shows a condition that exists today and competitors have not addressed (e.g., "none of top 5 competitors mention X pain point")
- **3-6 months**: Evidence shows an emerging trend (e.g., "TikTok search queries for Y up 40% in 90 days")
- **6-12 months**: Evidence shows a structural shift (e.g., regulation, platform change, macro trend)

## Output Format

```json
{
  "marketOpportunities": [
    {
      "opportunity": "One sentence describing the specific gap",
      "archetype": "A|B|C|D|E|F|G",
      "size": "small|medium|large",
      "timing": "now|3-6 months|6-12 months",
      "difficulty": "low|medium|high",
      "evidence": "One sentence citing the SPECIFIC research finding (name the source)",
      "evidenceUrl": "URL if from web_search, omit otherwise",
      "mechanism": "One sentence: WHY this opportunity exists and HOW paid media exploits it"
    }
  ]
}
```

## Anti-Patterns (automatic rejection)

- "Market is growing, so there's opportunity" — growth alone is not an opportunity
- "AI/automation is hot" — trend alone without specific mechanism
- "Target underserved segments" — which segment, what evidence
- "Differentiate with unique value prop" — which prop, what mechanism
- Any "opportunity" that any competent marketer would have already identified
- Any opportunity not backed by a specific research finding

## Good vs. Bad Examples

**BAD** (generic, unfounded):
```json
{
  "opportunity": "Target mid-market buyers with AI-focused messaging",
  "evidence": "Market is growing and AI is hot"
}
```

**GOOD** (specific, archetype-tagged, mechanism-backed):
```json
{
  "opportunity": "Lead with 'no-rip-and-replace' angle against incumbent Oracle deployments",
  "archetype": "C",
  "size": "medium",
  "timing": "now",
  "difficulty": "low",
  "evidence": "3 of 5 competitor ad libraries show lengthy-implementation messaging; Gartner report cited ROI delay as #1 customer objection",
  "evidenceUrl": "https://...",
  "mechanism": "Problem-Aware audience searching 'Oracle alternative' will resonate with friction-reduction hook"
}
```

## Quality Gate

Before outputting, verify each opportunity:
- [ ] Archetype assigned (A-G)
- [ ] Evidence cites a specific finding from research above
- [ ] Mechanism explains WHY + HOW
- [ ] Timing is paid-media-exploitable
- [ ] Difficulty honestly assessed
- [ ] Would a skeptical media buyer spend money on this? If not, cut it.

If fewer than 2 opportunities pass this gate → return empty array. Empty is better than fabricated.
