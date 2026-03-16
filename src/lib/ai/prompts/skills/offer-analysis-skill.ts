// Sources: coreyhaines31/pricing-strategy + page-cro, claude-ads/benchmarks.md,
// zubair-trabzada/market-funnel, alirezarezvani/ad-creative
// Prepend to researchOffer sub-agent system prompt

export const OFFER_ANALYSIS_SKILL = `
## Offer & Pricing Analysis Domain Knowledge

### Pricing Strategy Frameworks
- Value-Based: price anchored to customer's perceived value, not cost (preferred for SaaS)
- Good-Better-Best: 3-tier structure. Best tier is the anchor, Better is the target conversion tier
- Van Westendorp: survey-based price sensitivity — intersection of "too cheap" and "too expensive"
- Per-Seat vs Usage-Based: per-seat is predictable; usage-based aligns with value but creates uncertainty
- Freemium: works when free tier demonstrates value AND creates natural upgrade pressure
- Outcome-Based (2026 trend): charge per result (meetings booked, invoices collected) — highest alignment

### Pricing Psychology Principles
- Charm Pricing: $97 > $100 (9-ending signals deal), $100 > $97 (round signals quality) — match to positioning
- Rule of 100: for items <$100, use percentage off; for >$100, use dollar amount off
- Decoy Effect: add a deliberately inferior option to make the target tier look better
- Price Anchoring: show enterprise tier first, then mid-tier feels like a bargain
- Annual Discount: standard is 15-20% off monthly — if offering more, justify why

### Cold Traffic Conversion Thresholds
- Free trial/freemium: 10-25% visitor-to-signup for well-optimized pages
- Low-touch SaaS (<$50/mo): 2-5% landing page conversion rate
- Mid-market SaaS ($200-2000/mo): 1-3% conversion rate, often to demo/call
- Enterprise ($5K+/mo): 0.5-2% conversion to meeting, sales-assisted close
- E-commerce: 2-4% average, 5-8% for optimized DTC brands
- If cold traffic conversion is below these floors, the offer needs fixing before scaling ads

### Offer Strength Scoring Dimensions
1. Pain Relevance (1-10): does the offer solve a hair-on-fire problem?
2. Urgency (1-10): is there a reason to buy NOW vs later?
3. Differentiation (1-10): can a buyer distinguish this from the top 3 alternatives in 10 seconds?
4. Tangibility (1-10): can the buyer visualize the specific outcome they'll get?
5. Proof (1-10): what evidence supports the claims? (case studies > testimonials > claims)
6. Pricing Logic (1-10): does the price make intuitive sense relative to the value delivered?

### Red Flags That Kill Ad Performance
- "We help businesses grow" — too vague, no specificity
- No clear outcome: buyers need to see WHAT they get, not just HOW it works
- Price hidden until demo call — increases friction, filters out high-intent buyers
- No competitor differentiation — "better" is not a position, specific is
- Long free trial (30+ days) — creates procrastination, 7-14 days is optimal
- No social proof on landing page — conversion drops 25-40% without it

### CRO Principles for Landing Pages
- Above the fold: headline (outcome) + subhead (how) + CTA + social proof
- Specificity wins: "$47K saved in 90 days" > "save money"
- One CTA per page — multiple CTAs reduce conversion by 20-30%
- Trust signals: customer logos, review counts, security badges, "as seen in"
- Objection handling: FAQ or comparison section addresses top 3 buyer concerns
- Page speed: every 1s of load time costs 7% conversion — under 3s is mandatory

### Value Proposition Architecture
- Format: "[Result] without [pain/risk] in [timeframe]"
- Example: "Close 3x more deals without hiring SDRs in 30 days"
- Test: can a stranger understand what you do and why it matters in 10 seconds?
- If the value prop requires explanation, it's too complex for cold traffic ads
`;
