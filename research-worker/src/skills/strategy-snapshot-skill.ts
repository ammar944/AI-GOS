export const STRATEGY_SNAPSHOT_SKILL = `
## Block 6: Strategy Snapshot (Executive Summary)

You are creating a concise executive summary extracted from the completed media plan blocks.

### Critical Constraint: SUMMARY ONLY
Do not introduce new analysis, new benchmarks, or new strategic recommendations.
Every data point in this block must have a traceable source in Blocks 1–5.
If a number cannot be directly traced to a prior block, do not include it.

### Inputs to Extract From
- Block 1 (channelMixBudget): \`budgetSummary.totalMonthly\`, the platform
  with highest percentage, \`rampUpWeeks\`, \`strategicFrame\`.
- Block 4 (measurementGuardrails): \`industryBenchmarks\` metric names,
  \`salesProcessGuidance.improvementLevers\`, the single \`risks\` entry if
  present.
- Block 5 (rolloutRoadmap): Phase 1 \`decisionGate\` as the time-to-first-results signal.
- All blocks: identify the top 3 priorities.

### Headline (max 20 words)
Single sentence that captures:
- The primary channel strategy ("Single-platform Meta launch" at < $5k; "Google Search + Meta" at $5k+).
- The core business objective ("driving B2B SaaS trial starts" — note PLG vocabulary).
- The scale level ("at $X,XXX/month").

Do NOT write a multi-platform headline when the plan is single-platform. The
snapshot must faithfully reflect Block 1's platform count, not aspirational
diversification.

### Top 3 Priorities (exactly 3)
Select from the highest-impact items across all blocks:

When the LTV:CAC viability gate FAILED in Block 4 (launchBlocker risk
present with category 'budget' and unit-economics framing):
- Priority 1 must name the unit-economics fix (ACV / retention / pricing),
  NOT "reduce CAC to $X". Cite Block 4's diagnostic note.

When the viability gate PASSED:
- Candidates: launchBlocker risks from Block 4, Phase 1 go/no-go from Block 5,
  offer red flags, top audience segments from Block 2.
- Each priority traces to a specific finding. Do not invent priorities.

For each priority: state it clearly + write rationale in 1–2 sentences
citing the source block.

### Budget Overview
Extract directly from Block 1:
- \`total\` — \`channelMixBudget.budgetSummary.totalMonthly\` (user-input number; safe to display).
- \`topPlatform\` — platform with highest \`monthlySpend\` percentage.
- \`timeToFirstResults\` — Block 5 Phase 1 duration + "for initial performance read" OR the Phase 1 \`decisionGate\` threshold ("$1,500 cumulative spend gate").

### Expected Signals (qualitative — NO numeric forecasts)

Numeric forecasts (leads/month, estimated CAC, expected ROAS) are NOT
allowed. Paid media cannot guarantee them — sales process, offer, and
retention all intervene.

- \`timeToFirstResults\` — string; may mirror budget-overview field.
- \`qualitativeOutcomes\` — what the client will SEE during/after the plan:
  - "Initial trial-start flow established on primary platform"
  - "Creative winners identified from first 3 angles"
  - "Trial-to-paid baseline established; sales-process levers visible in data"
  - "Funnel drop-offs become measurable, enabling sales-process tuning"
  - "Creative fatigue signals surfaced for refresh planning"

### PLG / Free-Trial Vocabulary
When upstream blocks use PLG vocabulary (trial starts, activated users),
this block MUST match. Do NOT revert to "leads" / "CPL" / "MQL" in the
snapshot even if the headline space feels tight.

### Anti-Hallucination Contract
All numbers in \`budgetOverview.total\` must be extracted verbatim from Block 1.
Headline must not make claims not supported by the research. This block
adds zero new analysis — it is a summary only. When the viability gate
failed in Block 4, the snapshot must reflect that in priorities and signals;
do not paper over with optimistic growth framing.
`;
