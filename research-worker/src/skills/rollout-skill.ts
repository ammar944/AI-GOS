export const ROLLOUT_SKILL = `
## Block 5: Rollout Roadmap & Phased Launch Plan

You are designing the phased launch sequence and 90-day roadmap.

### Awareness-gated platform phasing (HARD RULE)

Read \`[awarenessLevel:X]\` metadata from the context.

If awarenessLevel is 'unaware' or 'problem-aware':
- Google Search and Performance Max CANNOT appear in Phase 1. Unaware audiences aren't searching yet — Google captures bottom-of-funnel intent they don't generate.
- Phase 1 should prioritize Meta / YouTube / TikTok (education-led creative).
- Google can appear in Phase 2 or later, once Meta testing has built brand recall.

If awarenessLevel is 'solution-aware', 'product-aware', or 'most-aware':
- Google Search may lead Phase 1.

### Inputs to analyze
- Channel mix from Block 1: platforms, total monthly budget, rampUpWeeks, daily ceilings
- Audience and campaign structure from Block 2
- Creative system from Block 3: testing plan, refresh cadence
- Measurement framework from Block 4: industry benchmarks, sales process guidance, risk register
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
- An observable platform signal (e.g. "CTR on primary creative >= platform median" or "frequency does not exceed 2.5 on Meta before exhaustion test")
- A time condition (e.g. "after 14 days and minimum 100 clicks")
- A data sufficiency check (e.g. "minimum 20 conversions for algorithm learning phase")
- An industry benchmark reference from Block 4's \`industryBenchmarks[]\` (e.g. "funnel performance within the SaaS MQL-to-SQL benchmark range from Block 4") — use benchmark RANGES, never client-specific targets.

Never use vague criteria like "performance is satisfactory". Never output a client-specific CPL / CAC / ROAS threshold.

### Monthly milestones
List one milestone per month for the first 3 months minimum:
- Month 1: completion of technical setup + first 30-day performance read
- Month 2: first optimization cycle complete + secondary platform launched
- Month 3: creative refresh #1 deployed + first observed conversion rates compared against Block 4 industryBenchmarks

### Success criteria per phase
Each phase's successCriteria list must reference an observable platform signal (CTR, frequency, CPM trend, conversion volume) or an industryBenchmarks range from Block 4. Do NOT reference client-specific KPI targets — they don't exist in the schema anymore.

### Anti-hallucination contract
Use only the provided reference data and research results. Do not infer unsupported facts.
All benchmark numbers must be labeled as "industry benchmark" with a source. Phase budgetAllocations must
sum correctly with Block 1 budget figures — do not output phases with inconsistent math.
Go/no-go criteria must reference observable platform signals or industryBenchmarks ranges — NEVER client-specific CPL / CAC / ROAS targets (those fields no longer exist in the schema).
`;
