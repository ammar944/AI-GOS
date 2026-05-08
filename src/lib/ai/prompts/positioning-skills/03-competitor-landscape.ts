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

### Output structure (markdown the worker validator parses)

\`\`\`
# Competitor Landscape & Positioning

## Full Competitor Set
### Direct
- <Name> — <1-line buyer-language framing>; source: <url>, <date>
### Indirect
- <Name> — adjacent category <category>, same job: <job>; source: <url>, <date>
### Status-Quo
- <e.g. "stay on spreadsheets"> — why it persists: <reason>
### DIY
- <e.g. "internal Python script"> — feasibility: <reason>; cost to maintain: <signal>

## Positioning Taxonomy (top 5 direct)
### <Competitor 1>
- Hero (verbatim): "<...>"
- Subhead (verbatim): "<...>"
- CTA (verbatim): "<...>"
- Category claim: <leader|challenger|niche|disruptor|unbundler|native-AI>
- Problem frame (their words): "<...>"
- Source: <url>, <date>

## Pricing Reality
- <Competitor> — tiers: <list with amounts>; packaging: <pattern>; annual discount: <%>; source: <url>, <date>
- <Competitor with gated pricing> — public signal: "<contact sales>"; pricing-on-request flag: <yes>

## Share-of-Voice Map
### Search terms (top 10-20)
- "<term>" — top-3 organic: <list>; paid bidders: <list>; source: <provider>, <date>
### Communities
- <community name> — most-mentioned competitor: <name> (<n> threads in <date range>); source: <search url>
### Publications
- <publication> — coverage in last 12mo: <list with urls>

## Strengths & Weaknesses
### <Competitor 1>
- Strengths (verbatim 4-5★):
  - "<quote>" — <reviewer role>, <url>, <date>
- Weaknesses (verbatim 1-3★):
  - "<quote>" — <reviewer role>, <url>, <date>
- Analyst placement: <Forrester/Gartner/IDC/G2 Grid> — <position>, source: <url>, <date>

## Narrative Arc (top 5)
### <Competitor 1>
- Villain: <named or "implicit/none">
- Hero: <named or "implicit/none">
- Transformation: <before vs after>
- Source: <url>, <date>

## Confidence & Gaps
- High-confidence claims: <list>
- Single-source claims: <list>
- Competitors unable to verify: <list>
\`\`\`
`;
