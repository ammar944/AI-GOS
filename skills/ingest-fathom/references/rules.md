# Rules - ingest-fathom

## Non-negotiable extraction rules

1. Only extract facts explicitly present in the Fathom recording transcript or metadata.
2. Every factual claim must include `source_url` and `retrieved_at`.
3. Transcript-derived facts use the Fathom recording URL as `source_url`.
4. Do not write placeholders: `unknown`, `TBD`, `n/a`, `not found`, scaffold text, TODO text, sample filler, or empty strings.
5. If a value cannot be sourced, omit it or emit an empty array.
6. Speaker attribution is required on transcript quotes.
7. Quotes are required for pain points, competitor mentions, buying triggers, objections, goals, decisions, and action items.
8. Budget signals require exact quote evidence. Do not infer, round, normalize, or estimate budget.
9. Do not invent speaker labels, roles, decisions, owners, due dates, goals, competitor names, or resolutions.
10. Do not write to Supabase, meeting status flags, `business_profile_documents`, or `journey_sessions`.
11. Recording fetch errors must throw with provider, recording id, status, and run id.
12. Transcript extraction failures may preserve raw model text only in local run artifacts, never in the final sourced output.

## Source requirements by output key

- `title`: source from Fathom metadata.
- `speakers`: source from Fathom speaker labels or transcript metadata.
- `business_health_summary`: source from direct transcript statements about company health.
- `pain_points`: quote the speaker who stated the pain.
- `budget_signals`: quote the speaker who stated spend, pricing sensitivity, willingness to pay, budget timing, or budget limits.
- `competitor_mentions`: quote the speaker who named the competitor or alternative.
- `buying_triggers`: quote the speaker who stated the trigger or urgency.
- `objections`: quote the speaker who stated the objection.
- `icp_signals`: source only directly stated role, company size, industry, process, or timeline.
- `current_marketing`: include quote evidence when any channel, spend, working, or failing detail is present.
- `goals_and_outcomes`: quote the speaker who stated the goal, metric, or desired outcome.
- `action_items`: quote the explicit next step.
- `decisions`: quote the explicit decision.
- `notable_quotes`: retain speaker and timestamp when available.

## Runtime behavior

When transcript evidence is ambiguous, omit the claim. Empty arrays are valid and preferred over weak extraction.
