---
name: readiness-scorecard
version: 1.0.0
category: intelligence
domain: synthesis
description: Methodology for scoring a client's paid media launch readiness across 5 dimensions. Grounded in Hormozi Value Equation, Kennedy 10 Rules, Dunford Positioning, and Schwartz Awareness.
triggers:
  - readinessScorecard
  - synthesis readiness
  - media launch readiness
---

# Readiness Scorecard

## Purpose

Score a client's paid media launch readiness across 5 dimensions (0-10 each). Each dimension must be scored HONESTLY — a low score is more valuable than a fabricated high score because it reveals what to fix.

## Frameworks Applied

- **Hormozi Value Equation** — offer strength scoring
- **Kennedy 10 Rules** — direct response hygiene
- **Dunford Positioning** — category clarity + differentiation
- **Schwartz Awareness** — audience understanding depth
- **Perry Marshall 80/20** — cohort identification depth

## The 5 Dimensions

### 1. Market Opportunity (0-10)
Source section: industryResearch

Scores:
- **0**: Section not completed or zero findings
- **1-3**: Category identified, no specific opportunities or trends
- **4-6**: Category + 1-2 trends identified, no named opportunities
- **7-8**: Specific market opportunities with evidence + timing windows
- **9-10**: Multiple archetype-tagged opportunities with clear paid-media exploitation paths

### 2. Audience Clarity (0-10)
Source section: icpValidation

Scores:
- **0**: Section not completed
- **1-3**: Generic persona (role + industry only)
- **4-6**: Persona + some triggers/objections, no purchase behavior
- **7-8**: Persona + JTBD + triggers + objections with evidence
- **9-10**: Persona + JTBD + triggers + objections + 80/20 cohort identification + validated buyer language

### 3. Competitive Position (0-10)
Source section: competitorIntel

Scores:
- **0**: Section not completed
- **1-3**: Competitors named, no analysis depth
- **4-6**: Competitor positioning documented, no weakness identification
- **7-8**: Competitor weaknesses identified + positioning moves proposed
- **9-10**: ERRC grid filled + Value Equation attack axes identified + differentiated category position

### 4. Offer Strength (0-10)
Source section: offerAnalysis

Scores (Hormozi Value Equation-based):
- **0**: Section not completed
- **1-3**: Offer exists, no value equation analysis
- **4-6**: Offer documented, 1-2 Value Equation levers present
- **7-8**: Offer with all 4 Value Equation levers + at least 2 bonuses/guarantees
- **9-10**: Grand Slam Offer structure (scarcity + urgency + bonuses + guarantee), differentiated mechanism, Kennedy 10-rule compliant

### 5. Keyword Coverage (0-10)
Source section: keywordIntel

Scores:
- **0**: Section not completed
- **1-3**: Basic keywords listed, no grouping
- **4-6**: Campaign groups + negatives, no intent mapping
- **7-8**: Campaign groups + negatives + Schwartz awareness-level mapping
- **9-10**: Full awareness-stage keyword matrix + competitor keyword gaps + 80/20 priority ranking

## SCORING RULES (STRICT)

1. **Missing section = 0.** If the upstream research section is not in context OR failed, the dimension scores 0 with summary "Insufficient data — section not completed." Do NOT interpolate.

2. **Default to the lower end.** If evidence is ambiguous between tiers (e.g., could be 6 or 7), score the LOWER tier. Conservative scoring is a feature.

3. **No grade inflation.** A score of 5 means "average, nothing special." A score of 8 means "genuinely strong." A score of 10 is rare and requires exceptional depth.

4. **Anti-halo rule.** A strong Market Opportunity score does NOT automatically raise Audience Clarity. Score each dimension independently against its own rubric.

5. **Evidence traceability.** Every dimension's summary must reference a SPECIFIC finding or specific gap — not "research is comprehensive" or "analysis is thin."

## Overall Verdict Thresholds

- **Ready to launch** (overallScore ≥ 8): All dimensions ≥ 6, no dimension at 0
- **Fix gaps first** (overallScore 5-7.9): Most dimensions 5+, some gaps identified
- **Needs significant work** (overallScore < 5): Multiple dimensions below 5 or any dimension at 0

If ANY dimension scores 0 → overall verdict CANNOT be "ready to launch" regardless of average.

## Top Actions Generation

Based on the scorecard, generate 3-7 highest-impact actions:

### Action Selection Rules
- Only include actions grounded in SPECIFIC research findings above
- If fewer than 3 grounded actions exist → return fewer rather than fabricate
- Rank by EXPECTED impact on launch readiness, not by ease
- Each action must name WHICH research section it draws from

### Action Format
```json
{
  "action": "Specific executable sentence (what to do, not a goal)",
  "source": "industry|icp|competitors|offer|keywords",
  "priority": "high|medium|low",
  "rationale": "One sentence: which research finding supports this action"
}
```

### Action Priority Rules
- **High**: Blocks launch OR high-revenue-impact if missed
- **Medium**: Strong improvement signal
- **Low**: Nice-to-have, incremental

## Output Format

```json
{
  "readinessScorecard": {
    "overallScore": 6.4,
    "verdict": "fix-gaps-first",
    "verdictLabel": "Fix gaps first",
    "dimensions": [
      {
        "name": "Market Opportunity",
        "score": 7,
        "summary": "Category identified + 2 archetype-tagged opportunities with evidence; trend timing clear"
      },
      {
        "name": "Audience Clarity",
        "score": 4,
        "summary": "Persona documented but JTBD missing; only 1 buying trigger with quote"
      }
      // ... etc
    ]
  },
  "topActions": {
    "actions": [
      {
        "action": "Conduct JTBD discovery to identify emotional + social jobs",
        "source": "icp",
        "priority": "high",
        "rationale": "Audience Clarity scored 4 primarily due to missing JTBD; Hormozi Dream-Outcome attacks require this"
      }
      // ... etc
    ]
  }
}
```

## Anti-Patterns

- All dimensions scored 7-8 (grade inflation)
- Overall verdict "ready to launch" with any dimension at 0 or 1
- Dimension summary like "comprehensive analysis" (says nothing)
- Generic actions ("improve targeting")
- Action priority misalignment (marking "low" for things that block launch)
- Skipping the "insufficient data" language when sections are missing

## Quality Gate

Before outputting:
- [ ] Each dimension's summary cites a specific finding or specific gap
- [ ] Missing sections scored 0 with "Insufficient data" language
- [ ] Overall score = mean of dimensions (computed, not invented)
- [ ] Verdict logic: any 0 → not "ready"; average < 5 → "needs-work"; average 8+ with all ≥6 → "ready"
- [ ] Top actions each cite a specific research finding
- [ ] Actions ranked by impact, not ease
- [ ] If fewer than 3 grounded actions exist, return fewer
