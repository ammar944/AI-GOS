export const MEASUREMENT_SKILL = `
## Block 4: Measurement Framework, Industry Benchmarks & Risk Register

You are building the measurement plan. You do NOT output client-specific KPI
targets or CAC numbers. Instead, you produce **at most 2** industry benchmark
ranges — each with an interpretation and exactly 2 process-side levers —
plus qualitative sales-process guidance and (at most) ONE launch-blocker
risk.

### Inputs to Analyze
- Channel mix from Block 1: platforms, budgets, \`strategicFrame\`.
- ICP validation: audience size, confidence, conversion factors.
- Offer analysis: offer strength, red flags, pricing.
- Business model metadata: \`[businessModelType:X]\`.
- Avg contract value band: \`[avgAcv:X]\` from onboarding §1.
- benchmarks.md reference ranges.

### LTV:CAC Viability Gate (HARD — see ltv-cac-viability.md)

**Before writing any benchmark**: apply the 3× rule.

Estimate implied LTV from:
- Price signals (\`offerAnalysis.pricingAnalysis.currentPricing\`, identity card pricing).
- Retention signals (business model — PLG low-ticket ≈ 12–18× monthly price).
- Business model (\`[businessModelType:X]\`).

Compare implied LTV to realistic CAC for the model (SaaS SMB: $200–$500;
e-com SMB: $30–$80).

**avgAcv tier routing (v3 onboarding §1 — use when \`[avgAcv:X]\` is present in context):**

| [avgAcv:X] | Realistic CAC ceiling | Notes |
|---|---|---|
| under-1k | $50–$150 | SMB self-serve; CAC above $150 usually fails unit econ unless LTV is unusually high. |
| 1k-10k | $200–$800 | SMB / mid-market SaaS; the default SaaS-SMB range. |
| 10k-50k | $1,000–$5,000 | Mid-enterprise; demo-gated sales cycles justify higher CAC. |
| 50k-plus | $5,000+ | Enterprise; CAC can run $5K–$50K when ACV supports it. |

Prefer the avgAcv tier CAC ceiling over the default SaaS SMB/e-com ranges
when the tag is present — it reflects the user's stated ACV rather than an
inferred SMB default. Use the default ranges only when \`[avgAcv:X]\` is
missing or \`unknown\`.

If \`impliedLTV / realisticCAC < 3\`, unit economics
are NOT paid-media viable. In that case:

1. \`industryBenchmarks[]\` must NOT contain any CAC, CPL, or acquisition-
   cost metric. Ship ONLY Halbert's first-customer test benchmark.
2. \`salesProcessGuidance.diagnosticNote\` opens with a unit-economics flag:
   "Current LTV:CAC implied by pricing × retention does not support paid
   acquisition math. Fix retention, pricing, or ACV before scaling paid."
3. \`risks[]\` contains ONE entry with \`launchBlocker: true\`, category
   'budget', and an early warning like "cumulative spend > $500 with zero
   paying customers."

### Industry Benchmarks (MAX 2 — see benchmark-selection.md)

Pick by budget tier:

| Monthly budget | Benchmark count | Which |
|---|---|---|
| Under $3k | 1 | Halbert's first-customer test only |
| $3k–$10k | 1–2 | Business-model native metric + optional CAC payback (Skok) |
| $10k–$30k | 2 | Business-model native + LTV:CAC (Skok 3× rule) |
| $30k+ | 2 | Skok SaaS-magic-number pair OR Haynes in-market conversion pair |

Each benchmark MUST contain:
- \`metric\` — precise metric name (e.g., "Trial-to-paid conversion rate (14-day window)").
- \`range\` — with units (e.g., "12-20%", "$80–$120 per trial start"). NEVER a single number.
- \`source\` — named framework (e.g., "Skok SaaS benchmark", "Haynes in-market conversion rate", "HubSpot 2024 State of Marketing"). NEVER "industry average" alone.
- \`interpretation\` — one sentence naming the stage (pre-PMF / post-PMF-scaling / optimization) and the right read at that stage.
- \`leversToMoveIt\` — EXACTLY 2 process-side levers. Pricing, retention,
  sales-process, onboarding. NEVER paid-media actions ("increase budget",
  "shift platform"). The validator rejects paid-media levers.

Model-native metrics:
- PLG: trial-to-paid %, activation %, time-to-first-value.
- SLG: MQL-to-SQL %, SQL-to-opportunity %, demo-to-close %, sales-cycle length.
- E-com: site CR %, first-order AOV, 30-day repeat purchase rate.
- Transactional / local: lead-to-booking %, no-show %, cost per booked appointment.
- Marketplace: take rate, seller acquisition cost, 30-day buyer retention.

### Sales Process Guidance (REPLACES CAC framework)

One object with:
- \`diagnosticNote\` — 1–3 sentences. What to audit in the current sales
  process. Names median time to first outreach, show rate, qualification rigor.
- \`improvementLevers\` — 3–5 specific levers. ALL process-side (not paid
  media). Examples: "Reduce time-to-first-touch to <5 min", "Add a pre-call
  budget qualifier", "Re-score MQLs on demo show rate".
- \`sopReference\` (optional) — if the context mentions an SOP / Google Doc /
  playbook / training, reference it.

Rationale: paid media CANNOT drive CAC down on its own. CAC is driven by
sales process, offer, retention. This block tells the buyer HOW to improve
conversion without blaming ads.

### PLG / Free-Trial Vocabulary (see ltv-cac-viability.md)

When \`[businessModelType:plg]\` OR free-trial signals present:
- NEVER use "leads", "CPL", "MQL", "SQL", "lead-gen".
- USE "free sign-ups", "trial starts", "activated users", "paid conversion".
- \`diagnosticNote\` and \`improvementLevers\` must be trial-acquisition-
  framed, not lead-gen-framed.

### Risks — AT MOST 1 (Mahdy round 3: "keep 1 max")

The single allowed risk MUST have \`launchBlocker: true\` (schema-enforced
literal). Non-launch-blocker risks are dropped — the list is for the ONE
thing that could kill the plan, not hypotheticals.

If no genuine launch-blocker exists, emit an empty \`risks: []\`. That's a
valid output — it means the plan is launch-clear.

Required fields per risk:
- \`risk\` — specific to this business, not generic. Name the mechanism.
- \`category\` — budget / creative / targeting / tracking / compliance / competitive / seasonal.
- \`severity\` — high (launch-blockers are typically high).
- \`likelihood\` — high / medium / low based on evidence.
- \`mitigation\` — concrete action to reduce probability or impact.
- \`earlyWarning\` — the metric or signal that will surface this before it becomes a problem.
- \`launchBlocker\` — must be \`true\`.

### Tracking Requirements
For each approved platform from Block 1:
- Pixel/tag/SDK required for measurement.
- Conversion events to track (form submit, purchase, trial start).
- Status: required / recommended / optional.

Reference conversion-tracking.md and compliance.md.

### Anti-Hallucination Contract
Benchmarks cite named frameworks only (Skok, Haynes, Halbert, HubSpot,
Shopify). Generic "industry average" sources fail validation. Process-side
levers only — paid-media levers in \`leversToMoveIt\` are flagged by the
validator. On PLG/free-trial, use trial vocabulary across all prose fields.
`;
