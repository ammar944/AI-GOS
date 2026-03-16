export const STRATEGY_SNAPSHOT_SKILL = `
## Block 6: Strategy Snapshot (Executive Summary)

You are creating a concise executive summary extracted from the completed media plan blocks.

### Critical constraint: this is a SUMMARY ONLY
Do not introduce any new analysis, new benchmarks, or new strategic recommendations.
Every data point in this block must have a traceable source in Blocks 1–5.
If a number cannot be directly traced to a prior block, do not include it.

### Inputs to extract from
- Block 1 (channelMixBudget): totalMonthly, topPlatform (highest percentage platform), rampUpWeeks
- Block 4 (measurementGuardrails): CAC model (leadsPerMonth, estimatedCAC, ltvCacRatio), risk top-line
- Block 5 (rolloutRoadmap): first milestone as "timeToFirstResults"
- All blocks: identify the top 3 priorities

### Headline
Single sentence (max 20 words) that captures:
- The primary channel strategy ("Google Search + Meta retargeting")
- The core business objective ("driving B2B SaaS demo requests")
- The scale level ("at $X,XXX/month")

### Top 3 priorities
Select exactly 3 from the highest-impact items across all blocks:
- Candidates: launch-blocking risks from Block 4, Phase 1 go/no-go criteria from Block 5,
  offer red flags from offerAnalysis, or top audience segments from Block 2
- For each: state the priority clearly + write the rationale in 1–2 sentences citing the source block
- Do not invent priorities — each must be traceable to a specific finding

### Budget overview
Extract directly from Block 1:
- total: channelMixBudget.budgetSummary.totalMonthly
- topPlatform: the platform with highest monthlySpend percentage
- timeToFirstResults: Block 5 Phase 1 duration + "for initial performance read"

### Expected outcomes
Extract directly from Block 4 CAC model:
- leadsPerMonth: cacModel.expectedLeadsPerMonth
- estimatedCAC: cacModel.targetCAC
- expectedROAS: include ONLY if the business is direct e-commerce (not lead gen, not SaaS trials,
  not service businesses). If the business model does not have direct purchase conversions,
  omit expectedROAS entirely from the output — do not set it to 0 or "N/A", just exclude the field.

### Anti-hallucination contract
Use only the provided reference data and research results. Do not infer unsupported facts.
All numbers must be extracted verbatim from prior blocks — do not recalculate or adjust.
The headline must not make claims not supported by the research. expectedROAS must only appear
for direct e-commerce conversion models. This block adds zero new analysis.
`;
