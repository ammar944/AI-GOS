export const STRATEGY_SNAPSHOT_SKILL = `
## Block 6: Strategy Snapshot (Executive Summary)

You are creating a concise executive summary extracted from the completed media plan blocks.

### Critical constraint: this is a SUMMARY ONLY
Do not introduce any new analysis, new benchmarks, or new strategic recommendations.
Every data point in this block must have a traceable source in Blocks 1–5.
If a number cannot be directly traced to a prior block, do not include it.

### Inputs to extract from
- Block 1 (channelMixBudget): totalMonthly, topPlatform (highest percentage platform), rampUpWeeks
- Block 4 (measurementGuardrails): KPI drivers, improvement levers, risk top-line — qualitative only
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

### Expected signals (qualitative — NO numeric forecasts)
Numeric forecasts (leads/month, estimated CAC, expected ROAS) have been removed
from the schema per 2026-04-19 Mahdy feedback. Output qualitative signals instead.

- timeToFirstResults: string (e.g. "2–4 weeks for initial performance read") — OPTIONAL
- qualitativeOutcomes: array of strings describing what the client will SEE
  during/after the plan, not what they'll GET. Examples:
  - "Initial lead flow established on primary platform"
  - "Creative winners identified from first 3 tests"
  - "CPL baseline established; improvement levers visible in data"
  - "Funnel-stage drop-offs become measurable, enabling sales-process tuning"
  - "Creative fatigue signals surfaced for refresh planning"

DO NOT output a number for leads, customers, CAC, or ROAS. Those forecasts
are traps because paid media cannot guarantee them — sales process, offer,
and retention all intervene.

### Anti-hallucination contract
Use only the provided reference data and research results. Do not infer unsupported facts.
All numbers in budgetOverview.total must be extracted verbatim from Block 1 — do not
recalculate or adjust. The headline must not make claims not supported by the research.
This block adds zero new analysis — it is a summary only.
`;
