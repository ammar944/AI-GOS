export const AUDIENCE_CAMPAIGN_SKILL = `
## Block 2: Audience Segmentation & Campaign Architecture

You are designing the audience strategy and campaign structure for each approved platform.

### Inputs to Analyze
- ICP validation: validated persona, demographics, triggers, objections, decision factors.
- Competitor intel: white-space gaps, audience patterns, platforms used by competitors.
- Block 1 output: approved platforms, \`strategicFrame.inMarketTierMix\`,
  \`strategicFrame.funnelSplitRationale\`, budget totals.

### Campaign Count Ceiling (BUDGET-GATED — see small-budget-discipline.md)

| Monthly budget | Max campaigns |
|---|---|
| Under $5k | **1** |
| $5k–$15k | 2 |
| Over $15k | 3 |

Round-3 tightening: at under $5k, campaign count is now **1**. Mahdy:
"3k budget is nowhere near sufficient to be split tested across multi
platform, let alone multi campaigns on a platform."

**When campaigns.length === 1, \`singleCampaignRationale\` is REQUIRED**
(schema-validated). Fill it with a one-sentence Brooke-anchored
justification. Example:

"Single campaign at $3k/mo per Brooke's 'single campaign first' rule —
splitting into two halves neither campaign to $1.5k/mo, below the data-
sufficiency floor for creative testing."

Do NOT emit multiple campaigns at small budget just because the schema
supports it. The validator rejects campaign-count-exceeds-ceiling.

### Campaign Naming Convention — REMOVED (round 3)

The \`namingConvention\` field was removed from the schema on 2026-04-21
per Mahdy round 3 feedback ("Not sure what these sections or what value
they provide"). Campaign naming is a production-team concern, not a
media-plan deliverable. Campaign \`name\` strings should be descriptive but
short; do NOT output a naming-convention block.

### Segment Design

For each segment:
1. Name descriptively (e.g., "SaaS_VP_Eng_ToF", "Branded_Search_BoF").
2. Define targeting parameters using capabilities from audience-targeting.md.
3. Estimate reach using ICP audienceSize as anchor.
4. Assign funnel position — top (cold acquisition) or bottom (branded/
   high-intent). NO 'mid' without \`[hasRetargetingPool:true]\` context flag.
5. Set priority 1–10 based on ICP decision-factor relevance + competitor
   gap exploitability.

Segment count ceiling:
- Under $5k: 2–3 segments, all priority ≥7.
- $5k+: 3–5 segments.

### PLG / Free-Trial Vocabulary (see ltv-cac-viability.md)

When \`[businessModelType:plg]\` OR free-trial signals are present in context:
- NEVER use "leads", "CPL", "lead-gen", "MQL", "SQL", "lead-to-MQL".
- USE "free sign-ups", "cost per trial start", "trial users", "activated
  users", "paid conversion", "trial-acquisition".
- Segment names like "Cold_Lead_Gen" must be replaced with "Cold_Trial_
  Acquisition" or similar trial-aware language.

Segment objective should be "trial start" or "paid conversion" — never
"lead" on a PLG product.

### Platform-Specific Targeting Notes (from audience-targeting.md)
- LinkedIn: job title, seniority, company size, industry. B2B personas.
- Meta: interest stacks + behavioral + lookalikes from pixel. B2C + awareness.
- Google: keyword intent layers + in-market audiences. Bottom-funnel.

### avgAcv Gate for Enterprise Channels (v3 onboarding §1)

LinkedIn ABM, intent-signal tools (Bombora, 6sense, G2 Buyer Intent),
and account-list-based targeting have minimum-viable ACV floors because
their per-lead cost structure requires large deal sizes to clear unit
economics.

When \`[avgAcv:X]\` is present in context:

| [avgAcv:X] | LinkedIn ABM | Intent signals | Account-list targeting |
|---|---|---|---|
| under-1k | **Do NOT recommend** | **Do NOT recommend** | **Do NOT recommend** |
| 1k-10k | **Do NOT recommend** | **Do NOT recommend** | Only if ICP is narrow (<1000 accounts) |
| 10k-50k | Allowed | Allowed | Allowed |
| 50k-plus | Preferred | Preferred | Preferred |

Rationale: a $100 CPL on LinkedIn ABM converting at 10% to paid = $1,000
CAC. That CAC makes sense at $50k ACV, breaks at $1k ACV. The validator
flags enterprise-only channels at SMB ACV as a unit-economics violation.

For under-1k and 1k-10k tiers, use broad LinkedIn (job-title + industry)
WITHOUT ABM features — that's a legitimate B2B channel at SMB ACV.

### Campaign Structure
For the 1 (or 2–3) campaigns:
- Objective: aligned to funnel position. Top → conversion/sign-up. Bottom → branded conversion.
- Ad sets: one segment per ad set (clean performance data).
- Ad-set budget from Block 1 allocation, never below platform minimum.

### Anti-Hallucination Contract
Use only provided reference data. Targeting parameters must reference
capabilities in audience-targeting.md, not assumed platform features.
Audience sizes must derive from icpValidation.audienceSize — do not
invent reach estimates.
`;
