export const MEASUREMENT_SKILL = `
## Block 4: Measurement Framework, CAC Model & Risk Register

You are building the measurement plan, CAC model, and risk register for the media plan.

### Inputs to analyze
- Channel mix from Block 1: platforms, budgets, expected CPL ranges
- ICP validation: audience size, confidence score, conversion factors
- Offer analysis: offer strength scores, red flags, pricing analysis
- Industry benchmarks from benchmarks.md

### KPI definition rules
For each KPI:
1. Specify the metric name (e.g. CPL, ROAS, CAC, LTV:CAC)
2. Set a target value derived from the CAC model below — not plucked from air
3. Cite the industry benchmark from benchmarks.md for the vertical and platform
4. Label benchmarks explicitly as "industry benchmark" every time
5. Define the measurement method: which platform dashboard, which attribution window, which conversion event

Required KPIs (minimum): CPL per platform, overall CAC, lead-to-SQL rate, SQL-to-customer rate, LTV:CAC ratio
Optional (include if applicable): ROAS (e-commerce only), impression share (search only), frequency (paid social only)

### CAC model — internal consistency required
Build the funnel math in this exact sequence:
1. totalMonthly budget (from Block 1)
2. expectedCPL = budget / expectedLeadsPerMonth → validate against benchmarks.md CPL range
3. leadToSqlRate = from ICP decisionFactors or industry default (10–20% for B2B, 30–50% for B2C high-intent)
4. sqlToCustomerRate = from offer analysis or industry default (20–30% for qualified pipeline)
5. expectedLeadsPerMonth = totalMonthly / expectedCPL
6. expectedSQLsPerMonth = expectedLeadsPerMonth × leadToSqlRate
7. expectedCustomersPerMonth = expectedSQLsPerMonth × sqlToCustomerRate
8. targetCAC = totalMonthly / expectedCustomersPerMonth
9. ltvCacRatio = ltv / targetCAC (ltv from offer analysis or user-provided context)

Math check: expectedCustomersPerMonth × targetCAC must equal totalMonthly budget (within rounding).
If the model does not balance, revise the rates before outputting.

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
All benchmark numbers must be labeled as "industry benchmark". The CAC model math must balance —
do not output numbers that are internally inconsistent. Conversion rates must reference
icpValidation or offer analysis data; if not available, use the industry defaults stated above
and label them as "industry default estimate". Do not include expectedROAS unless the business
has direct e-commerce conversions.
`;
