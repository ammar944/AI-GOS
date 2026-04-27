# Rules - research-cross

## Non-negotiable synthesis rules

1. Use only the locked brief and the seven required prior skill outputs supplied in the input.
2. Do not collect new evidence, use web search, inspect live pages, call provider APIs, or add query logs.
3. Missing `ingest-identity`, `research-market`, `research-icp`, `research-offer`, `research-competitor`, `research-voc`, or `research-keywords` fails the run.
4. Every `cross_findings` and `high_confidence_themes` item must cite at least two distinct upstream skills in `derived_from`.
5. Every `derived_from`, contradiction side provenance, and evidence claim must include `source_url` and `retrieved_at`.
6. Contradictions must preserve both sides. Do not smooth over conflicting input claims.
7. Research gaps and readiness blockers must point to missing inputs or contradictory sourced claims, not preferences.
8. Do not add readiness scores, numeric priorities, confidence percentages, platform recommendations, budget allocations, scripts, or launch plans.
9. Do not write placeholders: `unknown`, `TBD`, `n/a`, empty strings, scaffold text, `Not verified`, task-marker text, or sample filler.
10. Keep the output strict. Unknown top-level fields are invalid.

## Output key mapping

- `input_manifest`: one row for each required upstream skill with `present`, `missing`, or `invalid`.
- `cross_findings`: sourced overlaps, contradictions, gaps, themes, and risks derived from multiple upstream outputs.
- `contradictions`: topics where two or more sourced upstream claims conflict.
- `research_gaps`: missing evidence that blocks a downstream positioning, media-plan, or script decision.
- `high_confidence_themes`: repeated sourced patterns that appear in at least two upstream skills.
- `readiness_blockers`: concrete missing inputs or unresolved contradictions that prevent downstream synthesis.

## Legacy carry-forward

Carry forward the useful shape from `research-worker/src/runners/synthesize.ts`: compare sections, penalize missing sections, and frame readiness as blockers. Drop the legacy scorecard, model priorities, platform budget recommendations, and any unsourced strategy generation.
