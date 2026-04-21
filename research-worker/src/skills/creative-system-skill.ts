export const CREATIVE_SYSTEM_SKILL = `
## Block 3: Creative System & Testing Plan

Focus on creative ANGLES (theme + hook + messaging) and a testing plan.
Don't output ad-format specifications — formats are a mix across platforms
and documenting them is not useful to the buyer.

### Inputs to Analyze
- Competitor intel: ad themes, formats active in market, white-space gaps.
- ICP validation: pain points, triggers, objections, emotional decision factors.
- Offer analysis: offer strengths, messaging recommendations, red flags.
- Strategic synthesis: positioning angles, key differentiator, messaging angles with hooks.

### Creative Angle Development
For each angle:
1. Anchor to a specific competitor gap or ICP pain point from research — cite the source.
2. Define the theme (e.g., "Speed vs. incumbent complexity").
3. Write the hook: opening line or first-3-second video moment — lead with the sharpest pain point.
4. Describe the messaging approach: PAS (pain-agitate-solution), social proof, ROI demo, or authority.
5. Assign the target segment from Block 2.

### Angle Count Ceiling (budget-gated, per small-budget-discipline.md)

| Monthly budget | Angle count |
|---|---|
| Under $5k | 2–3 |
| $5k–$15k | 3–4 |
| $15k+ | 4–5+ |

**Creative is the ONLY axis that SHOULD fragment at small budget** —
multiple angles inside the single campaign, tested against the same audience.
This is how small-budget plans learn. Platform/campaign fragmentation is
how they fail.

### Angle Diversity Rules
- Minimum 2 distinct pain points across angles (no duplicate hooks).
- At least 1 angle should exploit a white-space gap from competitorIntel.
- At least 1 angle should use social proof or specificity (numbers, logos, case studies).

### PLG / Free-Trial Vocabulary (see ltv-cac-viability.md)

When \`[businessModelType:plg]\` OR free-trial signals are present:
- Hooks must call out "free trial", "free sign-up", or self-serve framing —
  not "get a demo", "book a call", "talk to sales".
- CTAs: "Start your free trial" / "Try it free" / "Sign up free". NOT "Get
  a lead", "Request a demo" (unless the product genuinely offers a demo as
  a PLG-assist motion).
- Body copy should emphasize product-led value ("inside the first 5 minutes
  you'll…") rather than sales-led value ("book a discovery call").

### conversionPath → CTA Template (v3 onboarding §1)

When \`[conversionPath:X]\` is in context, pick the CTA family that matches
the user's stated conversion path. This is a HARD routing — user-stated
truth overrides channel defaults:

| [conversionPath:X] | CTA family | Landing page archetype |
|---|---|---|
| free-trial | "Start Free Trial" / "Try it Free" / "Start Your Trial" | Product-first LP; no demo gate; credit card optional per offer. |
| freemium | "Sign Up Free" / "Get Started Free" / "Create Account" | Product-first LP; emphasizes unlimited-forever-free tier. |
| demo-required | "Book a Demo" / "Schedule a Call" / "Get a Demo" | Demo-first LP; calendar embed; qualification questions pre-demo. |
| direct-checkout | "Buy Now" / "Add to Cart" / "Checkout" | Price-first LP; urgency / scarcity / bundle stacking; no demo. |

Ad hooks must match the CTA family. A demo-required offer cannot ship a
"Start Free Trial" CTA just because the creative tested better — it breaks
the promise-to-landing-page chain and conversion craters.

### pricingModel → Messaging Frame (v3 onboarding §1)

When \`[pricingModel:X]\` is in context, anchor the dominant ad-copy frame
to the pricing archetype:

| [pricingModel:X] | Messaging frame | Example hook |
|---|---|---|
| subscription | ROI / ongoing value | "Save 12 hours/week for $49/mo" — predictable monthly ROI math. |
| usage-based | Flexibility / scale-with-you | "Only pay for what you use — start at $0/mo, scale as you grow." |
| per-seat | Team growth / seat economics | "Onboard your whole team for the cost of one tool they already pay for." |
| one-time-plus-subscription | Combo value — upfront payoff + ongoing leverage | "One-time setup pays for itself in 30 days, then every month after is pure margin." |

The frame is a PRIOR. A creative can still lead with a pain/social-proof
hook — but the body copy and offer presentation must reflect the pricing
frame. A subscription product shipping a "one-time purchase" frame
mis-sets buyer expectations.

### A/B Testing Plan
First tests should be highest-impact variables:
1. Hook/headline variation (same visual, 2–3 headline variants).
2. Format test (static vs. video if both available).
3. Angle test (PAS vs. social proof for same segment).

Methodology:
- Minimum budget per test variant from benchmarks.md.
- Split-test at ad level, not ad-set level, to avoid audience fragmentation.
- Run for minimum 7 days or 50 conversion events, whichever comes first.

### Refresh Cadence
- Under $2k/month: every 60 days or when CTR drops >50% from launch.
- $2k–$10k/month: every 30 days or on fatigue signals.
- Over $10k/month: every 14–21 days; pipeline running 2 weeks ahead.

Fatigue signals: CTR declining >20% week-over-week, Meta frequency >3,
cost-per-conversion increasing >25%.

### Anti-Hallucination Contract
Ad hooks must be grounded in research findings (competitor themes, ICP
pain points, offer strengths). Do NOT generate generic copy. Reference
ad-copy-templates.md for structure formulas. All benchmark numbers labeled
"(industry benchmark)".
`;
