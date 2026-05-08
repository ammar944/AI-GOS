// Pre-Pitch Positioning Audit — Section 03
// Required-outputs bullets are the verbatim spec from the user's 2026-05-09 paste.
// Evidence-rules pattern mirrors industry-market-skill.ts.
// Prepended to the competitorLandscape runner system prompt.

export const COMPETITOR_LANDSCAPE_SKILL = `
## Competitor Landscape & Positioning — Section 03

Strategic question this section answers: **who are they really competing with, and how is each of those competitors framing the market?**
Output is the buyer's perception of "the alternatives" — not the company's preferred competitor list.

### Required outputs

- **Full competitor set — direct, indirect, status-quo, DIY**
  - Direct: top 5-10 named competitors that solve the same job for the same buyer
  - Indirect: top 3-5 in adjacent categories that solve the same job differently
  - Status-quo: what the buyer does TODAY without any vendor (spreadsheets, manual process, an existing internal tool)
  - DIY: build-your-own paths the buyer credibly considers (in-house engineering, open-source stack, no-code assembly)
  - Source per entry: G2/Capterra category page URL, review URL, or homepage URL WITH date observed
- **Positioning taxonomy — how each competitor describes the problem and their solution**
  - For top 5 direct competitors: verbatim hero h1, verbatim subhead, verbatim primary CTA — quoted from their homepage
  - The category claim each makes (leader / challenger / niche / disruptor / unbundler / native-AI alternative)
  - The frame they use for the buyer's problem in their own words
  - Source URL + date observed per quote (homepage copy changes weekly)
- **Pricing reality — public prices, gated-pricing signals, packaging patterns**
  - Per competitor: public price tiers + amounts, OR gated-pricing flag ("contact sales," "request a demo")
  - Packaging pattern: per-seat / per-usage / flat / good-better-best / freemium / pay-as-you-go / outcome-based
  - Annual-vs-monthly discount level where visible
  - Source URL + date observed for every price (pricing pages change monthly)
- **Share-of-voice map — who owns which search terms, communities, publications**
  - Top 10-20 category search terms: which competitor ranks top-3 organically, which is bidding paid, the SoV split
  - Communities: in each named ICP community (subreddit / Discord / Slack / forum) which competitor's name comes up most often, with thread-count evidence
  - Publications: in the top 5 trade publications for the category, who has earned coverage in the last 12 months (named pieces with URLs)
  - Source per claim: Ahrefs / SEMrush / SearchAPI export with date; community thread search with URLs; publication search with URLs
- **Public strengths/weaknesses — from reviews, verbatim customer complaints, analyst mentions**
  - Per top-5 competitor: 2-3 verbatim 4-5 star review quotes (strengths) and 2-3 verbatim 1-3 star review quotes (weaknesses)
  - Each quote: source URL, reviewer role, date
  - Analyst mentions: any Forrester / Gartner / IDC / G2 Grid / Capterra Shortlist placement WITH source + date
  - Patterns across review sets: the recurring strength language, the recurring weakness language
- **Competitor narrative arc — villain, hero, transformation claim**
  - Per top-5 competitor: the villain they cast (the bad old way / the incumbent / the missing capability), the hero they cast (themselves / the buyer using them), the transformation claim (the "before vs after" the buyer is sold)
  - Source: about page, manifesto, founder essays, conference keynote summaries
  - The shared narrative tropes across the competitive set — and the empty narrative slots no one is using

### Evidence rules

- **Cite or omit.** Every claim has a source URL and the date observed. No untraceable positioning quotes.
- **Verbatim quotes only.** Pull homepage hero copy, subheads, CTAs exactly. No paraphrasing. Preserve typos and casing.
- **Pricing must include the date.** Pricing pages change monthly — a stale price is worse than no price.
- **Reviews are the truth source.** Mine 1-3 star reviews for weaknesses, 4-5 star reviews for strengths. Do not infer from marketing copy.
- **Status-quo competition counts.** If the buyer's real alternative is "do nothing" or "stay on spreadsheets," name it — that is harder to beat than another vendor.
- **SoV claims need numbers.** "Competitor X dominates Reddit" with no thread count is not evidence. Cite the search query + result count + date.
- **Narrative arc claims need a source page.** If the about page does not state a villain, do not invent one. Note "no explicit narrative arc" instead.
- **Recency.** Prefer 2025-2026 sources. Flag anything 2023+ as historical.

### Output shape
Return JSON with this exact key set, no extra keys, no markdown fences:

\`\`\`
{
  "sectionTitle": "Competitor Landscape & Positioning",
  "specialistAgent": "Competitor Landscape Specialist",
  "skillUsed": "ai-gos-competitor-landscape",
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
