# stages/02-claims — Layer 2 (Stage Contract)

Stage A.2 of the script pipeline. Deterministic. Zero AI tokens.

## Inputs

`researchContext: Record<string, unknown>` — the research bundle assembled by the dispatch layer. Expected to contain (any may be absent):

- `industryResearch.categorySnapshot.*` (market size, maturity, pain points)
- `icpValidation.painPoints[]` and `icpValidation.objections[]`
- `competitorIntel.competitors[].weaknesses` and `topAdHooks`
- `offerAnalysis.differentiators[]`, `pricingTiers[]`, `outcomes[]`
- `keywordIntel.keywords[]` (descriptive, not always present)

The extractor inspects the raw shape and harvests citable, source-attributed strings.

## Process

`extractClaims(researchContext)` walks known JSON paths and produces `ExtractedClaim[]`. Each claim records:

- `id` — sequential integer (1-based)
- `claim` — the citable string (verbatim or lightly normalized)
- `source` — short tag like `"industryResearch.categorySnapshot.marketSize"`
- `stat` — extracted numeric stat if present (e.g. `"$5B"`, `"30%"`)
- `category` — typed enum (`market-size`, `audience-pain`, `audience-trigger`, `competitor-weakness`, …)

`formatClaimsForScript(claims)` produces a prompt-ready block consumed by Stage B.

## Checkpoints

- [ ] Each claim has a non-empty `claim` string.
- [ ] Each claim has a non-empty `source` (never `"unknown"`).
- [ ] Categories use the enum values defined in `claim-extractor.ts`.
- [ ] Stat extraction recognizes `$`, `%`, `K/M/B` suffixes; falls back to `null` when absent.

## Outputs

`ExtractedClaim[]` — typically 10–40 claims depending on research depth. Stage B uses this as a citable menu rather than mining raw JSON in its prompt.

## Forbidden

- Calling AI from this stage.
- Inventing or paraphrasing claims that are not in the research context.
- Returning a claim without a source attribution.
