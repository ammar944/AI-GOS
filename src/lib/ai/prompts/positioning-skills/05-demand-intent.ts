// Pre-Pitch Positioning Audit — Section 05
// Required-outputs derived from section name "Demand & Intent Signals"; the
// verbatim user paste is not in the worktree. Evidence-rules + intent
// classification pattern mirrors keyword-ppc-skill.ts.
// Prepended to the demandIntent runner system prompt.

export const DEMAND_INTENT_SKILL = `
## Demand & Intent Signals — Section 05

Strategic question: **is real demand visible right now, and what intent signals can the company reach?**
Output is the demand map: where buyers are searching, what they're searching for, how much volume exists, and which signals trigger purchase.

### Required outputs

- **Top intent keywords (≥20)**
  - Group by intent classification: \`transactional\` | \`commercial-investigation\` | \`informational\` | \`navigational\`
  - For each: keyword, monthly search volume (US + global), competition score, top-of-page CPC, top 3 ranking domains
  - Cite the data source and date observed (Ahrefs, SEMrush, SearchAPI, Google Keyword Planner)
  - Priority for paid: Transactional > Commercial > Navigational > Informational
- **Intent gap analysis**
  - Keywords with high intent + low competition = white-space bid opportunities
  - Keywords with high competition + low CVR signals (e.g. content-only top-10) = a paid wedge
  - Keywords competitors rank for that the company does not — list with traffic estimate
- **Demand trajectory**
  - 24-month Google Trends line for top 5 category terms — up / flat / down with % move
  - Seasonality patterns (B2B Q4 budget flush, ecommerce BFCM, education enrollment cycles, etc.) WITH source
  - Year-over-year volume change for top intent keywords
- **Triggering signals (intent moments)**
  - Public events that signal active evaluation: funding rounds, hiring spikes for [target role], leadership changes, product launches, layoffs, regulatory deadlines, public outages
  - For each: how to detect from public signal (LinkedIn, Crunchbase, SEC, news), how to operationalize as ad-targeting condition or outbound trigger
  - Estimated trigger-to-purchase window
- **Channel-specific demand patterns**
  - Google Search: total intent volume + CPC range — viable budget floor
  - LinkedIn: matched audience size + engagement benchmarks — viable budget floor (typically $3K/mo+)
  - Meta: cold prospecting size + B2B retargeting size
  - YouTube: category view volume on top 5 video search terms
  - Microsoft Ads: same intent keywords, 20-35% CPC discount estimate
  - Reddit: subreddit subscriber counts + thread frequency for category terms
- **Buyer journey map (intent stages)**
  - Awareness queries (informational): what buyers search before they know the category
  - Comparison queries (commercial): "X vs Y", "best X", "alternatives to Y"
  - Decision queries (transactional): "X pricing", "X demo", "X reviews"
  - Brand queries (navigational): own + competitors
  - For each stage: 3-5 example queries with volumes
- **Intent-data plays available**
  - First-party: site visitors with stated intent (pricing-page views, demo abandons)
  - Second-party: review-platform intent (G2 buyer-intent feed, TrustRadius signals)
  - Third-party: Bombora, 6sense, ZoomInfo Intent (named only — viability depends on budget)
  - Public-signal: hiring-velocity scrapes, funding-round trackers, podcast guesting

### Evidence rules

- **All volumes must have a source + date.** Search volumes drift quarterly. Cite Ahrefs/SEMrush export date.
- **CPCs are estimates.** Always cite the source, mark as estimate, and note that real auction CPC varies with quality score and bid strategy.
- **Below-floor warnings.** If LinkedIn audience <50K, Meta cold <1M, Google top intent <1K monthly — flag the channel as high-risk regardless of how much intent exists in theory.
- **Trends are directional, not exact.** Google Trends is normalized. Use it for direction, not absolute volume.
- **Trigger detectability is binary.** Either the signal is publicly observable (LinkedIn job changes, SEC filings, Crunchbase rounds) or it is not. "Internal frustration" is not a detectable trigger.
- **Distinguish intent from interest.** Subreddit subscribers = audience size, not intent. People searching "<category> pricing" = intent.
- **Seasonality must cite history.** 18+ months of week-by-week data for any seasonality claim.

### Output structure

\`\`\`
# Demand & Intent Signals

## Top Intent Keywords (≥20)
### Transactional
- <kw> — <volume>/mo, CPC $<n>, competition: <score>, top-3: <domains>
### Commercial Investigation
- ...
### Informational
- ...
### Navigational
- ...
(Source: <provider>, exported <date>)

## Intent Gap Analysis
- High-intent + low-competition: <list>
- Competitor-only keywords: <list with traffic estimate>
- Content-only top-10 wedges: <list>

## Demand Trajectory
- Top 5 category terms (24mo): <up/flat/down> <±%>
- Seasonality: <pattern> (source: <provider>)
- YoY volume change (top intent kws): <±%>

## Triggering Signals
- Trigger: <event>; detection: <signal source>; targeting condition: <condition>; window: <range>

## Channel Demand
- Google Search: <volume>/mo intent, CPC $<low-high>, viable @ $<floor>
- LinkedIn: <audience>, viable @ $3K+/mo
- Meta: cold <size>, retargeting <size>
- YouTube: top-5 video search terms — <volumes>
- Microsoft: same kws, est. CPC $<low-high>
- Reddit: subreddit <name> — <subscribers>, thread frequency: <count>/wk

## Buyer Journey Stages
- Awareness: <example queries with volumes>
- Comparison: <...>
- Decision: <...>
- Brand: <...>

## Intent-Data Plays
- First-party: <plays>
- Second-party: <providers>
- Third-party: <providers, mark as needs-budget>
- Public-signal: <scrapes>

## Confidence & Gaps
- High-confidence intent claims: <list>
- Below-floor channel warnings: <list>
- Triggers without detection method: <list>
\`\`\`
`;
