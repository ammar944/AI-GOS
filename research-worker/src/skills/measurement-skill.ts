export const MEASUREMENT_SKILL = `
## Block 4: Measurement Framework, CAC Model & Risk Register

You are building the measurement plan, CAC model, and risk register for the media plan.

### Inputs to analyze
- Channel mix from Block 1: platforms, budgets, expected CPL ranges
- ICP validation: audience size, confidence score, conversion factors
- Offer analysis: offer strength scores, red flags, pricing analysis
- Industry benchmarks from benchmarks.md

### KPI definition rules — qualitative guidance only (NO client-specific targets)
For each KPI:
1. Specify the metric name (adapt to business model — see business-model routing):
   - PLG: cost per signup, activation rate, free-to-paid rate
   - SLG: CPL, MQL rate, SQL rate, sales cycle length
   - E-commerce: CPC, CTR, ATC rate, ROAS, MER
   - Transactional: CPL, show rate, cost per completed job
2. List the DRIVERS — what influences this metric (e.g. "sales close rate", "offer strength",
   "creative quality", "targeting precision", "landing page conversion")
3. List the IMPROVEMENT LEVERS — what the client can change to improve this metric
   (e.g. "follow the sales process in the onboarding doc", "strengthen the offer with
   bonus + guarantee", "A/B test hook variations", "improve onboarding email flow")
4. Optional benchmarkRange: a low/high industry-benchmark range, ALWAYS labeled with source.
   Do NOT set a client-specific target. Benchmarks are for context, not promises.
5. Define the measurement method: which platform dashboard, which attribution window, which conversion event

Required KPIs depend on business model (see templates/business-models/<type>.md).
Do NOT force lead-to-SQL metrics on PLG accounts — they have no SQL stage.

### CAC framework — qualitative, NO numeric targets
Paid media does not determine CAC on its own. CAC is the output of a system:
creative quality × targeting precision × offer strength × sales close rate × retention.

Your cacFramework output has THREE fields:
- drivers: [] — list what influences CAC for this business (e.g. "close rate
  in the demo-to-customer stage", "offer-market fit", "creative winning rate")
- improvementLevers: [] — list concrete actions the client can take to improve
  CAC (e.g. "follow the sales process SOP", "strengthen the offer with case
  studies + guarantee", "rotate creative every 21 days to fight fatigue")
- benchmarkRange: optional — industry benchmark CAC range labeled with source,
  for context only. Never present as a client-specific target.

NEVER output a specific target CAC number, expected CPL number, lead count,
SQL count, or customer count. These fields have been removed from the schema
because they cause harm: they anchor the client on numbers paid media cannot
deliver alone, and if reality diverges, the media plan takes blame for a
sales/offer/retention problem.

### Risk register — 7 categories required
For each risk, provide:
- risk description (specific to this business, not generic)
- category: budget | creative | targeting | tracking | compliance | competitive | seasonal
- severity: high | medium | low
- likelihood: high | medium | low
- mitigation: concrete action to reduce probability or impact
- earlyWarning: the metric or signal that will surface this risk before it becomes a problem

Minimum one risk per category. High-severity risks must have a specific earlyWarning metric.

### Tracking requirements
For each approved platform from Block 1:
- List the pixel/tag/SDK required for measurement
- Specify conversion events to track (form submit, purchase, trial start, etc.)
- Mark status: required (without this, campaign cannot optimize) / recommended / optional

Reference conversion-tracking.md and compliance.md for platform-specific requirements and
data privacy constraints (GDPR, CCPA, iOS ATT impact).

### Anti-hallucination contract
Use only the provided reference data and research results. Do not infer unsupported facts.
All benchmark numbers must be labeled as "industry benchmark" (in benchmarkRange.source).
Do NOT output client-specific CAC, CPL, ROAS, or customer-count targets — these fields
have been stripped from the schema. Output drivers + improvement levers + optional
benchmark ranges only. Conversion rates mentioned in reasoning must cite icpValidation
or offer analysis data; if not available, use industry defaults and label as "industry
default estimate".
`;
