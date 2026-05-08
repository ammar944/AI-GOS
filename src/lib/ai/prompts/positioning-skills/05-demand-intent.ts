// Pre-Pitch Positioning Audit — Section 05
// Required-outputs bullets are the verbatim spec from the user's 2026-05-09 paste.
// Evidence-rules pattern mirrors industry-market-skill.ts.
// Prepended to the demandIntent runner system prompt.

export const DEMAND_INTENT_SKILL = `
## Demand & Intent Signals — Section 05

Strategic question this section answers: **where does active demand live, and what is it asking?**
Output is the demand map: where buyers are searching, what they are searching for, what content gaps exist, and what real-world signals indicate active evaluation.

### Required outputs

- **Keyword demand — volume, intent type, current-ranking reality**
  - Top 20+ category-relevant keywords WITH: monthly search volume (US + global), intent type (\`transactional\` | \`commercial-investigation\` | \`informational\` | \`navigational\`), top-of-page CPC range, the top 3 currently-ranking domains
  - Cite the source for every volume + CPC: Ahrefs / SEMrush / SearchAPI / Google Keyword Planner WITH export date
  - Flag keywords where the top-ranking page is content-only (no commercial result in top-3) — those are paid-wedge candidates
  - Year-over-year volume change for the top 5-10 intent keywords
- **Question mining — People Also Ask, Reddit, Quora, community threads**
  - For the top 5-10 buyer-intent topics: pull the actual questions buyers are asking from PAA, Reddit (named subreddits), Quora, named industry forums and Slack/Discord communities
  - Per question: source URL, the verbatim question phrasing, the community/platform it came from, date observed
  - Group questions by the underlying job-to-be-done they reveal
  - The 10 highest-frequency questions across independent sources — these are headline + landing-page-content candidates
- **Content-gap evidence — topics with demand and weak competitor answers**
  - Topics where search volume is high AND the top-ranking content is shallow / outdated / answer-incomplete
  - Per gap: keyword, monthly volume, current top-ranking URL, why the answer is weak (depth, recency, missing buyer concern, no comparison data)
  - Source: SERP screenshot URL or live-fetch date
  - The 5-7 gaps the company could credibly fill given its positioning
- **Intent signals available in the wild — relevant job postings, RFPs, news triggers**
  - Job postings: searches on LinkedIn / Indeed / Greenhouse for titles or skills that signal the buyer is staffing up to evaluate or build the relevant capability — cite the search query + result count + date
  - RFPs: public RFPs on government / education portals that match the company's category (cite the RFP URL + close date)
  - News triggers: types of news events that flip an account into evaluation — leadership changes, funding rounds, regulatory deadlines, public outages, layoffs, mergers — with a recent example URL per type
  - Per signal: how to detect from public data, how to operationalize as ad-targeting condition or outbound trigger, estimated trigger-to-evaluation window
- **Event and community signal map — where conversations are actually happening**
  - Named conferences (in-person + virtual) with ICP-fit attendance estimates and dates
  - Named communities (subreddits, Discord, Slack, vendor communities, industry forums) with subscriber counts + thread-frequency for category terms
  - Named publications / newsletters that index the conversation (subscriber estimates where public)
  - Named podcasts where buyers AND vendors regularly appear
  - Per node: source URL, last-12-month activity signal (thread count, post count, attendance, subscriber growth), how to engage as a participant or sponsor

### Evidence rules

- **All volumes need a source + date.** Search volumes drift quarterly. Cite the export date.
- **CPCs are estimates.** Cite the source, mark as estimate, and note that real auction CPC varies with quality score and bid strategy.
- **No fabricated questions.** Every PAA / Reddit / Quora / community question is verbatim with a source URL.
- **Content-gap claims need a SERP snapshot.** "The top result is weak" is not evidence — cite the URL and what is missing.
- **Job-posting and RFP claims need real query results.** "Hiring is up for X role" without a search query + result count is not actionable.
- **Trigger detectability is binary.** Either the signal is publicly observable (LinkedIn, SEC, Crunchbase, news) or it is not. "Internal frustration" is not a detectable trigger.
- **Distinguish intent from interest.** Subreddit subscribers = audience size, not intent. People searching "<category> pricing" = intent.
- **Community / event claims need a number.** Subscriber count, attendance, thread frequency. No number = no evidence.
- **Recency.** Prefer 2025-2026 data. Flag anything 2023+ as historical.

### Output structure (markdown the worker validator parses)

\`\`\`
# Demand & Intent Signals

## Keyword Demand (≥20)
### Transactional
- "<kw>" — US <vol>/mo, global <vol>/mo, CPC $<low-high>, top-3: <domains>; YoY: <±%>
### Commercial Investigation
- ...
### Informational
- ...
### Navigational
- ...
- Source: <provider>, exported <date>
- Content-only top-3 (paid-wedge candidates): <list>

## Question Mining
### Topic: <buyer topic>
- "<verbatim question>" — <source>, <url>, <date>
- ...
- Top 10 highest-frequency questions: <list with frequency counts>

## Content Gaps
- Topic: <topic>; volume <n>/mo; current top URL: <url>; gap: <what is missing>
- ...
- Top 5-7 fillable gaps: <list>

## Intent Signals in the Wild
### Job postings
- Query: "<search>" — <n> postings (LinkedIn / Indeed / Greenhouse, <date>); targeting condition: <condition>
### RFPs
- <RFP title> — <url>, close date <date>
### News triggers
- Trigger type: <type>; example: <event URL>, <date>; trigger-to-evaluation window: <range>; targeting condition: <condition>

## Event & Community Signal Map
### Conferences
- <name> — <attendance>, dates: <dates>, source: <url>
### Communities
- <name> (subreddit/Discord/Slack/forum) — <subscribers>, thread freq: <n>/wk for "<term>"; source: <url>
### Publications / Newsletters
- <name> — <subscribers>, source: <url>
### Podcasts
- <name> — <listenership signal>, source: <url>

## Confidence & Gaps
- High-confidence claims: <list>
- Single-source claims: <list>
- Bullets unable to source: <list>
\`\`\`
`;
