---
name: audience-refinement
version: 1.0.0
category: intelligence
domain: icp-validation
description: Methodology for generating 1-3 evidence-backed audience refinements for paid media. Grounded in Dunford positioning, Jobs-to-be-Done, Cialdini persuasion, and Perry Marshall 80/20.
triggers:
  - audienceRefinements
  - icp refinement intelligence
  - audience targeting suggestions
---

# Audience Refinement

## Purpose

You are suggesting 1-3 specific audience refinements for paid media based on the ICP validation above. Each refinement must be testable in 30 days and backed by a specific ICP finding.

## Frameworks Applied

- **April Dunford Positioning** — who cares most about this value, and why?
- **Jobs-to-be-Done** (Christensen / Ulwick) — functional + emotional + social jobs
- **Cialdini 7 Principles** — which persuasion principle does this cohort respond to?
- **Dan Kennedy 3M Triangle** — Message + Market + Media alignment
- **Perry Marshall 80/20** — which 15-25% of the audience produces 80% of revenue?

## Qualifying Criteria — A Real Refinement Has

1. **Specific ICP finding** that supports it (not general demographic guesses)
2. **Testable hypothesis** — can be measured in 30 days with a clear win condition
3. **Segment delta** — targets a SPECIFIC slice, not "everyone"
4. **Cheaper acquisition OR higher conversion** — the refinement must be financially better, not just creative
5. **Platform-executable** — achievable with paid media targeting tools (Meta interests, Google in-market, LinkedIn filters, custom audiences)

If fewer than 4 of these 5 are met → it's a hypothesis, not a refinement. Do NOT include.

## Refinement Archetypes

**A. Narrow by Firmographic** — ICP data shows a specific company size/industry that converts disproportionately; cut broader targeting.
**B. Narrow by Psychographic/JTBD** — customers hire product for a specific emotional/social job; target people who express that motivation.
**C. Expand via Lookalike Seed** — identify the highest-LTV customer cohort and seed a Meta/Google lookalike from their list.
**D. Persuasion Principle Pivot** — current creative uses authority/social proof; this cohort responds to scarcity or identity. Test the principle swap.
**E. Exclusion Refinement** — ICP data shows a segment that looks like buyers but doesn't convert. Add exclusion to save budget.
**F. Timing/Trigger Refinement** — purchase is triggered by a specific life/business event; target people at that trigger (job change, funding round, renewal window).
**G. Language/Identity Refinement** — use the ACTUAL buyer-language from the ICP, not marketer-language, in targeting AND copy.

## Decision Rules

- IF ICP has fewer than 2 validated persona traits → return empty array
- IF no purchase triggers/jobs identified → skip Archetypes B and F
- IF no high-LTV cohort identified → skip Archetype C
- IF ICP is large/broad (enterprise wide) → at least one refinement MUST be Archetype A (narrow)
- IF ICP has been running identical creative for 90+ days → at least one refinement should be Archetype D or G

## Expected Lift Rubric (be honest)

- **Low**: 10-25% improvement on a specific metric (CTR, CPL, or conversion rate). Target: refinements with thin evidence or small segment.
- **Moderate**: 25-50% improvement. Target: refinements with strong evidence AND broad applicability.
- **High**: >50% improvement. Reserve for refinements with direct evidence of a misaligned audience (e.g., current ads showing to a cohort that clearly doesn't buy).

Anti-inflation rule: if you cannot point to what was broken in the original targeting, you cannot claim High lift.

## Risk Rubric

Every refinement MUST name a specific risk. Format: "If wrong: [consequence]."
- **Volume risk**: narrowing reduces reach below minimum audience size
- **Attribution risk**: lookalike reflects past behavior that won't repeat
- **Fatigue risk**: cohort too small to support required frequency
- **Substitution risk**: exclusion accidentally cuts buyers

## Test Method Specification

MUST include HOW to validate:
- Split test against current audience for 14 days minimum
- Win condition: specific metric + specific threshold (e.g., "CPL -25% at 95% statistical significance over 500 conversions")
- Sample size floor: 50 conversions or 14 days (whichever later)
- Kill criteria: if lift <5% after floor reached, revert

## Output Format

```json
{
  "audienceRefinements": [
    {
      "refinement": "One sentence describing the targeting change",
      "archetype": "A|B|C|D|E|F|G",
      "segment": "WHO specifically — firmographic + psychographic",
      "evidence": "One sentence citing the specific ICP finding",
      "expectedLift": "low|moderate|high",
      "testMethod": "Split test plan with win condition and sample floor",
      "risk": "If wrong: [specific consequence]"
    }
  ]
}
```

## Anti-Patterns

- "Test different audiences" — which one, what evidence
- "Target decision-makers" — that's just the ICP, not a refinement
- "Expand targeting" — expansion without specification is noise
- "Add retargeting" — retargeting is a table-stakes layer, not a refinement
- Refinements without test win conditions
- Refinements claiming "high" lift without evidence of a broken audience today

## Good vs. Bad Examples

**BAD** (generic, untestable):
```json
{
  "refinement": "Target decision-makers in high-growth companies",
  "expectedLift": "high",
  "risk": "May reduce reach"
}
```

**GOOD** (specific, archetype-backed, testable):
```json
{
  "refinement": "Exclude companies under 50 employees from LinkedIn audience; add 'Series B+' filter",
  "archetype": "A",
  "segment": "B2B SaaS buyers, 50-500 employees, post-Series-B fundraise",
  "evidence": "ICP validation showed 87% of closed-won deals came from 50+ employee companies; 62% post-Series-B",
  "expectedLift": "moderate",
  "testMethod": "Split LinkedIn audience 50/50 for 21 days; win = CPL -30% at 100+ conversions",
  "risk": "If wrong: lose 15% of top-of-funnel volume from SMB segment"
}
```

## Quality Gate

Each refinement must pass:
- [ ] Archetype assigned (A-G)
- [ ] Evidence cites a specific ICP finding
- [ ] Segment is specific (not "buyers")
- [ ] Test method has a measurable win condition
- [ ] Risk is a real consequence, not a platitude
- [ ] Expected lift honestly scaled to evidence quality

If fewer than 2 refinements pass → return empty array.
