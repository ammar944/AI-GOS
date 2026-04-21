---
name: ltv-cac-viability
version: 1.0.0
category: media-plan
domain: measurement
description: Viability gate for customer-acquisition-cost guidance. Applies Skok's 3× LTV:CAC rule as a hard refusal: if LTV:CAC < 3, the output MUST NOT contain a CAC target, a CPL target, or any paid-media-as-solution framing. Instead the output flags unit-economics-not-viable and redirects the buyer to sales-process, pricing, or retention fixes. Directly addresses Mahdy's "$600 CAC on $18/mo → 50-year payback" feedback on Choros.
triggers:
  - CAC target
  - CPL target
  - LTV CAC ratio
  - unit economics
  - measurement framework
canonical_source: Skok, David. "SaaS Metrics 2.0" — forEntrepreneurs.com
---

# LTV:CAC Viability Gate

## Purpose

Paid media is an **amplifier**, not a fix. It makes good unit economics run hotter and bad unit economics bleed faster. If LTV:CAC is below 3, no amount of paid-media optimization closes the gap — the fix lives in offer, sales process, pricing, or retention. Publishing a "target CAC" on a business with broken unit economics is malpractice: it gives the buyer a number to chase that, if hit, still loses money.

Mahdy's round-3 feedback caught this on Choros: "Product is 17$, if CAC is 600$ that means it's a 50 year payback period." A $600 CAC target on an $18/mo product implies an LTV that doesn't exist. The output shouldn't be "aim for $600 CAC" — it should be "unit economics not paid-media-viable until average contract value / retention fundamentally changes."

This methodology is the hard refusal.

## Frameworks Applied

- **David Skok — SaaS Metrics 2.0** (forEntrepreneurs.com). The 3× LTV:CAC rule: under 3, company is unprofitable per customer; 3–5 is healthy; >5 may indicate under-investment in growth. Canonical reference for SaaS unit economics. The 12-month CAC payback rule (payback months = CAC / (gross-margin-adjusted monthly revenue per customer)) is the secondary check — 12 months is the SMB ceiling.
- **Gary Halbert — "You can't out-creative bad math."** (Halbert letters archives, paraphrase). If the offer doesn't pencil out, better creative just loses money faster.
- **Mahdy Etemad — Round-3 feedback** (2026-04-21). "Why would it have leads? I thought it said it should be PLG and free trial." The PLG vocabulary rule in this methodology is paired with the viability gate — both are responses to the Choros leak.

## The 3× Rule (Hard Gate)

`LTV / CAC < 3` → **the plan does NOT ship a CAC or CPL target**. Instead:

1. The `industryBenchmarks` output does NOT include any CAC, CPL, or acquisition-cost metric.
2. The `salesProcessGuidance.diagnosticNote` opens with a unit-economics flag: "Current LTV:CAC implied by pricing ({priceSignal}) × retention ({retentionSignal}) does not support paid-acquisition math. Fix retention, pricing, or ACV before scaling paid."
3. The `salesProcessGuidance.improvementLevers` list contains process-side fixes that raise LTV, not paid-media fixes that chase a lower CAC.
4. The `risks[]` entry (capped at 1 per round-3 discipline) sets `launchBlocker: true` with category `budget` and an earlyWarning of "cumulative spend > $500 with zero paying customers."
5. Block 6 `headline` and `topPriorities` reflect the viability flag, not growth projections.

The gate is hard. If the output contains any numeric CAC target when LTV:CAC < 3, the fabrication-sweep will flag it (see `intelligence/fabrication-sweep.ts` patterns added 2026-04-21).

## How to Read LTV and CAC From Context

The worker does NOT have a stored LTV or CAC field. The gate is inferred from signals in the context string:

- **Price signals**: `offerAnalysis.pricingAnalysis.currentPricing`, identity-card offer type, any `[monthlyPrice:X]` metadata.
- **Retention signals**: identity-card `retentionModel`, sales-call transcripts mentioning churn, review data mentioning cancellation patterns.
- **Business-model signals**: `[businessModelType:X]` — PLG low-ticket products have structurally low LTV unless there's an expansion motion (ACV growth via usage-based pricing or seat expansion).

Estimation rules (conservative, err toward the "not viable" side):

- **Low-ticket PLG** (< $30/mo, no expansion signal): assume LTV ≈ 12–18× monthly price (12–18-month avg retention). Example: $18/mo × 15 = $270 LTV.
- **Mid-ticket PLG / SLG** ($50–$300/mo, some expansion): LTV ≈ 24–36× monthly price.
- **High-ticket SLG / annual contracts**: LTV ≈ ACV × 2–3 (most SaaS contracts renew at least once at similar-or-higher value).
- **E-commerce**: LTV ≈ first-order AOV × 2 (the average second-order rate in SMB e-com is low without CRM work).
- **Transactional / one-shot**: LTV ≈ AOV (no recurring revenue; do not inflate).

CAC viability proxy: the cheapest SMB acquisition channel (Google Search branded + Meta retargeting) typically runs $75–$250 CAC for digital products under $100/mo. If the implied LTV is below $500-$750, the 3× gate will likely fail.

## The Mahdy Example Walkthrough

Input: Choros product at $17/mo, PLG free-trial, no expansion signal.

- Implied LTV: $17 × 15 = $255.
- 3× rule → CAC ceiling: $255 / 3 = $85.
- Realistic paid CAC for a new-brand B2B SaaS at $3k/mo spend: $200-$500+ in first 60 days.
- Verdict: unit economics NOT paid-media-viable at current pricing.

The plan for Choros should not have shipped a $600 CAC target. It should have shipped:

1. Risk flag: `launchBlocker: true, category: 'budget', risk: "LTV:CAC < 3 implies cumulative paid spend will outpace customer revenue for 2+ years."`
2. Sales-process guidance: "Paid media cannot reach the $85 CAC implied by $17 × 15-month LTV. Before scaling paid, raise ACV (team plan, usage-based tier) or retention (reduce 12-month churn). Expect $200-$500 CAC from paid alone — treat the $3k test as a product-market-message diagnostic, not a growth program."
3. Benchmark output (per `benchmark-selection.md`): Halbert's first-customer test ONLY. No trial-to-paid benchmark at this stage — the question isn't "are we optimizing trial-to-paid," it's "does anyone pay at all."

## PLG / Free-Trial Vocabulary Rule

When `[businessModelType:plg]` is present in context OR the offer is a free trial / freemium / self-serve sign-up, the output MUST NOT use:

- "leads" (use "free sign-ups" or "trial starts")
- "CPL" (use "cost per trial start" or "cost per activated user")
- "MQL" / "SQL" (use "trial user" / "activated user" / "paid conversion")
- "lead-gen" (use "trial-acquisition" or "sign-up volume")
- "SLG" framing when the offer is self-serve

Rationale: Mahdy's round-3 catch: "I thought it said it should be PLG and free trial earlier and not SLG." The system had classified Choros correctly upstream (PLG free-trial) but reverted to sales-qualified-lead vocabulary in the media plan. The two vocabularies imply radically different funnel designs and measurement plans.

The fabrication-sweep flags PLG + lead-vocabulary leaks.

## Decision Rules

1. Read price signals from `offerAnalysis.pricingAnalysis.currentPricing` + any pricing hints in the identity card.
2. Read `[businessModelType:X]` from context metadata.
3. Compute implied LTV using the estimation rules above. Use conservative estimates.
4. Compare to realistic CAC range for the business model (SaaS SMB: $200–$500; e-com SMB: $30–$80; SLG mid-ticket: $500–$1500).
5. If `impliedLTV / realisticCAC < 3` → viability-gate FAIL.
6. On FAIL: apply the hard-refusal rules (no CAC target, unit-economics-flag guidance, launch-blocker risk, sales-process-first narrative).
7. On PASS: ship CAC range ONLY as a benchmark with interpretation + leversToMoveIt per `benchmark-selection.md`. NEVER as a "target CAC."
8. If context contains `[businessModelType:plg]` OR free-trial signals: apply the vocabulary rule regardless of viability outcome.

## Forbidden Moves

- Shipping a numeric CAC or CPL target when LTV:CAC < 3.
- Using "target CAC," "goal CAC," "CAC objective" language anywhere in the output. Benchmarks are ranges, never targets.
- Recommending "optimize CAC downward" as a lever when the real fix is ACV or retention. Paid-media levers do NOT solve unit-economics failure.
- Using "leads" vocabulary on a PLG free-trial offer regardless of viability.
- Adding a CAC row to `industryBenchmarks[]` just because the benchmarks.md ref file contains one. Benchmark selection is gated by this methodology — if it fails here, drop the row.

## Output Guidance

- **Block 4 `industryBenchmarks[]`**: zero CAC/CPL entries under viability FAIL. Under viability PASS, at most ONE CAC range with `interpretation` naming Skok's 3× rule and `leversToMoveIt` being process-side (pricing, retention, ACV expansion).
- **Block 4 `salesProcessGuidance.diagnosticNote`**: opens with unit-economics statement when FAIL.
- **Block 4 `risks`**: the single allowed risk entry is the LTV:CAC launch-blocker when FAIL.
- **Block 6 `topPriorities`**: one priority names the unit-economics fix when FAIL. Do not list "reduce CAC to $X" as a priority.
- **PLG vocabulary**: applied across all 6 blocks whenever the business model signal is PLG/free-trial.

## Why This Exists

The Choros plan shipped a $600 CAC target against a $17/mo product. The fabrication-sweep at the time caught scale-to-ARR patterns but did not catch implausible CAC/LTV combinations. This methodology + the companion fabrication-sweep patterns added 2026-04-21 close that leak.
