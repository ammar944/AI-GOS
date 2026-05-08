// Pre-Pitch Positioning Audit — Section 04
// Required-outputs bullets are the verbatim spec from the user's 2026-05-09 paste.
// Evidence-rules pattern mirrors industry-market-skill.ts.
// Prepended to the voiceOfCustomer runner system prompt.

export const VOICE_OF_CUSTOMER_SKILL = `
## Voice of Customer & Objection Evidence — Section 04

Strategic question this section answers: **what do real buyers say — in their own words, not our guesses?**
Output is the verbatim language pool that fuels every ad headline, body, and rebuttal in cold traffic.

### Required outputs

- **Pain language — verbatim quotes from reviews, forums, support threads, sales-call transcripts**
  - Minimum 15 verbatim quotes, each pulled from a real public source: G2/Capterra reviews, Reddit threads, HackerNews comments, support forums (Discourse, vendor communities), Slack/Discord communities, public LinkedIn posts, sales-call transcripts where shared
  - Per quote: source URL, reviewer/poster role or handle, date observed
  - Group quotes by theme — cost, time, trust, complexity, risk, tool-fragmentation, vendor-failure (use the themes that emerge from the actual quotes, not preset themes)
  - Preserve typos, casing, slang, profanity exactly as written
- **Objection evidence — what actually stops purchase, phrased how buyers phrase it**
  - The top 5 objections that block conversion, ranked by independent-source frequency
  - Each objection in the buyer's own words (verbatim from a quoted source) — not a paraphrase
  - Source URL + date per objection quote
  - The proof artifact that defuses each objection (case study, ROI calculation, integration list, security cert, free pilot, money-back guarantee)
  - Whether the company's current homepage / pricing page / FAQ already addresses it (yes / partial / no)
- **Switching stories — what made buyers leave a prior solution**
  - Verbatim "switched from X" / "left X for Y" mentions in G2/Capterra reviews, Reddit threads, public LinkedIn posts
  - Per story: source URL, the named prior solution, the named replacement (if any), the trigger event in the buyer's words
  - Pattern across stories: the recurring switching trigger types (price hike, missing feature, support failure, acquisition aftermath, data-export pain, security incident)
  - Time-from-trigger to evaluation start (immediate / weeks / quarters) where stated
- **Stated decision criteria — what buyers say matters in evaluation**
  - Verbatim quotes where buyers list what they evaluated on: feature checklists, integration requirements, support quality, pricing fairness, security posture, time-to-value, vendor stability
  - Per quote: source URL, role, date
  - The 5-7 decision criteria that show up most often across independent quotes
  - Distinguish between criteria buyers say MATTER and criteria buyers say BLOCKED them — sometimes different
- **Success-state language — how buyers describe the "after"**
  - Verbatim quotes where buyers describe outcomes after adopting a solution: time saved, dollars made, errors avoided, anxiety relieved, status earned, fires prevented
  - Per quote: source URL, reviewer role, date
  - Group by outcome type — quantified outcomes (numbers and timeframes) vs qualitative outcomes (relief / pride / control)
  - The hair-on-fire success language (the phrases that signal life-changing impact, not minor improvements) — these are the headline-candidate phrases for cold-traffic ads

### Evidence rules

- **No fabricated quotes.** Every quote has a source URL and the date observed. If no real quote exists for a theme, say so explicitly — do not invent buyer language.
- **Verbatim only.** Preserve typos, slang, ALL CAPS, profanity. Sanitized quotes are useless for ad copy.
- **Pull from competitor reviews and adjacent-category reviews, not just the company's own.** The company's own reviews are filtered by their existing positioning; competitor and adjacent reviews show unfiltered demand.
- **Independent sources count.** Three quotes from the same product about the same pain = one signal, not three. Three quotes across three different competitors about the same pain = a category-level pain.
- **Recency.** Prefer reviews from the last 18 months. Older reviews flag with \`(historical, <date>)\`.
- **Frequency is observable.** Count independent sources, do not estimate.
- **Switching stories need named prior tools.** "Switched from a competitor" without naming the prior tool is not actionable — flag and request the named source or omit.
- **Decision criteria from buyer language only.** Do not infer criteria from competitor feature pages — those are vendor claims, not buyer priorities.

### Output structure (markdown the worker validator parses)

\`\`\`
# Voice of Customer & Objection Evidence

## Pain Language (≥15 verbatim quotes)
### Theme: <theme that emerged>
- "<quote>" — <reviewer role>, <source url>, <date>
- ...
### Theme: <next theme>
- ...

## Top 5 Objections
1. "<verbatim objection>" — <n> independent sources; defuse with: <proof artifact>; current site addresses: <yes|partial|no>; sources: <urls>
2. ...

## Switching Stories
- Story: switched from <named tool> to <named tool>; trigger (verbatim): "<...>"; source: <url>, <date>; time-to-evaluation: <range>
- ...
- Recurring switching trigger types: <list>

## Stated Decision Criteria
- "<verbatim quote>" — <role>, <url>, <date>
- ...
- Top 5-7 criteria across independent sources: <list>
- Criteria that BLOCKED (separate from "matter"): <list>

## Success-State Language
### Quantified outcomes
- "<verbatim quote with number/timeframe>" — <role>, <url>, <date>
### Qualitative outcomes
- "<verbatim relief/pride/control quote>" — <role>, <url>, <date>
### Hair-on-fire success phrases (headline candidates)
- "<phrase>" — source: <url>, <date>

## Confidence & Gaps
- Themes with strong cross-source evidence: <list>
- Themes with single-source evidence: <list>
- Themes for which no real quote was found: <list>
\`\`\`
`;
