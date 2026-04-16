// Intelligence Skills — load expert methodology from skills/methodologies/ directory.
// These replace the old thin prompt strings with comprehensive decision frameworks
// grounded in proven direct response methodology (Schwartz, Hormozi, Dunford,
// Brunson, Kennedy, Blue Ocean, Haynes).
//
// Architecture: TS constants -> load methodology .md files at module load
// (long-running Express worker, caches via loader.ts).

import { loadMethodology } from './loader';

export const INDUSTRY_INTELLIGENCE_SKILL =
  loadMethodology('market-opportunity.md') || `
## Intelligence: Market Opportunities to Exploit

After completing the market research above, identify 1-3 market opportunities a paid media buyer could exploit — based ONLY on specific findings from the research above.

For each opportunity:
- "opportunity": 1 sentence describing the gap or opening
- "size": "small" | "medium" | "large"
- "timing": "now" | "3-6 months" | "6-12 months"
- "difficulty": "low" | "medium" | "high"
- "evidence": 1 sentence citing a SPECIFIC data point from the research
- "evidenceUrl": URL of the source (required if from web search)

If you found fewer than 2 research-backed opportunities, return an EMPTY array — do NOT fabricate.
`;

export const ICP_INTELLIGENCE_SKILL =
  loadMethodology('audience-refinement.md') || `
## Intelligence: Audience Refinements to Test

After completing the ICP validation above, identify 1-3 audience refinements backed by specific ICP findings.

Each refinement MUST cite a specific finding from the ICP validation. If ICP data is thin, return an EMPTY array.
`;

export const COMPETITORS_INTELLIGENCE_SKILL =
  loadMethodology('positioning-move.md') || `
## Intelligence: Positioning Moves to Make

After completing the competitive analysis above, identify 1-3 positioning moves for paid media.

Each move MUST name a real competitor and reference a specific weakness or gap. If fewer than 2 competitors have sufficient evidence, return an EMPTY array.
`;

// Compact variant for rescue mode — stripped down for token budget
export const COMPETITORS_INTELLIGENCE_SKILL_COMPACT = `
## Intelligence: Positioning Moves

Generate 1-2 positioning moves from the competitive analysis. Each must name a real competitor, reference a specific weakness, and include a concrete playbook.

Fields per move: move, targetCompetitor, competitorWeakness, valueEquationAxis (dream_outcome|likelihood|time_delay|effort_sacrifice), risk (low|medium|high), reward (low|medium|high), playbook, evidence.

If fewer than 1 competitor has sufficient evidence, return empty positioningMoves array.
`;

export const SYNTHESIS_INTELLIGENCE_SKILL =
  loadMethodology('readiness-scorecard.md') || `
## Intelligence: Readiness Scorecard & Top Actions

Score launch readiness across 5 dimensions (0-10 each). Missing upstream sections MUST score 0 with summary "Insufficient data — section not completed". Be honest — do not inflate scores.

Generate 3-7 top actions grounded in specific research findings. If fewer than 3 grounded actions exist, return fewer.
`;
