// Pre-Pitch Positioning Audit — Section 04
// Required-outputs derived from section name "Voice of Customer & Objection
// Evidence"; the verbatim user paste is not in the worktree. Pain-mining and
// evidence-rules pattern mirrors industry-market-skill.ts + icp-targeting-skill.ts.
// Prepended to the voiceOfCustomer runner system prompt.

export const VOICE_OF_CUSTOMER_SKILL = `
## Voice of Customer & Objection Evidence — Section 04

Strategic question: **what do real buyers actually say — about their pain, the alternatives, and the objections that block a purchase?**
Output is the verbatim language pool that fuels every ad headline, body, and rebuttal in cold traffic.

### Required outputs

- **Verbatim pain language (≥15 quotes)**
  - 1-3 star G2/Capterra reviews of competitors and adjacent products — source URL + reviewer role + date for each
  - Reddit threads (subreddits: r/<industry>, r/SaaS, r/sales, r/marketing) — top complaint posts, source URL + thread date
  - HackerNews complaint comments — URL + comment timestamp
  - Public LinkedIn posts where buyers vent — URL + author title
  - Support forum / community posts (Discourse, Slack communities, vendor communities) — URL + date
  - Group quotes by theme: cost / time / trust / complexity / risk
- **Top 5 objection patterns** (ranked by frequency observed in reviews + threads)
  - For each: the objection in buyer's verbatim phrasing
  - Frequency signal (how many independent sources voiced it)
  - The proof artifact that defuses it (case study, ROI calc, free pilot, integration list, security cert)
  - Whether the company's current homepage / pricing page addresses it (yes / partial / no)
- **Switching trigger inventory**
  - Triggers that made buyers leave a competitor — cite specific review URLs
  - "What I wish [competitor] did" mentions — these are gap signals
  - Time-since-trigger: how long after the trigger does evaluation start? (immediate, weeks, quarters)
- **Pain ranking (frequency × intensity)**
  - Top 10 pains, each with: frequency count (independent mentions), intensity score (1-5: 1 = annoyance, 5 = career-risk / business-existential), example quote
  - Identify the hair-on-fire pain (intensity 4-5 + frequency in top 3) — that's the headline hook
- **Buyer search-language vs marketing-language gap**
  - 5-10 phrases buyers use that the company / competitors do NOT use on landing pages
  - Cite review URLs for each phrase
  - These are headline candidates because they collapse the message-market mismatch
- **Trust signals buyers explicitly value**
  - Mentioned trust signals in reviews: customer logos, review counts, certifications, named case studies, founder visibility, public roadmap, GitHub activity
  - Rank by frequency of mention
- **Risk-aversion patterns**
  - What stops buyers from saying yes: contract length, data ownership, integration breakage, vendor lock-in, deprecation history
  - Public proof points the company can offer to neutralize each

### Evidence rules

- **No fabricated quotes.** Every quote has a source URL and the date observed. If no real quote exists for a pain, say so explicitly — do not invent buyer language.
- **Verbatim only.** Preserve typos, slang, ALL CAPS, profanity. Sanitized quotes are useless for ad copy.
- **Pull from competitor reviews, not just the company's own.** The company's reviews are filtered by their existing positioning; competitor reviews show unfiltered demand.
- **Independent sources.** Three reviews on the same product about the same pain = one signal, not three. Three reviews across three different competitors about the same pain = a category-level pain.
- **Recency.** Prefer reviews from the last 18 months. Older reviews flag with \`(historical, <date>)\`.
- **Intensity is observable.** "Frustrating" is intensity 2. "Cost me my job" is intensity 5. Don't rate intensity from your own read — quote the language that shows it.
- **Marketing-language gap is testable.** "We deliver outcomes" on a homepage vs "I just want it to send the email when the customer clicks" in a review = a real gap. Cite both.

### Output structure

\`\`\`
# Voice of Customer & Objection Evidence

## Verbatim Pain Quotes (≥15)
### Theme: Cost
- "<quote>" — <reviewer role>, <source url>, <date>
### Theme: Time
- ...
### Theme: Trust
- ...
### Theme: Complexity
- ...
### Theme: Risk
- ...

## Top 5 Objections
1. "<verbatim objection>" — frequency: <n> sources; defuse with: <proof artifact>; current site addresses: <yes|partial|no>
2. ...

## Switching Triggers
- Trigger: <event>; quote: "<...>"; source: <url>
- "I wish [competitor] did X" mentions: <list>
- Typical time-from-trigger to evaluation: <range>

## Pain Ranking (top 10)
- <pain>, frequency: <n>, intensity: <1-5>, example: "<quote>"
- Hair-on-fire pain (the headline hook): <pain>

## Buyer-Language Gap
- Buyers say "<phrase>" — landing pages don't (sources: <urls>)
- ...

## Trust Signals (ranked by mention)
- <signal> — mentioned in <n> reviews

## Risk-Aversion Patterns
- Concern: <concern>; neutralize with: <proof point>

## Confidence & Gaps
- Pains with strong cross-source evidence: <list>
- Pains with single-source evidence: <list>
- Themes for which no real quote was found: <list>
\`\`\`
`;
