---
name: sales-cycle-bounding
version: 1.0.0
category: media-plan
domain: strategy
description: Hard rule for bounding the sales cycle estimate by the offer structure. A seven-day free trial cannot produce a six-week sales cycle. A one-call close cannot produce a 30-day cycle. Fixes the class of error where research "findings" contradict the offer physics.
triggers:
  - sales cycle estimation
  - CAC model
  - rollout roadmap phase duration
  - measurement windows
---

# Sales Cycle Bounding

## Purpose

Sales cycle length is bounded by the offer structure, not by research signals. A 7-day free trial mechanically caps the decision window at ~10 days (7 days + 2–3 day buffer). A one-call close mechanically caps it at one sales call (often same-day to a week). An enterprise committee deal with procurement mechanically floors at 60+ days.

The runner's job is to detect the offer ceiling from the identity card and respect it — regardless of what research "findings" say. Research can under-report the speed of low-friction offers (nobody documents "I tried it and bought it in 15 minutes") but never over-reports the speed of high-friction ones.

## Frameworks Applied

- **Offer physics** — physical/procedural ceiling imposed by the offer structure
- **Hormozi Value Equation** — time delay is a cost; the offer structure sets the floor
- **Sales stage hygiene** — every stage has a minimum clock time (e.g. a demo requires scheduling + holding + follow-up)

## Offer Ceiling Table

| Offer Structure | Ceiling | Typical Range | Notes |
|---|---|---|---|
| Self-serve no trial (pay-per-use, instant purchase) | 1 hour | 0–1 day | E-commerce, app store apps, LSA-booked services |
| One-call close (low-ticket service or consult) | 7 days | 1–7 days | Local services, coaching, agency retainers ≤£2k |
| Free trial N days (self-serve signup) | N + 3 days | Same as trial + minor buffer | PLG SaaS, most freemium products |
| Freemium (no trial end) | 30 days | 7–30 days | Activation-to-paid window, typically first month |
| Demo-required, self-serve purchase | 14–30 days | 7–30 days | Mid-market SaaS without sales-team close |
| Demo-required, sales-team close (single decision-maker) | 30–45 days | 14–45 days | SaaS £5k–£25k ACV |
| Committee decision (3–5 stakeholders) | 60–90 days | 30–90 days | Mid-market enterprise SaaS £25k–£100k ACV |
| Enterprise + procurement | 120–180 days | 60–180 days | Enterprise SaaS £100k+ ACV, net-new category |
| Public sector / regulated | 180–365 days | 120–365 days | Government, healthcare, finance with compliance review |

## Rules

1. Read `identityCard.offerStructure` (free text) + `identityCard.closeType` + pricing. Classify the offer into one of the rows above.
2. Use the ceiling as the HARD UPPER BOUND. Never publish a sales cycle longer than the ceiling.
3. Use the typical range as the default unless research provides a specific override.
4. If the identity card says "7-day free trial + sales team closes" — that's a hybrid. Take the lower of the two ceilings (7-day free trial caps at 10 days; sales team within that window means 1-call close). Output: ≤7 days.
5. If research suggests a cycle LONGER than the ceiling, trust the ceiling. Flag the research signal as anomalous in a warning.
6. If research suggests a cycle SHORTER than the typical range, trust the research (low-friction offers are under-reported).

## Examples

### Example 1: Choros.io
- Offer: £19.99/mo self-serve + 7-day free trial + sales team closes on a call
- Ceiling: 10 days (trial + buffer)
- Research said: "3–6 week sales cycle"
- Correct output: "≤7 days (bounded by free trial length). Research signal of 3–6 weeks is anomalous and likely reflects customers who signed up without converting to paid — these are activation failures, not sales cycle length."

### Example 2: Mid-market B2B SaaS
- Offer: £30k ACV, demo required, 3-person buying committee
- Ceiling: 90 days
- Research said: "30-day typical close"
- Correct output: "30–60 day typical, up to 90 days. Use 60-day measurement windows for lead-to-customer attribution."

### Example 3: Local plumber
- Offer: Emergency call-out or scheduled service booking
- Ceiling: 1 day (one-call close)
- Research said: "Same-day decision for emergencies"
- Correct output: "Same-day to 48 hours. Measurement window: 3 days maximum."

## Downstream Effects

The sales cycle ceiling determines:

- **Rollout roadmap phase durations** — phase 1 "soft launch" cannot be 4 weeks if the sales cycle is 7 days. The phase is 1–2 weeks.
- **Measurement windows** — attribution windows must match the cycle. 7-day cycle → 7-day attribution window, not 90.
- **Ramp-up weeks** — `budgetSummary.rampUpWeeks` on Block 1 cannot exceed the cycle.
- **Go/no-go criteria** — "after 14 days and 100 conversions" fails if the cycle is 7 days and the budget only supports 30 conversions per cycle.

## Output Guidance

When stating a sales cycle estimate, always cite the ceiling source: "Based on 7-day free trial + one-call close, sales cycle is bounded at ≤7 days." This makes the reasoning auditable and catches research/offer mismatches early.

If there is a research-offer mismatch, output a warning in the plan's `validationWarnings` array: `"Research signal of X-week sales cycle conflicts with offer structure ceiling of Y days; using offer ceiling."`
