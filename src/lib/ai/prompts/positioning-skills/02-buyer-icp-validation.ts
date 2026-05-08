// Pre-Pitch Positioning Audit — Section 02
// Required-outputs derived from section name "Buyer & ICP Validation"; the
// verbatim user paste is not in the worktree. Evidence-rules + buying-committee
// pattern mirrors icp-targeting-skill.ts.
// Prepended to the buyerIcpValidation runner system prompt.

export const BUYER_ICP_VALIDATION_SKILL = `
## Buyer & ICP Validation — Section 02

Strategic question: **who actually buys this, and is the ICP real or aspirational?**
This section validates that the ICP can be NAMED, REACHED, and is ACTIVELY in pain — not assumed from a positioning deck.

### Required outputs

- **Named ICP companies**
  - At least 10 real companies that fit the ICP, with company name + employee count + industry
  - Source for each (current customer, public case study, LinkedIn, public funding announcement)
  - Flag if you cannot name 10 — that signals an abstract or aspirational ICP
- **Buying committee map**
  - Economic Buyer: title, budget authority, what ROI they care about
  - Technical Buyer: title, evaluation criteria, common objection (security/integration/scale)
  - Champion: title, internal pain that motivates them, what ammunition they need
  - Blocker(s): IT/security/legal/finance — what slows or kills deals
  - End User: title, daily-job-to-be-done, UX expectations
- **ICP segmentation**
  - Tier-A (best fit, highest LTV): firmographic + signal definition
  - Tier-B (workable, second priority): how it differs from A
  - Tier-C (avoid / disqualify): why this segment doesn't work
- **Reachability evidence**
  - LinkedIn matched audience size for Tier-A targeting
  - Meta/Google matched-audience size for the same definition
  - At least 2 platforms reachable above viable thresholds (LinkedIn 50K+, Meta 1M+ cold, Google 1K+ monthly searches for top intent term)
  - Flag if Tier-A is reachable on <2 platforms — paid media is then high-risk
- **Triggering events (urgency drivers)**
  - 3-5 events that create buying urgency (funding round, leadership change, regulatory deadline, public outage, layoffs, new platform launch)
  - For each: how detectable from public signal, how to operationalize as ad-targeting condition
- **Buyer psychology — top 5 mental models that apply**
  - From: Jobs-to-Be-Done, Loss Aversion, Anchoring, Social Proof, Status Quo Bias, Goal Gradient, Peak-End
  - For each: why it applies to THIS buyer (not generic), example trigger phrase
- **ICP confidence score (0-100)**
  - Formula: validated buyer language sourced (+30) + platform targeting confirmed (+25) + budget authority verified (+25) + named real companies ≥10 (+20)
  - 80-100 = validated; 60-79 = workable, test with small budget; <60 = invalid, recommend primary research

### Evidence rules

- **Real names or none.** If you cannot name 10 real companies in the ICP, say "ICP is abstract — recommend primary discovery before ad spend."
- **Verbatim buyer language.** Quote real reviews, real LinkedIn posts, real Reddit threads. Cite source URL. Do not paraphrase the company's positioning deck.
- **Audience numbers must be live.** Cite the source date — LinkedIn audience sizes shift weekly.
- **Distinguish Champion from End User.** Champions have political capital and need slides. End Users have daily pain and need GIFs. Different ad creatives.
- **Triggering events must be detectable.** "They're frustrated" is not a trigger. "Filed S-1 last week" is.
- **Budget authority is a hard claim.** Cite a public org chart, ZoomInfo signal, or named contact — not a guess from job title.

### Output structure

\`\`\`
# Buyer & ICP Validation

## Named ICP Companies (≥10)
- <Company>, <employees>, <industry> — source: <url>
- ...

## Buying Committee
- Economic Buyer: <title> — controls <budget>, optimizes for <ROI metric>
- Technical Buyer: <title> — evaluates <criteria>, blocks on <objection>
- Champion: <title> — pain: <pain>, needs: <ammunition>
- Blocker(s): <title> — <how they slow deals>
- End User: <title> — daily job: <job>

## ICP Segmentation
- Tier-A: <firmographic + signal definition>
- Tier-B: <delta from A>
- Tier-C disqualify: <why>

## Reachability
- LinkedIn audience: <n> (source date: <date>)
- Meta cold audience: <n>
- Google top intent kw monthly searches: <n>
- Verdict: reachable on <n>/3 platforms (viable: ≥2)

## Triggering Events
- <event> — public signal: <signal>, ad-targeting condition: <condition>

## Buyer Psychology (top 5)
- <model> — applies because <reason>; trigger phrase: "<phrase>"

## ICP Confidence
- Score: <0-100>
- Verdict: <validated|workable|invalid>
- Top assumptions to retire with primary research: <list>
\`\`\`
`;
