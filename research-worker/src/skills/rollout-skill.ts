export const ROLLOUT_SKILL = `
## Block 5: Rollout Roadmap & Phased Launch Plan

You are designing the phased launch sequence and 90-day roadmap.

### Inputs to analyze
- Channel mix from Block 1: platforms, total monthly budget, rampUpWeeks, daily ceilings
- Audience and campaign structure from Block 2
- Creative system from Block 3: testing plan, refresh cadence
- Measurement framework from Block 4: go/no-go KPIs, risk register
- Offer analysis: offer readiness, red flags (launchBlocker items must be resolved before Phase 1)

### Phase design rules
Design 3–4 phases. Typical structure:
1. Foundation (weeks 1–2): Infrastructure setup, pixel installation, primary platform soft launch at 50% budget
2. Scaling (weeks 3–6): Full primary platform budget, add secondary platform, first creative test results
3. Optimization (weeks 7–10): Pause underperforming ad sets, scale winners, add experimental channel
4. Expansion (month 3+): Full multi-platform, lookalike expansion, creative refresh cycle running

Adjust phase count and duration based on:
- Budget size: smaller budgets take longer to accumulate data → extend each phase
- Offer readiness: if offer has launchBlocker red flags, add a pre-launch remediation phase
- Sales cycle length: if sales cycle > 60 days, extend measurement windows before scaling

### Phase budget allocation
Each phase's budgetAllocation must be consistent with Block 1 ramp-up schedule:
- Phase 1 budget = primary platform at 50% daily ceiling × phase duration days
- Phase 2 budget = primary at 100% + secondary at 50%
- Phase 3+ budget = full monthly allocation (matches Block 1 totalMonthly)

Validation: sum of all phase budgetAllocations over the roadmap period must align with
the monthly budget × number of months covered. Flag any discrepancy.

### Go/no-go criteria
Each phase must have a concrete go/no-go decision gate. Gates must reference:
- A KPI metric from Block 4 with a specific threshold (e.g. "CPL < $80 on Google Search")
- A time condition (e.g. "after 14 days and minimum 100 clicks")
- A data sufficiency check (e.g. "minimum 20 conversions for algorithm learning phase")

Never use vague criteria like "performance is satisfactory" — always a metric + threshold.

### Monthly milestones
List one milestone per month for the first 3 months minimum:
- Month 1: completion of technical setup + first 30-day performance read
- Month 2: first optimization cycle complete + secondary platform launched
- Month 3: creative refresh #1 deployed + CAC model validated against actual data

### Success criteria per phase
Each phase's successCriteria list must include at least one metric from the KPI framework
in Block 4. Do not invent new KPIs here — reference existing ones.

### Anti-hallucination contract
Use only the provided reference data and research results. Do not infer unsupported facts.
All benchmark numbers must be labeled as "industry benchmark". Phase budgetAllocations must
sum correctly with Block 1 budget figures — do not output phases with inconsistent math.
Go/no-go criteria must reference specific KPI targets from Block 4, not generic thresholds.
`;
