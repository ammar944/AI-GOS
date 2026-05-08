// Pre-Pitch Positioning Audit — Section 03
// Required-outputs derived from section name "Competitor Landscape & Positioning";
// the verbatim user paste is not in the worktree. Evidence-rules pattern
// mirrors competitor-analysis-skill.ts.
// Prepended to the competitorLandscape runner system prompt.

export const COMPETITOR_LANDSCAPE_SKILL = `
## Competitor Landscape & Positioning — Section 03

Strategic question: **who else is in the buyer's consideration set, what positions do they own, and where is the white space?**
Output is the buyer's perception of "the alternatives" — not the company's preferred competitor list.

### Required outputs

- **Competitive set (ranked by buyer-perceived alternative)**
  - Top 5-10 direct competitors by name, with: 1-line buyer-language positioning, price tier, ICP overlap %, ad-library activity score
  - Top 3-5 indirect/substitute competitors (different category, same job-to-be-done)
  - 2-3 status-quo alternatives ("they keep using spreadsheets," "they hire an agency," "they do nothing")
- **Per-competitor positioning teardown** (for top 5)
  - Headline value prop in their words (homepage hero copy, verbatim)
  - Category claim (leader / challenger / niche / disruptor / unbundler)
  - Lead proof point (case study $/% claim, customer logo wall, review count)
  - Pricing posture (transparent / opaque / freemium / sales-led / usage-based)
  - Ad-library footprint: 0-5 ads (testing) / 5-20 (established) / 20-50 (scaling) / 50+ (dominant)
  - One observable weakness in reviews — verbatim quote with source URL
- **Positioning map (X/Y axes that matter to the buyer)**
  - Choose two axes from: price (low↔high), breadth (point↔platform), buyer (SMB↔enterprise), delivery (DIY↔done-for-you), proof (no-code↔engineer-required)
  - Plot named competitors on each axis with a one-sentence rationale
  - Identify the quadrant the company occupies AND the empty quadrants (white space)
- **White space analysis**
  - Messaging white space: emotional / functional / status angles no one is owning
  - Audience white space: ICP sub-segments no one is targeting (cite: missing from competitor pages, no LinkedIn ad targeting overlap)
  - Channel white space: platforms with weak/zero competitor presence (cite: ad-library searches per platform)
  - Feature white space: capabilities buyers ask for in reviews but no competitor talks about in ads
- **Switching analysis**
  - "Switched from X" mentions in G2/Capterra reviews — cite top 3 named with verbatim quote + source URL
  - The pattern of switching triggers (price hike, missing feature, support failure, acquisition aftermath, data export pain)
- **Positioning recommendation**
  - The 1-sentence position the company should claim (challenger / unbundler / specialist for ICP X / pricing-disruptor / native-AI alternative)
  - Why no competitor can credibly counter that position

### Evidence rules

- **Buyer-language only.** Pull homepage hero copy verbatim. Don't paraphrase. If the company says "AI-powered platform for modern teams," that's the headline.
- **Ad-library counts must be live.** Cite the date observed. Meta Ad Library URL + date. SearchAPI / SpyFu + date for Google.
- **Reviews are the truth source.** Mine 1-3 star reviews for weaknesses, not marketing material.
- **Positioning is what buyers PERCEIVE, not what companies CLAIM.** A company calling itself "the leader" is irrelevant unless review counts and category share confirm.
- **Cite at least 3 review URLs per competitor in the teardown.** Single-source quotes get flagged \`(single-source)\`.
- **Status-quo competition counts.** If the buyer's real alternative is "do nothing" or "keep using spreadsheets," name it — that's harder to beat than another vendor.

### Output structure

\`\`\`
# Competitor Landscape & Positioning

## Competitive Set
### Direct (top 5-10)
- <Name> — "<verbatim positioning>", <price tier>, ICP overlap <%>, ad-library: <n> active
- ...
### Indirect / Substitutes
- <Name> — different category, same job: <job>
### Status-Quo Alternatives
- <e.g. "stay on spreadsheets"> — why it persists: <reason>

## Per-Competitor Teardown (top 5)
### <Competitor 1>
- Headline (verbatim): "<...>"
- Category claim: <leader|challenger|niche|disruptor|unbundler>
- Lead proof: <claim with source>
- Pricing posture: <transparent|opaque|freemium|sales-led|usage-based>
- Ad footprint: <n> active ads (Meta Library, <date>)
- Observable weakness: "<verbatim review quote>" — source: <url>

## Positioning Map
- X axis: <axis>, Y axis: <axis>
- Plot: <competitor> at <quadrant> because <rationale>
- Company occupies: <quadrant>
- Empty quadrants (white space): <quadrants>

## White Space
- Messaging: <angle no one owns>
- Audience: <segment no one targets> — evidence: <signal>
- Channel: <platform with weak presence> — evidence: <ad-library count>
- Feature: <capability buyers want, nobody markets> — evidence: <review quote>

## Switching Analysis
- "Switched from X" patterns: <list with verbatim quotes + urls>
- Common switching triggers: <list>

## Positioning Recommendation
- Claim: "<1-sentence position>"
- Defensibility: <why no competitor can counter>

## Confidence & Gaps
- High-confidence: <list>
- Single-source claims: <list>
- Competitors unable to verify: <list>
\`\`\`
`;
