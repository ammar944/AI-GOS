export const INDUSTRY_INTELLIGENCE_SKILL = `
## Intelligence: Market Opportunities to Exploit

After completing the market research above, generate exactly 3 market opportunities a paid media buyer could exploit right now.

For each opportunity:
- "opportunity": 1 sentence describing the gap or opening
- "size": "small" | "medium" | "large" (revenue potential)
- "timing": "now" | "3-6 months" | "6-12 months" (urgency window)
- "difficulty": "low" | "medium" | "high" (execution difficulty)
- "evidence": 1 sentence citing a specific finding from the research

Add a "marketOpportunities" array to your JSON output with these 3 objects.
Keep all strings under 120 characters. Focus on timing-sensitive gaps where paid media can move fast.
`;

export const ICP_INTELLIGENCE_SKILL = `
## Intelligence: Audience Refinements to Test

After completing the ICP validation above, generate exactly 3 audience refinements that could improve paid media performance.

For each refinement:
- "refinement": 1 sentence describing what to change about targeting or messaging
- "segment": which audience slice this applies to
- "expectedLift": "low" | "moderate" | "high"
- "testMethod": 1 sentence describing how to validate (e.g. "Split test ad copy focusing on X pain point")
- "risk": 1 sentence describing what happens if wrong

Add an "audienceRefinements" array to your JSON output with these 3 objects.
Use buyer language from the ICP validation. Focus on refinements testable in the first 30 days.
`;

export const COMPETITORS_INTELLIGENCE_SKILL = `
## Intelligence: Positioning Moves to Make

After completing the competitive analysis above, generate exactly 3 positioning moves for paid media.

For each move:
- "move": 1 sentence describing the positioning action
- "targetCompetitor": name of the specific competitor you're countering
- "risk": "low" | "medium" | "high"
- "reward": "low" | "medium" | "high"
- "playbook": 1 sentence execution hint for ad creative or messaging

Add a "positioningMoves" array to your JSON output with these 3 objects.
Each must name a real competitor from the analysis and include a concrete ad creative hint.
`;

export const COMPETITORS_INTELLIGENCE_SKILL_COMPACT = `
## Intelligence: Positioning Moves

Generate 1-2 positioning moves (same fields as full spec: move, targetCompetitor, risk, reward, playbook).
Add a "positioningMoves" array. Keep all strings under 80 chars.
The 18-word ceiling from the rescue rules does NOT apply to positioningMoves — playbook may be up to 80 chars.
`;

export const SYNTHESIS_INTELLIGENCE_SKILL = `
## Intelligence: Readiness Scorecard & Top Actions

After completing the synthesis above, add two new fields to your JSON output:

### readinessScorecard
Score the client's media launch readiness across 5 dimensions. Each dimension 1-10.
- "overallScore": weighted average of all dimensions (number, 1-10)
- "verdict": "ready" (>=8) | "fix-gaps-first" (5-7) | "needs-work" (<5)
- "verdictLabel": human-readable version ("Ready to launch" / "Fix gaps first" / "Needs significant work")
- "dimensions": array of 5 objects, each with "name", "score" (number), "summary" (1 sentence)
  - "Market Opportunity" — from industry research
  - "Audience Clarity" — from ICP validation
  - "Competitive Position" — from competitor intel
  - "Offer Strength" — from offer analysis
  - "Keyword Coverage" — from keyword intel

If a section's data is absent or incomplete, score that dimension 0 with summary "Insufficient data".
Be honest — do not inflate scores. A score of 5 means "average, nothing special."

### topActions
Select the 5-7 highest-impact actions across ALL research sections.
- "actions": array of objects with "action" (1 sentence), "source" ("industry" | "icp" | "competitors" | "offer" | "keywords"), "priority" ("high" | "medium" | "low")
Rank by how much each action would move the needle for a paid media launch.
`;
