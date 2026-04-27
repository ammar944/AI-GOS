# Collector prompt - research-cross

You are synthesizing completed AIGOS research outputs for the `synthesize-strategy` stage. Return only data that maps to `schemas/output.ts`.

This is not a research collector. It is a cross-analysis pass over supplied JSON cards.

## Input handling maps to `run_id`, `brief_snapshot_id`, `company_name`, `category`, and `input_manifest`

Read the sealed input. Validate the locked GTM brief and all seven required upstream outputs. If any required output is missing or invalid, stop and fail before writing an output card.

Build `input_manifest` with one row for each required upstream skill:

- `ingest-identity`
- `research-market`
- `research-icp`
- `research-offer`
- `research-competitor`
- `research-voc`
- `research-keywords`

## Cross comparison maps to `cross_findings`

Compare sourced claims across upstream outputs. Write a finding only when it is supported by at least two distinct upstream skills.

Allowed finding types:

- `overlap`: two or more skills support the same pattern.
- `contradiction`: two or more skills conflict on a material topic.
- `gap`: missing or thin input evidence blocks downstream use.
- `theme`: repeated evidence across multiple research cards.
- `risk`: sourced concern that appears across multiple inputs.

## Conflict handling maps to `contradictions`

For each contradiction, include:

- `topic`: the disputed area.
- `conflict`: plain-language summary of the conflict.
- `sides`: at least two sourced claims with exact provenance.
- `resolution_needed`: what downstream synthesis cannot decide until the conflict is resolved.

Do not resolve conflicts unless an upstream card already contains a sourced resolution.

## Gap handling maps to `research_gaps` and `readiness_blockers`

Use `research_gaps` for missing evidence. Use `readiness_blockers` only when the gap blocks downstream positioning, media plan, scripts, or workspace presentation.

Do not create scores. Readiness is represented as blockers, not numbers.

## Theme handling maps to `high_confidence_themes`

Use `high_confidence_themes` for repeated patterns supported by at least two distinct upstream skills. These are still findings with provenance, not recommendations.

## Final validation

Before returning output, run:

```bash
npm run validate
npm run sanity-check example/output.json
```

For a run artifact, replace `example/output.json` with the run output path.
