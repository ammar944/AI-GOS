# Rules - research-keywords

## Hard Constraints

- Collect facts only. Do not generate media budgets, ad copy, launch plans, campaign structures, LLM scores, confidence labels, priority scores, or recommendations.
- Every factual query, provider-status claim, observed gap, negative keyword, excluded term, and source gap must carry `source_url` and `retrieved_at` where the schema requires it.
- Do not fabricate volume, CPC, competition, difficulty, or opportunity metrics.
- If a paid provider is unavailable, set `metric_status` to `unavailable`, omit `search_volume`, `cpc`, and `competition`, and add a matching `source_gaps` entry.
- Never emit placeholder text: `unknown`, `TBD`, `n/a`, `Not verified`, `scaffold`, `todo`, empty strings, or lorem ipsum.
- Normalize keywords by lowercasing, trimming, collapsing whitespace, and deduping exact normalized matches while preserving the first sourced spelling.
- Content gaps must come from observed SERP or public content patterns, not from the product description alone.
- Negative keywords and excluded terms must be sourced to identity output, public SERP ambiguity, provider evidence, or a public page that proves the exclusion.
- External API failures must throw with provider, query, status, and run id.
- Keep this skill self-contained. Do not import from `src/`, `research-worker/`, root `lib/`, or another skill.

## Legacy Decisions Kept

- Keep provider-status honesty from `research-worker/src/runners/keywords.ts`.
- Keep theme-based keyword grouping from `research-worker/src/skills/keyword-campaign-skill.ts`.
- Keep no-tool fallback behavior, but represent unavailable metrics as missing fields plus `source_gaps`, not fake zeroes or `Not verified`.
- Keep top-level demand intent as the stage purpose.

## Legacy Decisions Dropped

- Drop `priorityScore`, `confidence`, recommended monthly budgets, forced campaign counts, fake metric fallbacks, and unsourced quick wins.
- Drop presentation rendering for Wave 2.
