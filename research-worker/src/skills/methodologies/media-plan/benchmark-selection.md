---
name: benchmark-selection
version: 1.0.0
category: media-plan
domain: measurement
description: Decision framework for choosing industry benchmarks that match the business model AND the budget stage. Replaces the generic "dump 3-4 KPI ranges" pattern Mahdy flagged as confusing ("No clue what this means"). At sub-$3k spend the only benchmark that matters is Halbert's first-dollar test. At $3k-$10k use 1-2 model-specific Skok/Haynes metrics. At $10k+ use the full benchmark table. Every benchmark MUST ship with an `interpretation` line and 2 `leversToMoveIt` actions — without those the number is noise.
triggers:
  - measurement framework
  - industry benchmarks
  - KPI selection
  - media plan block 4
canonical_source: src/skills/refs/benchmarks.md
---

# Benchmark Selection

## Purpose

Benchmarks are context, not targets. Mahdy's round-3 feedback ("Not sure how any of these work," "No clue what this means") was a direct response to bare ranges like "15-25% MQL-to-SQL" dumped without interpretation. An SMB buyer reading that output cannot tell whether their 12% is a crisis or a quiet win, nor what to do about it.

This methodology forces three discipline checks:

1. **Budget-stage gate**: the relevant benchmark at $3k total spend is not the same benchmark that's relevant at $30k. Pick the one that matches the scale.
2. **Model-fit gate**: a PLG free-trial product cares about trial-to-paid and activation, not MQL-to-SQL. Pick benchmarks that match the business model.
3. **Actionability gate**: every benchmark ships with an `interpretation` ("at your stage, the right read is…") and `leversToMoveIt` (two process-side actions, NOT paid-media targets). Without those, the number is noise and should be dropped entirely.

## Frameworks Applied

- **Gary Halbert — "First Dollar Test"**. Direct-response dictum: for a tight-budget test, the only benchmark worth tracking is whether one paid customer can be acquired inside the budget window. See Halbert letters (1984–1989 archives). The logic: paid media at sub-$3k can only prove or disprove product-market-message fit. Multi-stage funnel benchmarks at that spend are a distraction.
- **David Skok — "SaaS Benchmarks"** (forEntrepreneurs.com). The 3× LTV:CAC rule, magic number, CAC payback months. Canonical for SaaS at $5k+/mo. Do not fabricate Skok numbers — if the research context doesn't surface specific Skok figures, reference the framework but range the number from `src/skills/refs/benchmarks.md`.
- **Jeremy Haynes — In-Market Conversion Rates**. Per `in-market-tier-routing.md`. In-market (3-4% of audience) has a reliable inbound-lead conversion range that differs from needs-convinced and cold-mass.
- **Chet Holmes — 3% Rule**. Already referenced in `awareness-level-routing.md`. Used here to gate benchmark selection when the awareness level is unaware (see forbidden moves below).

## Budget-Gated Benchmark Table (LOAD-BEARING)

| Monthly budget | Benchmark count | Which benchmarks | Why |
|---|---|---|---|
| Under $3k | **1** | Halbert's first-customer test: "Can you acquire ONE paying customer for <50% of budget inside 30 days?" | Everything else is noise at this spend. Sub-$3k is pure PMF/message-fit diagnostic. |
| $3k–$10k | **1–2** | 1 business-model-native metric (trial-to-paid for PLG, MQL-to-SQL for SLG, site CR for e-com, lead-to-booking for transactional, take rate for marketplace) + optional CAC payback months (Skok) | Enough signal exists to read the funnel but too little to track 4 ranges meaningfully. |
| $10k–$30k | **2** | Business-model native + LTV:CAC (Skok 3× rule) | Spend supports multiple phases; benchmarks on both efficiency and unit economics. |
| $30k+ | **2** | Full Skok SaaS-magic-number style pair OR Haynes in-market conversion pair | Enough volume to segment by tier and read per-cohort benchmarks. |

The ceiling is `.max(2)` — NEVER more. Mahdy's round-3 threshold: the output "lost a lot of value, long + messy." Keeping the ceiling at 2 forces picking the right ones.

## Required Fields Per Benchmark

Every entry emitted into `measurementGuardrails.industryBenchmarks[]` must carry:

- `metric` — name of the metric (e.g., "Trial-to-paid conversion rate (7-day window)").
- `range` — range with units (e.g., "15-25%", "$80-$120 per trial start"). Never a single number.
- `source` — citation label. Valid: "Skok SaaS benchmark", "HubSpot 2024 State of Marketing", "Haynes in-market conversion rate", "Shopify SMB benchmark". Invalid: "industry average" alone (too vague), "standard" (not a source).
- `interpretation` — one sentence: "at your stage, the right read is…". Must name the stage (pre-PMF / post-PMF-scaling / optimization).
- `leversToMoveIt` — exactly 2 strings. Process-side levers only. NEVER "increase ad budget" or "shift platform allocation" (those are paid-media decisions — benchmarks do not instruct paid media).

Example (good):

```
metric: "Trial-to-paid conversion rate (14-day window)"
range: "12-20%"
source: "Skok SaaS benchmark (low-ticket PLG)"
interpretation: "At <$3k spend, you're pre-PMF-validation — the read is whether ANY trial converts, not whether you hit the range."
leversToMoveIt:
  - "Pre-qualify sign-ups with a single billing-question field before trial starts"
  - "Send a day-3 activation email from the founder's address with a 15-min onboarding Zoom link"
```

Example (bad — would be stripped by the validator):

```
metric: "MQL-to-SQL conversion rate"
range: "15-25%"
source: "Industry benchmark"
note: "Varies by industry."
```

Why bad: source is vague, no `interpretation`, no `leversToMoveIt`, and the metric is irrelevant to a PLG free-trial product.

## Model-Fit Decision Tree

Read `[businessModelType:X]` from the context metadata. Pick benchmarks from the model-native set first:

- **PLG** — trial-to-paid %, activation %, time-to-first-value (TTFV), free-to-paid upgrade rate
- **SLG** — MQL-to-SQL %, SQL-to-opportunity %, demo-to-close %, sales-cycle length in days
- **E-commerce** — site conversion %, first-order AOV, repeat purchase rate (30-day), CAC payback by order count
- **Transactional / local** — lead-to-booking %, no-show %, cost per booked appointment
- **Marketplace** — take rate, seller acquisition cost, 30-day buyer retention

If `[businessModelType:unknown]` (identity resolver low confidence): ship Halbert's first-customer test ONLY. Do not guess model-native metrics — a wrong benchmark is worse than no benchmark.

## Forbidden Moves

- `.length > 2`. Cap is hard at 2. Third entry should be deleted, not noted.
- Generic sources ("industry average," "standard benchmark"). Name the framework or drop the entry.
- Missing `interpretation`. An uninterpreted benchmark is noise — if you can't interpret it for this client's stage, you don't have the grounding to ship it.
- `leversToMoveIt` containing paid-media actions ("increase budget," "shift to Google," "test Meta Advantage+"). These are NOT benchmark levers — they belong in Blocks 1/3. Benchmark levers are process-side only.
- Using Mahdy's PLG example ($18/mo product + $600 CAC) language. If LTV:CAC < 3, the CAC benchmark must be replaced with Skok's "unit economics broken" flag per `ltv-cac-viability.md`.
- Ranges without units. "15-25" is not a range; "15-25%" is.
- Citing benchmarks for competitors Mahdy flagged as generic-fabrications (e.g., "too complicated for Aura/Lovable"). If the source is research-grounded, cite the source; if not, drop it.

## Decision Rules

1. Read `budgetSummary.totalMonthly` from the draft Block 1 output.
2. Read `[businessModelType:X]` from context metadata. If absent, default to `unknown` and ship Halbert only.
3. Select the budget-gate row from the table above.
4. For the picked benchmark count, pick the model-native metric(s) (see model-fit tree).
5. For each benchmark, write the 4 required fields (metric, range, source, interpretation) + exactly 2 `leversToMoveIt`.
6. If the awareness level is `unaware` (per `awareness-level-routing.md`), prefer Halbert's first-customer test over model-native metrics regardless of budget — unaware markets cannot be read against MQL/SQL benchmarks because the funnel hasn't formed yet.

## Output Guidance

- Block 4 (`measurementGuardrails.industryBenchmarks[]`) is the structured output of this methodology.
- Block 5 (rollout) references the benchmarks by `metric` name in go/no-go criteria. Benchmarks must be named, not paraphrased.
- Block 6 (snapshot) may mention at most 1 benchmark in the top-3 priorities — prioritize the one that has the highest leverage for the smallest intervention.

## Why This Exists

The output Mahdy reviewed for Choros displayed a 4-row benchmark table that read (paraphrased): "MQL-to-SQL: 15-25%. Demo-to-close: 20-30%. CPL: $50-150. CAC: $400-800." Four ranges, no interpretation, no action. Mahdy: "Not sure how any of these work." Correct response. The fix isn't to delete benchmarks — it's to ship fewer, better-chosen, interpretation-anchored ones.
