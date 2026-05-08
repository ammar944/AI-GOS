// Pre-Pitch Positioning Audit — Section 02
// Required-outputs bullets are the verbatim spec from the user's 2026-05-09 paste.
// Evidence-rules pattern mirrors industry-market-skill.ts.
// Prepended to the buyerIcpValidation runner system prompt.

export const BUYER_ICP_VALIDATION_SKILL = `
## Buyer & ICP Validation — Section 02

Strategic question this section answers: **does the ICP they described exist in the wild, and in what shape?**
Output validates the buyer hypothesis with public-signal evidence — not assumed from a positioning deck.

### Required outputs

- **ICP existence check**
  - Account counts by firmographic cut: industry / sub-industry, employee bands (1-50, 51-200, 201-1K, 1K-10K, 10K+), revenue bands, geography, tech-stack signals where relevant
  - Cite the source for each count (LinkedIn Sales Navigator, ZoomInfo, BuiltWith, public industry data) WITH date observed
  - Flag if the addressable ICP is <100 accounts globally — signals a niche or aspirational segment
- **Persona reality**
  - Buyer titles, seniority levels, typical team size, org-chart position (who they report to, what reports to them)
  - Source per title: LinkedIn title-search counts, named real individuals at named real ICP companies, current relevant job postings
  - At least 5 named real persons at named real ICP companies WITH source URL (LinkedIn, public bios, conference rosters)
- **Awareness-level distribution across the ICP** (unaware → most-aware)
  - Estimate the share of the ICP at each Schwartz awareness level: unaware, problem-aware, solution-aware, product-aware, most-aware
  - Evidence per level: search-volume split between informational vs commercial queries, review-language sophistication, content gaps in competitor pages
  - Implication for ad copy — the dominant awareness level dictates the headline strategy (problem-led vs solution-led vs product-led)
- **Buying context — observable triggers that move accounts from passive to active**
  - Public events that flip an account from browsing to evaluating: funding rounds, leadership changes, regulatory deadlines, layoffs, public incidents, platform migrations, hiring spikes for the relevant role
  - For each trigger: how to detect from public signal (LinkedIn activity, SEC filings, Crunchbase, news, BuiltWith change alerts), how to operationalize as ad-targeting or outbound condition
  - Estimated trigger-to-evaluation window (immediate / weeks / quarters)
- **Where they actually cluster**
  - Named communities — subreddits, Discord servers, Slack workspaces, vendor communities, industry forums
  - Named newsletters with ICP-fit subscriber estimates
  - Named conferences / events with ICP-fit attendance
  - Named podcasts with ICP-fit listenership
  - Source per claim: public subscriber counts where available, founder/admin LinkedIn signals, traffic estimators (SimilarWeb, Sparktoro)

### Evidence rules

- **Cite or omit.** Every quantitative claim has a source URL and the date observed. No untraceable counts.
- **Real names or none.** If you cannot name 5 real individuals at named real ICP companies, say "ICP is abstract — recommend primary discovery before ad spend." Do not fabricate persona examples.
- **Audience numbers must be live.** Cite the source date — LinkedIn audience sizes and BuiltWith counts shift weekly.
- **Trigger detectability is binary.** Either the signal is publicly observable (LinkedIn job changes, SEC filings, Crunchbase rounds, BuiltWith deltas) or it is not. "Internal frustration" is not a detectable trigger.
- **Awareness levels need evidence.** Don't assume the ICP's awareness level from the company's positioning deck. Pull search-volume distribution and review-language samples.
- **Cluster claims need traffic numbers.** "They hang out in this subreddit" with no subscriber count is not evidence. Cite SimilarWeb / Sparktoro / public counts.
- **Recency.** Prefer 2025-2026 sources. If the only available source is 2023+, flag it as historical.

### Output structure (markdown the worker validator parses)

\`\`\`
# Buyer & ICP Validation

## ICP Existence
- Account counts by cut:
  - Industry / sub-industry: <n> (source: <url>, <date>)
  - Employee bands: <ranges and counts>
  - Revenue bands: <ranges and counts>
  - Geography: <regions and counts>
  - Tech-stack signals: <signals and counts>
- Total addressable accounts: <n>
- Verdict: <named-real|niche|aspirational>

## Persona Reality
- Title 1: <title> — seniority <level>, team size <n>, reports to <role>
  - Source: <LinkedIn search url>, <date>; named persons: <list with urls>
- Title 2: ...

## Awareness-Level Distribution
- Unaware: <%> — evidence: <signal>
- Problem-aware: <%> — evidence: <signal>
- Solution-aware: <%> — evidence: <signal>
- Product-aware: <%> — evidence: <signal>
- Most-aware: <%> — evidence: <signal>
- Dominant level: <level> → headline strategy: <problem-led|solution-led|product-led>

## Buying Context (Triggers)
- Trigger: <event>; detection: <signal source>; targeting condition: <condition>; trigger-to-evaluation window: <range>

## Where They Cluster
- Communities: <name> — <subscriber count>, source: <url>
- Newsletters: <name> — <subscriber estimate>, source: <url>
- Events: <name> — <attendance>, source: <url>
- Podcasts: <name> — <listenership>, source: <url>

## Confidence & Gaps
- High-confidence claims: <list>
- Low-confidence claims: <list with reasons>
- Bullets unable to source: <list>
\`\`\`
`;
