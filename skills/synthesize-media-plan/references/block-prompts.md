# Block Prompt Scaffold

Generate the media plan in these blocks, then assemble one JSON object matching `schemas/output.ts`.

## strategicFrame

Summarize the business model, awareness level, sales-cycle ceiling, and in-market tier mix from research-cross evidence. Do not add scores.

## channelMix

Choose up to three channel recommendations. Each channel recommendation must trace to cross-analysis evidence.

## audienceCampaignMatrix

Create one or two campaigns total. Each campaign must include platform, role, objective, audience, awareness target, budget share, and budget rationale. Role values are only `primary`, `secondary`, or `testing`.

## creativeAngleSystem

Create three to eight creative angles supported by evidence. Do not include format specs.

## salesProcessGuidance

Explain how sales should handle leads, demos, trials, or handoffs based on available offer, ICP, and cross-analysis evidence. Do not invent CAC or conversion targets.

## industryBenchmarks

Include sourced industry benchmarks only when the research-cross evidence supports them. If benchmark evidence is weak or absent, keep the array small and add a source gap.

## rolloutPhases

Create one to four phases. Each phase has at most two campaigns. Phase 1 cannot include Google for unaware audiences.

## strategySnapshot

Summarize the plan without introducing unsupported platforms, numbers, claims, or removed fields.

## Valid / Invalid Block Examples

Valid `channelMix` item:
- names one channel
- cites cross-analysis evidence
- explains role without inventing CAC, CPL, or conversion rate

Invalid `channelMix` item:
- adds a platform absent from evidence
- predicts performance from category norms
- uses "best practice" as proof

Valid `industryBenchmarks` item:
- includes source URL, retrieved_at, metric label, and stated range.

Invalid benchmark:
- "Typical SaaS CPL is $X" without supplied evidence.
