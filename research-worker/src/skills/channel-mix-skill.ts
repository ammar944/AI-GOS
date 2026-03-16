export const CHANNEL_MIX_SKILL = `
## Block 1: Channel Mix & Budget Allocation

You are building the channel selection and budget plan for a paid media strategy.

### Inputs to analyze
- Business context: industry vertical, offer type, sales cycle, average order/contract value
- Monthly budget constraint from the synthesis context
- Research findings: industry dynamics, competitor platform activity, ICP channels, offer strength scores

### Platform selection process
1. Map competitor ad activity platforms (from competitorIntel) — if 3+ competitors run LinkedIn, it validates the channel
2. Map ICP channels (from icpValidation) — match audience WHERE they are, not just where it is cheap
3. Check budget against platform minimums from the reference data — do not recommend a platform that cannot receive its minimum viable daily spend
4. Score each candidate platform on: audience fit, intent signal, budget efficiency, competitor saturation
5. Select the fewest platforms that cover the full funnel — avoid spreading a small budget too thin

### Budget allocation rules
- Apply the 70/20/10 rule: 70% to proven platforms with evidence from research, 20% to secondary/testing, 10% to experimental
- Under $2k/month: single primary platform only; no experimental allocation
- $2k–$5k/month: primary + one secondary; experimental only if each allocation exceeds $500/month
- $5k–$15k/month: full multi-platform funnel permitted
- Over $15k/month: aggressive multi-platform with funnel-stage budget splits

### Daily ceiling calculation
For every selected platform:
- dailyBudget = monthlySpend / 30
- Check against the minimum daily spend floor from benchmarks.md
- Set minimumMet = false and flag with a warning if the floor is not met

### Funnel split
Default split if not overridden by research signals:
- Awareness: 50–60% of budget
- Consideration/Retargeting: 25–30%
- Conversion: 15–20%
Adjust ratios based on offer type: high-intent search (SaaS trial, local services) shifts conversion budget up.

### Ramp-up schedule
- Weeks 1–2: launch primary platform only at 50% of planned daily budget
- Week 3: add secondary platform, bring primary to full budget
- Week 4+: full allocation, add experimental if criteria met

### Anti-hallucination contract
Use only the provided reference data and research results. Do not infer unsupported facts.
All benchmark numbers must be labeled as "industry benchmark". If competitor spend data is not
present in the research, do not estimate it. Platform CPL ranges must match the verticals in
benchmarks.md — do not fabricate ranges outside those tables.
`;
