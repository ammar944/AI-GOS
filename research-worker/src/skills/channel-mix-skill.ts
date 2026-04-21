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
- \`salesMotionApplied\` (v3 echo): copy the value from \`[salesMotion:X]\`
  in context if present. Valid values: product-led / sales-led / hybrid.
  Leave undefined if the tag is absent (legacy run).
- \`pricingModelApplied\` (v3 echo): copy from \`[pricingModel:X]\`. Valid:
  subscription / usage-based / per-seat / one-time-plus-subscription.
- \`conversionPathApplied\` (v3 echo): copy from \`[conversionPath:X]\`.
  Valid: free-trial / freemium / demo-required / direct-checkout.
- \`avgAcvApplied\` (v3 echo): copy from \`[avgAcv:X]\`. Valid: under-1k /
  1k-10k / 10k-50k / 50k-plus.

These 4 v3 echo fields are pure pass-through — do NOT infer them from
research. They come from onboarding §1 Product & Revenue Model, where the
user explicitly answered these questions. Downstream blocks consume them
from strategicFrame rather than re-parsing context tags.
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
  \`in-market-tier-routing.md\`. Budget-gated table is load-bearing —
  under $2k must be 100/0/0, $2k–$5k must keep cold-mass at 0.

### Small-Budget Discipline (LOAD-BEARING — see small-budget-discipline.md)

Every axis of fragmentation has a budget-gated ceiling:

| Monthly budget | Platforms | Campaigns/platform | In-market tiers | Creative angles |
|---|---|---|---|---|
| Under $2k | 1 | 1 | 1 (all in-market) | 2-3 |
| $2k–$5k | **1** | 1 | 2 | 3 |
| $5k–$15k | 2 | 2 | 3 | 4-5 |
| $15k+ | 3 | 3 | 3 | 5+ |

**Round-3 tightening**: at $2k–$5k, platform count is now **1**, not the
previous "primary + secondary". This is the direct response to Mahdy's Choros
feedback ("3k budget is nowhere near sufficient to be split tested across
multi platform").

Platform $1,500/mo floor: no platform allocation below $1,500/mo. If your
math produces a platform at $1,000/mo, consolidate onto fewer platforms.

### Channel-Grounding Rule (MANDATORY — see channel-grounding.md)

Every platform you recommend must be cited in the upstream research context:
- \`competitorIntel.competitors[].adActivity.platforms\` — competitors
  actively running ads there, OR
- \`icpValidation.channels\` — channels the ICP uses, OR
- \`strategicSynthesis.platformRecommendations\` — upstream prioritization.

If TikTok does not appear in ANY of those three sources, do NOT recommend
TikTok. Mahdy's Choros catch: "Not sure where tik tok ads came from, this
wasn't mentioned earlier." An un-grounded platform is the most common
failure mode at small budgets.

### DR Default Funnel Split + Display Mode

Under \`[hasRetargetingPool:true]\` not present (default):
- Conversion: 95-100% of budget
- Awareness: 0-5%
- Consideration: 0% (no mid-funnel without a pool)

**Display mode decision (NEW 2026-04-21)**: set
\`budgetSummary.funnelSplit.displayMode\` based on:
- \`totalMonthly < 5000\` OR \`conversion > 90\` → **'rationale-only'** (the
  3-bar chart is degenerate at that point; the renderer shows
  strategicFrame.funnelSplitRationale as a text card instead).
- Otherwise → **'chart'** (true multi-stage split with real funnel math).

Never emit a platform with role='retargeting'. Retargeting requires a confirmed
audience pool.

### Platform Selection (in order)
1. Apply channel-grounding (above) — eliminate any platform not surfaced
   in upstream research.
2. Apply small-budget-discipline ceiling — eliminate candidates beyond the
   budget-gated count.
3. Apply the salesMotion × conversionPath matrix (below) when v3 tags are
   present.
4. Score remaining candidates on: audience fit (ICP channels), intent signal
   (search vs. social), competitor saturation.
5. Pick the SMALLEST set that clears the $1,500/mo floor per platform.

### salesMotion × conversionPath Matrix (v3 onboarding §1)

When \`[salesMotion:X]\` and \`[conversionPath:X]\` are both present in the
context metadata, use this matrix as a PRIOR over the scoring step — the
preferred platform set for each combination:

| salesMotion | conversionPath | Preferred channels (TOF) | Notes |
|---|---|---|---|
| product-led | free-trial | Meta + Google + LinkedIn (broad) | Classic PLG cold-acquisition mix; LinkedIn for B2B ICPs. |
| product-led | freemium | Meta + Google + content/SEO | Freemium relies on volume; content/SEO grounded in upstream research earns a seat. |
| sales-led | demo-required | LinkedIn + outbound + intent signals | Meta/Google deprioritized unless ICP signal overrides; LinkedIn owns B2B demo funnels. |
| sales-led | direct-checkout | Atypical — fall back to businessModelType | Rare combo (self-serve checkout + sales-led org); don't force the matrix. |
| hybrid | any | Mixed — blend the two single-motion rows above | Split budget between the PLG and SLG preferred sets, weighted by where the majority of revenue lives. |

Matrix rules:
- The matrix is a PRIOR, not a hard override. Channel-grounding (every
  platform cited in upstream research) still applies — if LinkedIn isn't
  cited anywhere in competitor/ICP/synthesis data, don't add it just
  because the matrix says so.
- Small-budget-discipline ceiling still applies. A product-led + free-trial
  run at $2k/mo gets ONE platform, not three — pick the highest-ICP-fit
  of Meta/Google/LinkedIn.
- For atypical combos (sales-led + direct-checkout, or absent tags), fall
  back to the legacy businessModelType-driven selection.

### Daily Ceiling Calculation
- dailyBudget = monthlySpend / 30
- Flag minimumMet=false with a warning when below the platform floor from
  benchmarks.md.

### Ramp-Up Schedule
- Weeks 1–2: single platform at 50% of planned daily budget.
- Week 3: full platform budget (secondary platform allowed only at $5k+).
- Week 4+: full allocation.

### Budget Consistency Contract
- If strategicSynthesis recommends specific allocation percentages, use
  those exact percentages. Do not contradict synthesis.
- Platform percentages must sum to 100 exactly.
- Platform monthlySpend must sum to totalMonthly exactly.

### Anti-Hallucination Contract
Use only the provided reference data and research results. All benchmark
numbers must be labeled "(industry benchmark)". Never emit a platform
without a grounding citation. Never fabricate competitor platform activity.
`;
