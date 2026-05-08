// Pre-Pitch Positioning Audit — Section 06
// Required-outputs derived from section name "Offer & Performance Diagnostic";
// the verbatim user paste is not in the worktree. Evidence-rules + offer-strength
// dimensions mirror offer-analysis-skill.ts.
// Prepended to the offerDiagnostic runner system prompt.

export const OFFER_DIAGNOSTIC_SKILL = `
## Offer & Performance Diagnostic — Section 06

Strategic question: **does the offer survive cold traffic, and where does it leak?**
Output is the offer audit: structure, pricing posture, conversion gap vs benchmarks, and the specific fixes that move performance before media spend scales.

### Required outputs

- **Current offer anatomy** (verbatim from the company's site)
  - Headline (hero h1) — exact words
  - Subhead / value prop — exact words
  - CTA — exact words
  - Pricing structure: tiers, prices, billing cadence, free tier, trial length
  - Guarantee: refund policy, SLA, money-back terms (or absence)
  - Onboarding promise (time-to-value claim) — exact words
  - Risk-reversal mechanisms (pilot, free migration, no credit card, etc.)
- **Offer strength score (6 dimensions, 1-10 each)**
  - Pain Relevance — does it solve a hair-on-fire problem? (cite Section 04 hair-on-fire pain)
  - Urgency — is there a reason to buy NOW vs later? (regulatory deadline, price increase, expiring bonus)
  - Differentiation — can a buyer distinguish this from top 3 alternatives in 10 seconds? (cite Section 03 positioning map)
  - Tangibility — can the buyer visualize the specific outcome (number, before/after, time saved)?
  - Proof — case studies > testimonials > claims; rank what's present
  - Pricing Logic — does the price make intuitive sense relative to the value delivered?
  - Score = sum (max 60). 50+ = strong. 35-49 = workable, fix dimensions <7. <35 = the offer is the bottleneck, not the media.
- **Conversion benchmark gap**
  - Identify the company's segment: low-touch SaaS / mid-market SaaS / enterprise / e-commerce / local services
  - Compare visible signals (site CTA, pricing page) against segment cold-traffic conversion floors:
    - Free trial / freemium: 10-25% visitor-to-signup
    - Low-touch SaaS (<$50/mo): 2-5% LP CVR
    - Mid-market SaaS ($200-2K/mo): 1-3% to demo
    - Enterprise ($5K+/mo): 0.5-2% to meeting
    - E-commerce: 2-4% (5-8% optimized DTC)
  - Where the offer is below floor: cite the specific element (price hidden, generic CTA, no proof, etc.)
- **Pricing teardown**
  - Strategy: value-based / cost-plus / good-better-best / freemium / usage-based / outcome-based
  - Anchor mechanics: is there a deliberate decoy or a high-end anchor?
  - Charm vs round pricing: $97 (deal-coded) vs $100 (quality-coded) — does it match brand position?
  - Annual vs monthly: discount level (industry standard 15-20%); justify if higher
  - Competitor price comparison: cite Section 03 competitor pricing posture; identify if company is above / below / at parity
- **Risk-reversal audit**
  - Trial length: <7 days too short for considered B2B; >30 days creates procrastination; 7-14 optimal for low/mid-touch
  - Money-back guarantee: present? terms?
  - Pilot program: paid pilot vs free pilot — which fits the segment?
  - Cancel-anytime visibility: is friction hidden in fine print?
- **Cold-traffic readiness checklist**
  - Above-the-fold: outcome headline + how-it-works subhead + CTA + social proof — all present?
  - Specificity: "$47K saved in 90 days" beats "save money" — does the page have specific outcomes?
  - One CTA per page (multiple CTAs reduce conversion 20-30%)
  - Trust signals: customer logos / review counts / security badges / "as seen in"
  - Objection handling: FAQ or comparison addresses top 3 buyer objections (cite Section 04)
  - Page speed: <3s load time mandatory
  - Mobile responsiveness: hero stack works at 375px viewport
- **Top 5 offer fixes (ranked by expected impact)**
  - For each: the specific change, the dimension it improves, the evidence it will move (e.g. "add a 7-day money-back — Pricing Logic: 5→8")
  - Sequenced: which fix first, which depends on which

### Evidence rules

- **Verbatim site copy.** Pull headline / subhead / CTA exactly as they appear. Don't summarize.
- **Cite the URL + date for every site quote.** Sites change weekly.
- **Benchmarks are floors, not targets.** Below-floor = a hard structural problem. At-floor = needs creative iteration. Above-floor = scale media.
- **Distinguish offer fixes from media fixes.** If the offer scores <35 on strength, no amount of better ad creative saves it. Say so.
- **Score conservatively.** 10/10 on any dimension requires extraordinary evidence (e.g. category-defining proof point, multi-year case-study moat).
- **Tie back to other sections.** Pain Relevance cites Section 04. Differentiation cites Section 03. Urgency cites Section 01 structural forces and Section 05 triggering signals. The offer is the synthesis.
- **No invented prices.** If pricing isn't public, say "pricing-on-request" and flag the friction cost (sales-led-only filters out 50-70% of cold buyers).

### Output structure

\`\`\`
# Offer & Performance Diagnostic

## Current Offer Anatomy (verbatim)
- Headline: "<exact>"
- Subhead: "<exact>"
- CTA: "<exact>"
- Pricing: <tiers and amounts>
- Guarantee: <terms or "none">
- Onboarding promise: "<exact or none>"
- Risk reversal: <list>
- Source: <url>, <date>

## Offer Strength Score (60 max)
- Pain Relevance: <n>/10 — <reason citing Section 04>
- Urgency: <n>/10 — <reason>
- Differentiation: <n>/10 — <reason citing Section 03>
- Tangibility: <n>/10 — <reason>
- Proof: <n>/10 — <reason>
- Pricing Logic: <n>/10 — <reason>
- TOTAL: <sum>/60 — <strong|workable|bottleneck>

## Benchmark Gap
- Segment: <low-touch SaaS|mid-market|enterprise|ecommerce|local>
- Cold-traffic floor for segment: <range>
- Where the offer leaks: <list of specific elements below floor>

## Pricing Teardown
- Strategy: <value-based|cost-plus|GBB|freemium|usage|outcome>
- Anchor: <decoy/high-end/none>
- Charm vs round: <classification + brand-fit assessment>
- Annual discount: <%>
- Competitor parity: <above|at|below>

## Risk Reversal
- Trial: <length, fit assessment>
- Money-back: <terms or none>
- Pilot: <paid|free|none>
- Cancel friction: <observed>

## Cold-Traffic Readiness
- Above-the-fold: <pass/fail per element>
- Specificity: <pass/fail with example>
- Single CTA: <pass/fail>
- Trust signals: <pass/fail with list>
- Objection handling: <pass/fail with top-3 from Section 04>
- Page speed: <s, pass/fail>
- Mobile: <pass/fail>

## Top 5 Offer Fixes (ranked)
1. <fix> — improves <dimension> from <n> to <n>; depends on: <prior fix or none>
2. ...

## Confidence & Gaps
- Visible-signal claims (site copy): high-confidence
- Inferred-from-segment claims: medium-confidence
- Hidden-pricing flags: <list>
\`\`\`
`;
