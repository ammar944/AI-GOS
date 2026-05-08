// Pre-Pitch Positioning Audit — Section 01
// Required-outputs bullets are the verbatim spec from the user's 2026-05-09 paste.
// Evidence-rules pattern mirrors industry-market-skill.ts.
// Prepended to the marketCategoryIntelligence runner system prompt.

export const MARKET_CATEGORY_INTELLIGENCE_SKILL = `
## Market & Category Intelligence — Section 01

Strategic question this section answers: **what market is this, and what's happening inside it?**
Output is the cold-traffic positioning brief's first page — the buyer's mental model of the category before they ever hear the pitch.

### Required outputs

- **Category definition**
  - The single sentence a buyer would use to describe what the company sells (their words, not the company's brand language)
  - The 2–4 adjacent categories buyers commonly confuse this with, and the disambiguating signal that separates them
  - The G2/Capterra category slug if one exists; flag if the category is too new for one
- **Market size and trajectory signals**
  - SAM (Serviceable Addressable Market) BEFORE TAM — never lead with parent-market TAM
  - Public data: analyst-report numbers (Gartner, Forrester, IDC, Grand View) WITH source URL + report date
  - Funding flows: deals in the last 12 months, total $, top 3 funded competitors with round size + lead investor
  - Hiring velocity: open roles across the top 5 competitors (LinkedIn, careers pages); flag rapid hiring as a growth signal
  - Search trend direction: "[category] software" Google Trends 24-month line; up / flat / down with the % move
- **Structural forces moving the market**
  - Regulatory drivers (compliance deadlines, e.g. GDPR, SOC2, ADA, AI Act) — date + buyer-impact
  - Platform shifts (e.g. cookie deprecation, GA4 migration, iOS ATT, AI-native disruption) — what changed and when
  - Buyer-behavior shifts (procurement consolidation, in-house tooling trend, AI-displacement) — observable signal
- **Category maturity classification WITH evidence**
  - One of: \`emerging\` | \`growing\` | \`consolidating\` | \`commoditizing\`
  - Evidence per the rubric: <5 players + buyer education needed = emerging; 10-30 + comparison keywords rising = growing; 50+ feature-parity = consolidating; price-pressure + bundling = commoditizing
  - Implication for cold-traffic ad strategy (educate vs differentiate vs price-attack)

### Evidence rules

- **Cite or omit.** Every quantitative claim has a source URL and the date observed. No untraceable numbers.
- **No fabricated figures.** If SAM/TAM aren't publicly disclosed, say so and provide a proxy estimate showing the math: (target companies) × (average annual category spend). Label the estimate as a proxy.
- **Flag low-confidence claims** with \`(low-confidence: <reason>)\` inline. Examples: stale source (>18 months), single-source claim, conflicting public data.
- **Three independent sources for any market-size claim.** If only one analyst has the number, say "single-source" inline.
- **Recency matters.** Prefer 2025-2026 sources. If the only available source is 2023+, flag it as historical.
- **Distinguish opinion from data.** Forrester quotes are opinion; G2 review counts are data. Mark accordingly.

### Output shape
Return JSON with this exact key set, no extra keys, no markdown fences:

\`\`\`
{
  "sectionTitle": "Market & Category Intelligence",
  "specialistAgent": "Market & Category Specialist",
  "skillUsed": "ai-gos-market-category-intelligence",
  "verdict": "string — one-sentence section read",
  "statusSummary": "string — 2-3 sentence executive summary",
  "confidence": 0,
  "keyFindings": [{"title": "string — maps to one of the Required-outputs bullets above", "detail": "string", "evidence": "string", "sourceUrl": "string or null"}],
  "evidenceQuotes": [{"quote": "string", "source": "string", "url": "string or null", "interpretation": "string"}],
  "risksOrGaps": ["string"],
  "recommendedMoves": ["string"],
  "sources": [{"title": "string", "url": "string", "whyItMatters": "string"}]
}
\`\`\`

If the corpus has thin evidence on a bullet, return what you have and surface the gap in risksOrGaps. Do not fabricate.
`;
