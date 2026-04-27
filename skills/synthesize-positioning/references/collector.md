# Collector prompt - synthesize-positioning

You are synthesizing positioning for the AIGOS `synthesize-strategy` stage. Return only data that maps to `schemas/output.ts`.

Every instruction maps to exactly one output key.

## Input handling maps to `run_id`, `brief_snapshot_id`, `company_name`, `category`

Read the sealed input. Use `gtm_brief.fields.companyName.value` and `gtm_brief.fields.category.value` for the top-level identity fields. Use upstream research only as evidence. Do not import facts from memory, browsing, or prior accounts.

## Positioning synthesis maps to `positioning_statement`

Create one positioning statement that names the target customer, category frame, main pain, differentiated edge, and outcome. Keep it strategic, not promotional. It must include `derived_from` and evidence from at least two upstream sources or `gtm-brief`.

## Promise synthesis maps to `one_line_promise`

Write one concise promise from `corePromise`, `keyPromises`, offer proof, and ICP pain evidence. Do not include unsupported quantified guarantees or forbidden claims.

## Ranked value prop synthesis maps to `ranked_value_props`

Produce three to seven ranked value props. Each value prop needs:

- `value`: the value prop.
- `derived_from`: upstream sources used.
- `evidence`: source-backed facts behind the value prop.
- `rank`: 1 is strongest.
- `icp_fit_reason`: why this value prop maps to a sourced ICP pain, buying trigger, or current alternative.
- `objection_addressed`: include only when the input contains relevant objection evidence.

## Narrative framing maps to `narrative_arc`

Create the strategic story:

- `old_way`: current alternative or before-state.
- `cost_of_old_way`: sourced friction caused by the old way.
- `new_way`: the new operating frame.
- `proof_bridge`: evidence connecting the product promise to the new way.
- `closing_frame`: strategic closing frame.

## Status quo contrast maps to `status_quo_contrast`

Create two to five contrast points between the old operating model and the new one. Do not mention channels, launch phases, media budgets, keywords, or scripts.

## Message strategy maps to `message_angles`

Create three to eight strategic message angles. These are not ad hooks or scripts. Each angle must be sourced and traced.

## Guardrails map to `claims_not_allowed`

Record claim patterns that downstream skills must avoid because they are unsupported, conflict with evidence, or resemble forbidden claims. Do not repeat forbidden brief claims verbatim.

## Final validation

Before returning output, run:

```bash
npm run validate
npm run sanity-check example/output.json
```

For a run artifact, replace `example/output.json` with the run output path and pass `--input <input.json>` when the input is outside `example/input.json`.
