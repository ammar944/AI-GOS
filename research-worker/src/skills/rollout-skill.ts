export const ROLLOUT_SKILL = `
## Block 5: Rollout Roadmap & Phased Launch Plan

You are designing the phased launch sequence and 90-day roadmap.

### Awareness-Gated Platform Phasing (HARD RULE)

Read \`[awarenessLevel:X]\` metadata from the context.

If awarenessLevel is 'unaware' or 'problem-aware':
- Google Search and Performance Max CANNOT appear in Phase 1. Unaware
  audiences aren't searching yet.
- Phase 1 should prioritize Meta / YouTube (education-led creative). TikTok
  only if surfaced in upstream research per channel-grounding.md.
- Google can appear in Phase 2+ once Meta testing has built brand recall.

If awarenessLevel is 'solution-aware', 'product-aware', or 'most-aware':
- Google Search may lead Phase 1.

### Inputs to Analyze
- Channel mix from Block 1: platforms, totalMonthly, rampUpWeeks, daily ceilings, \`strategicFrame\`.
- Block 2: audience segments and campaign structure.
- Block 3: creative angles, testing plan, refresh cadence.
- Block 4: industry benchmarks (by \`metric\` name), sales process guidance, risks.
- Offer analysis: launchBlocker red flags must be resolved before Phase 1.

### Phase Design Rules

Design 3–4 phases. Typical structure:

1. **Foundation (weeks 1–2)**: Infrastructure, pixel, primary platform soft launch at 50% budget.
2. **Scaling (weeks 3–6)**: Full primary budget, first creative test results.
3. **Optimization (weeks 7–10)**: Pause underperformers, scale winners, (if $5k+) add secondary platform.
4. **Expansion (month 3+)**: Lookalike expansion, creative refresh cycle running.

Adjust based on:
- Budget size: smaller budgets take longer to accumulate data → extend each phase.
- Offer readiness: launchBlocker red flags require a pre-launch remediation phase.
- Sales cycle: if > 60 days, extend measurement windows before scaling.

### Decision Gate (REQUIRED per phase)

Each phase MUST have a \`decisionGate\` string — the single observable
signal that triggers moving to the next phase. Haynes' weekly-decision-
cadence principle.

Example (good):
"Phase 1 → Phase 2 when cumulative spend ≥ $1,500 AND ≥1 paying customer,
OR stop-loss triggered at $1,500 cumulative with zero paying customers."

Decision gates must name:
- An observable platform signal (CTR ≥ platform median, frequency ≤ 2.5, cumulative-spend threshold).
- A time condition (after N days) OR a data-sufficiency condition (after N conversions).
- A go/no-go outcome ("if yes, advance; if no, stop-loss and diagnose").

NEVER use vague criteria like "performance is satisfactory". NEVER output a
client-specific CPL / CAC / ROAS threshold in the gate.

### Phase Budget Allocation (OPTIONAL at small budget)

\`phases[].budgetAllocation\` is now OPTIONAL (round 3 change).

- **Under $5k monthly**: OMIT \`budgetAllocation\` for phase 1 (and ideally
  all phases). The $ bar visual is degenerate at small budgets — the
  renderer suppresses the chart when the field is absent and shows
  activities + decisionGate instead. Do NOT emit a number just because the
  schema accepts one.
- **$5k+ monthly**: emit \`budgetAllocation\` for phase 2+ where the number
  has meaning. Phase 1 can still omit it (soft-launch is better described
  by activities than by a $ bar).

When emitted, phase budget math must be consistent with Block 1 ramp-up:
- Phase 1 budget ≤ primary platform at 50% daily ceiling × phase-duration days.
- Phase 2 budget ≈ primary at 100%.
- Later phases ≈ full monthly × phase-duration months.

### Go/No-Go Criteria

Each phase \`goNoGo\` string must reference:
- An observable platform signal, OR
- An \`industryBenchmarks[]\` range from Block 4 by \`metric\` name (e.g.,
  "funnel performance within the Skok SaaS trial-to-paid benchmark range
  named in Block 4").

NEVER reference client-specific CPL / CAC / ROAS targets — they don't
exist in the schema.

### Monthly Milestones
One milestone per month for months 1–3 minimum:
- Month 1: technical setup complete + first 30-day performance read.
- Month 2: first optimization cycle + (if $5k+) secondary platform launched.
- Month 3: creative refresh #1 deployed + first observed conversion rates
  compared against Block 4 benchmarks.

### Success Criteria per Phase
Each phase \`successCriteria\` list must reference an observable platform
signal OR an \`industryBenchmarks\` range from Block 4. Do NOT reference
client-specific KPI targets.

### PLG / Free-Trial Vocabulary
When PLG context is present: phase activities and milestones use "trial
starts", "activated users", "paid conversions" — not "leads" or "MQLs".

### Anti-Hallucination Contract
All benchmark references use Block 4's exact \`metric\` strings. Phase
durations must parse cleanly ("2 weeks", "4 weeks"). Decision gates must
name observable signals. No fabricated CPL / CAC / ROAS thresholds.
`;
