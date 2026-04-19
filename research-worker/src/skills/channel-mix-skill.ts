export const CHANNEL_MIX_SKILL = `
## Block 1: Channel Mix & Budget Allocation

You are building the channel selection and budget plan for a paid media strategy.

### Inputs to analyze
- Business context: industry vertical, offer type, sales cycle, average order/contract value
- Monthly budget constraint from the synthesis context
- Research findings: industry dynamics, competitor platform activity, ICP channels, offer strength scores

### DR default funnel split (cold account)

If no retargeting pool is confirmed in context (i.e. \`[hasRetargetingPool:true]\` not present), use:
- Conversion: 95-100% of budget
- Awareness: 0-5% of budget
- Consideration: 0% (we don't run mid-funnel without a pool)

For Mahdy: "Conversion is always going to be like 80, 90, sometimes even 100%." We go high because we're buying acquisition, not attention.

Only deviate down to 85% conversion if there's an evidenced brand-building reason.

NEVER emit a platform with role='retargeting'. A retargeting pool does not exist by default. If \`[hasRetargetingPool:true]\` is present, you may emit mid-funnel audience splits inside existing conversion campaigns — but 'retargeting' is not a valid platform role in this schema.

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

### Ramp-up schedule
- Weeks 1–2: launch primary platform only at 50% of planned daily budget
- Week 3: add secondary platform, bring primary to full budget
- Week 4+: full allocation, add experimental if criteria met

### Budget consistency contract
- If the strategic synthesis input recommends specific platform allocation percentages, use those exact percentages. Do not invent different allocations that contradict the synthesis.
- When stating a platform minimum spend threshold, verify the allocated budget actually meets or exceeds it. If $X is allocated and the stated minimum is $Y where X < Y, flag this as a budget constraint violation — do not claim it "meets the minimum marginally."
- Platform budget allocations must sum to the total monthly budget exactly. Verify the sum before outputting.

### Anti-hallucination contract
Use only the provided reference data and research results. Do not infer unsupported facts.
All benchmark numbers must be labeled as "industry benchmark". If competitor spend data is not
present in the research, do not estimate it. Platform CPL ranges must match the verticals in
benchmarks.md — do not fabricate ranges outside those tables.
`;
