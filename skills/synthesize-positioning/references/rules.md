# Rules - synthesize-positioning

## Non-negotiable synthesis rules

1. Use only the locked GTM brief and upstream research outputs supplied in the input.
2. Do not browse, fetch, or collect new market, ICP, offer, keyword, competitor, or VoC evidence.
3. Every synthesis object must include `derived_from`.
4. Every evidence item must include `source_url` and `retrieved_at`.
5. Do not write placeholders: `unknown`, `TBD`, `n/a`, empty strings, scaffold text, TODO text, or sample filler.
6. Do not emit unsourced category, competitor, pricing, performance, or customer quote claims.
7. Do not emit channel choices, platform recommendations, launch plans, keyword plans, scripts, budgets, readiness scores, confidence scores, or LLM scores.
8. Forbidden claims from `gtm_brief.fields.forbiddenClaims` must not appear anywhere in output copy.
9. If upstream evidence conflicts, use the more specific sourced claim and record the unsafe or unsupported pattern in `claims_not_allowed`.
10. Missing evidence becomes an omitted optional object or an empty array where the schema allows it. Do not fill gaps with invented strategy.

## Source requirements by output key

- `positioning_statement`: derive from the locked brief, ICP pain/trigger evidence, offer proof, and cross-analysis.
- `one_line_promise`: derive from `corePromise`, `keyPromises`, offer proof, and ICP pain evidence.
- `ranked_value_props`: rank by fit to ICP pain, buying trigger, objection pressure, and available proof.
- `ranked_value_props.icp_fit_reason`: explain why the value prop maps to a specific persona, pain, trigger, or current alternative.
- `ranked_value_props.objection_addressed`: include only when sourced objections exist.
- `narrative_arc.old_way`: describe the current alternative or before state.
- `narrative_arc.cost_of_old_way`: describe sourced friction or cost, without inventing metrics.
- `narrative_arc.new_way`: describe the new frame using sourced product and offer proof.
- `narrative_arc.proof_bridge`: include sourced proof that connects the old way to the new way.
- `narrative_arc.closing_frame`: end with a grounded strategic frame, not an ad script.
- `status_quo_contrast`: contrast old and new operating models; do not include channel or launch advice.
- `message_angles`: produce strategic message angles only, not hooks, scripts, headlines, or platform-specific ad copy.
- `claims_not_allowed`: record unsupported, conflicting, or unsafe claim patterns that downstream skills must avoid.

## Legacy field drops

Never output these legacy fields or their equivalents:

- `platformRecommendations`
- `readinessScorecard`
- launch plans or next-step task lists
- scores, scorecards, confidence percentages, and numeric readiness ratings
- budgets, budget allocations, target CPL, target CAC, or performance forecasts
- scripts, hooks, ad copy, or keyword plans

## Inspected implementation notes

- `research-worker/src/runners/synthesize.ts`: legacy runner emits positioning strategy, platform recommendations, messaging angles, planning context, next steps, strategic narrative, readiness scorecard, and top actions. This skill drops the platform, planning, score, and task-list pieces.
- `research-worker/src/schemas/gtm/strategy-synthesis.ts`: current schema is placeholder-only with `summary`, `keyFindings`, `evidenceIds`, and `assumptions`.
- `research-worker/src/schemas/gtm/gtm-brief.ts`: locked brief source fields are duplicated locally instead of imported.
- `research-worker/src/schemas/gtm/gtm-run.ts`: runtime stage key is `synthesize-strategy`.
