export const CHANNEL_MIX_SKILL = `
## Block 1: Channel Mix & Budget Allocation

You are building the channel selection and budget plan for a paid media strategy.
You are also the strategic anchor for the rest of the media plan — your
\`strategicFrame\` output surfaces the classifications the media-plan
methodologies produce so blocks 2–6 can consume them as structured data
rather than re-deriving them from prose.

### Strategic Frame (REQUIRED — strategicFrame field)

Fill \`strategicFrame\` with classifications the methodologies in your system
prompt ALREADY produce. Do NOT invent new strategic concepts — cite the
methodology authority for each field:

- \`businessModelApplied\` + \`businessModelConfidence\`: classify per
  \`business-model-routing.md\`. If \`[businessModelType:X]\` is present in the
  context metadata, use X. If unclear, output \`unknown\` + \`low\` — do NOT
  guess.
- \`awarenessLevelApplied\` + \`awarenessLevelConfidence\`: classify per
  Schwartz's 5 levels in \`awareness-level-routing.md\`. If
  \`[awarenessLevel:X]\` is in context metadata, use X. Default to
  \`solution-aware\` + \`low\` when unclear (safest middle).
- \`salesCycleCeilingDays\` + \`salesCycleCeilingRationale\`: read the offer
  structure from the identity card and apply the ceiling table in
  \`sales-cycle-bounding.md\`. One-sentence rationale citing the offer physics
  (e.g. "7-day free trial + one-call close → 7-day ceiling"). This ceiling
  is LOAD-BEARING — blocks 4 (measurement windows) and 5 (phase durations)
  are constrained by it.
- \`funnelSplitRationale\`: one to two sentences explaining why the
  \`budgetSummary.funnelSplit\` percentages you chose match the
  awareness-level + business-model + budget combination. Cite the rule from
  \`awareness-level-routing.md\` "Funnel Split Rules" section.
- \`inMarketTierMix\`: budget allocation across Haynes' three tiers
  (in-market / needs-convinced / cold-mass) per
  \`in-market-tier-routing.md\`. The budget-gated table is load-bearing —
  under $2k must be 100/0/0, $2k–$5k must keep cold-mass at 0, $5k–$15k
  unlocks the full 3-tier mix. The three percentages sum to 100.

Do not emit a strategicFrame that contradicts the budget allocation you
choose for \`platforms[]\`. If the platform rule says "under $2k → single
platform" and your tier rule says 100% in-market, the platform you pick
must carry that 100% in-market audience. Internal consistency is the whole
point of surfacing these fields.

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
