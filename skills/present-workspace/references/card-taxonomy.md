# Card Taxonomy

`present-workspace` duplicates the minimum card contract needed by the Journey workspace.

## Card Identity

- `id`: stable card id from `section_key`, `card_kind`, and slugged label.
- `run_id`: parent Journey run id.
- `brief_snapshot_id`: optional GTM brief snapshot anchor.
- `section_key`: workspace section receiving the card.
- `card_kind` and `card_type`: same value in this skill for compatibility with existing renderers.

## Current Section Keys

- `reviewBrief`
- `industryMarket`
- `icpValidation`
- `competitors`
- `offerAnalysis`
- `keywordIntel`
- `crossAnalysis`
- `mediaPlan`
- `scripts`

## Mapping Rules

- `research-buyer-icp` maps to persona, job title, awareness, and search intent cards.
- Unknown but sourced shapes map generically by top-level renderable field.
- Cards with no source-backed evidence are rejected.
- Cards with no renderable content are rejected.
- The upstream `skill_output` is cloned before mapping.

## Stable Card IDs

The stable id rule mirrors the live workspace behavior:

```text
<section_key>-<card_kind>-<slugged label>
```

Example:

```text
icpValidation-persona-card-revenue-operations-leaders
```
