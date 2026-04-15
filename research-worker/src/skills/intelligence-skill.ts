export const INDUSTRY_INTELLIGENCE_SKILL = `
## Intelligence: Market Opportunities to Exploit

After completing the market research above, identify 1-3 market opportunities a paid media buyer could exploit — based ONLY on specific findings from the research above.

For each opportunity:
- "opportunity": 1 sentence describing the gap or opening
- "size": "small" | "medium" | "large" (revenue potential)
- "timing": "now" | "3-6 months" | "6-12 months" (urgency window)
- "difficulty": "low" | "medium" | "high" (execution difficulty)
- "evidence": 1 sentence citing a SPECIFIC data point or finding from the research (name the source)
- "evidenceUrl": URL of the source (required if from web search, omit if from user-provided data)

Add a "marketOpportunities" array to your JSON output.
RULES:
- Only include opportunities directly supported by research findings above
- If you found fewer than 2 research-backed opportunities, return an EMPTY "marketOpportunities" array — do NOT fabricate
- Keep all strings under 120 characters
- Focus on timing-sensitive gaps where paid media can move fast
`;

export const ICP_INTELLIGENCE_SKILL = `
## Intelligence: Audience Refinements to Test

After completing the ICP validation above, identify 1-3 audience refinements backed by specific ICP findings that could improve paid media performance.

For each refinement:
- "refinement": 1 sentence describing what to change about targeting or messaging
- "segment": which audience slice this applies to
- "expectedLift": "low" | "moderate" | "high"
- "testMethod": 1 sentence describing how to validate (e.g. "Split test ad copy focusing on X pain point")
- "risk": 1 sentence describing what happens if wrong
- "evidence": 1 sentence citing the specific ICP finding that supports this refinement

Add an "audienceRefinements" array to your JSON output.
RULES:
- Each refinement MUST cite a specific finding from the ICP validation above
- If ICP data is thin (fewer than 2 validated persona traits), return an EMPTY array — do NOT fabricate
- Use buyer language from the ICP validation
- Focus on refinements testable in the first 30 days
`;

export const COMPETITORS_INTELLIGENCE_SKILL = `
## Intelligence: Positioning Moves to Make

After completing the competitive analysis above, identify 1-3 positioning moves for paid media based on specific competitive weaknesses or gaps found in the analysis.

For each move:
- "move": 1 sentence describing the positioning action
- "targetCompetitor": name of the specific competitor you're countering
- "risk": "low" | "medium" | "high"
- "reward": "low" | "medium" | "high"
- "playbook": 1 sentence execution hint that references a specific weakness or gap found in the competitive analysis
- "evidence": 1 sentence citing the competitive finding that justifies this move

Add a "positioningMoves" array to your JSON output.
RULES:
- Each move MUST name a real competitor from the analysis
- The "playbook" MUST reference a specific weakness or gap discovered during research
- If fewer than 2 competitors were analyzed with sufficient data, return an EMPTY array — do NOT fabricate
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
Score the client's media launch readiness across 5 dimensions. Each dimension 0-10.
- "overallScore": weighted average of all dimensions (number, 0-10)
- "verdict": "ready" (>=8) | "fix-gaps-first" (5-7) | "needs-work" (<5)
- "verdictLabel": human-readable version ("Ready to launch" / "Fix gaps first" / "Needs significant work")
- "dimensions": array of 5 objects, each with "name", "score" (number), "summary" (1 sentence)
  - "Market Opportunity" — from industry research
  - "Audience Clarity" — from ICP validation
  - "Competitive Position" — from competitor intel
  - "Offer Strength" — from offer analysis
  - "Keyword Coverage" — from keyword intel

SCORING RULES:
- If a section's data is absent, incomplete, or was not part of this research run, you MUST score that dimension 0 with summary "Insufficient data — section not completed".
- A score of 5 means "average, nothing special." Do NOT inflate scores.
- Only score above 7 if the research produced strong, specific, actionable findings for that dimension.
- Be honest — a low overall score is better than a fabricated high one.

### topActions
Select 3-7 highest-impact actions across ALL completed research sections.
- "actions": array of objects with "action" (1 sentence), "source" ("industry" | "icp" | "competitors" | "offer" | "keywords"), "priority" ("high" | "medium" | "low")
- Only include actions grounded in specific research findings — do NOT generate generic marketing advice
- If fewer than 3 actionable findings exist, return fewer actions rather than fabricating
Rank by how much each action would move the needle for a paid media launch.
`;
