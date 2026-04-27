# research-market Rules

## Boundary

This skill consumes a locked GTM Brief snapshot. It does not resolve identity,
rewrite the brief, or fetch mutable account/profile state.

URL-only input is invalid. URL input must go through ingestion, brief review,
and lock before this skill runs.

## Evidence

Each factual claim must carry:

- `source_url`
- `retrieved_at`
- optional `source_title`
- optional `publisher`

Use `source_gaps[]` instead of inventing missing evidence.

## Market Sizing

Market sizing must be scoped. The `value` field is text because sources often
use ranges, currencies, geography, and time periods that should not be coerced
into false precision.

Valid sizing labels:

- `sam`
- `estimated_sam`
- `proxy_estimate`
- `tam_context`

Broad parent-market stats are allowed only as `tam_context`.

## Output Compatibility

The rich artifact is the source of truth. The top-level fields `summary`,
`keyFindings`, `evidenceIds`, and `assumptions` exist so the current GTM stage
validator can parse the result. The legacy `categorySnapshot` and related
fields exist so current `industryMarket` cards can render during the migration.
