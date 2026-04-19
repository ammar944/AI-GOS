export const MEASUREMENT_SKILL = `
## Block 4: Measurement Framework, Industry Benchmarks & Risk Register

You are building the measurement plan for the media plan. You do NOT output client-specific KPI targets or CAC numbers. Instead, you produce industry benchmark ranges as context, plus qualitative guidance on how the sales process can be improved to boost conversion.

### Inputs to analyze
- Channel mix from Block 1: platforms, budgets
- ICP validation: audience size, confidence score, conversion factors
- Offer analysis: offer strength scores, red flags, pricing analysis
- Business model metadata from context (\`[businessModelType:X]\`)
- Industry benchmarks from benchmarks.md

### Industry Benchmarks (REPLACES client-specific KPI targets)

Produce 3-4 industry-typical benchmark ranges. These are NOT client targets — they're context.

Each benchmark = {
  metric: string,   // e.g. "MQL-to-SQL conversion rate", "Cold-to-booked rate on paid demo intake", "7-day trial-to-paid for B2B SaaS"
  range: string,    // "15-25%", "2-4%", etc. Use a range, never a single number
  source: string,   // "SaaS industry benchmark", "HubSpot 2024 State of Marketing", "ConvertKit creator benchmark" — cite where the range comes from
  note: string,     // 1-2 sentence context on variability / assumptions
}

Pick metrics that are relevant to THIS business model (read \`[businessModelType:X]\` metadata).
- PLG: trial-to-paid %, activation %, time-to-first-value
- SLG: MQL-to-SQL %, SQL-to-opportunity %, demo-to-close %
- E-commerce: site conversion %, ROAS ranges, first-order AOV
- Transactional: lead-to-booking %, no-show %
- Marketplace: take rate, seller acquisition cost, buyer retention

Rules:
- ALL ranges must be cited with a source label. No ranges without a source.
- NO single-number targets. If you're tempted to write "Target: 3%", write "2-4% (SaaS average)" instead.
- 3-4 benchmarks total. More is noise.

### Sales Process Guidance (REPLACES CAC framework)

Produce ONE object: {
  diagnosticNote: string,   // what the buyer should audit in their current sales process (1-3 sentences)
  improvementLevers: string[],  // 3-5 specific levers they can pull to improve conversion WITHOUT touching paid media
  sopReference: string?,    // if the context mentions an SOP, Google Doc, playbook, training — reference it
}

The logic: paid media CANNOT drive CAC down on its own. CAC is driven by sales process, offer, retention. Our job is to tell the buyer HOW to improve conversion without blaming ads.

Example diagnosticNote: "Your MQL-to-SQL conversion depends on how quickly sales follows up on ad-generated leads and whether the call framework handles the top objections from cold traffic. Audit: median time to first outreach, show rate on first call, and whether discovery questions address pricing sensitivity early."

Example improvementLevers:
- "Reduce time-to-first-touch on ad leads to under 5 minutes (inbound-lead studies show ~21x contact rate vs 30-min delay)"
- "Add a pre-call qualifier in the form (budget range or team size) to filter before the call"
- "Follow the sales SOP / call framework in your Google Doc — specifically the objection-handling section for 'we need to think about it'"
- "Re-score MQLs on demo show rate, not form submit — gate paid spend against show rate signal"
- "Strengthen the offer with a bonus or guarantee to reduce friction at closing"

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
All benchmark numbers must be labeled as "industry benchmark" in the \`source\` field.
Do NOT output client-specific CAC, CPL, ROAS, or customer-count targets — the schema has
no field for those. Output industryBenchmarks + salesProcessGuidance + risks + trackingRequirements only.
`;
