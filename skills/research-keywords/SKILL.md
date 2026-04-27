---
name: research-keywords
description: Use when running AIGOS demand-intent keyword research, high-intent query clustering, content-gap sourcing, paid keyword provider coverage, or negative-keyword collection for a locked GTM brief. The agent collects sourced facts and then runs deterministic TypeScript validation from this skill folder.
---

# Section 09 - Demand Intent Keyword Research

## Trigger
`@research-keywords { "run_id": "...", "brief_snapshot_id": "...", "stage": "research-demand-intent", "gtm_brief": { ... }, "ingest_identity": { ... } }`

## What it does
Takes a sealed locked GTM brief and required `ingest-identity` output, then returns a sourced demand-intent research card for `research-demand-intent`: provider coverage, intent clusters, paid keyword opportunities, content gaps, negative keywords, excluded terms, and source gaps. Every factual query, provider claim, gap, exclusion, and available metric carries `source_url` and `retrieved_at`. Unavailable paid metrics omit metric values and record `source_gaps`.

## Boundaries
This skill does not resolve company identity, size the market, validate buyer personas, mine competitor positioning, generate budgets, write campaigns, create ad copy, render UI, or persist data. Adjacent skills own those jobs:

- `ingest-identity`: canonical company, domain, category, core keywords, and negative keywords.
- `research-market`: category definition, market drivers, buying triggers, and adoption barriers.
- `research-icp`: persona anchors, pains, objections, and role-specific search intent.
- `research-competitor`: competitor landscape, competitor-specific reviews, pricing, ads, and share of voice.
- `research-cross`, `synthesize-media-plan`, `synthesize-scripts`: downstream synthesis and planning.

## Workflow
1. Parse the input against `schemas/input.ts`.
2. Read `references/rules.md` and `references/collector.md`.
3. Use public sources and available provider exports to collect evidence for each output key.
4. Use `ingest_identity.core_keywords` as seed terms and `ingest_identity.negative_keywords` as exclusions.
5. If paid providers are unavailable, omit `search_volume`, `cpc`, and `competition` and record `source_gaps`.
6. Normalize keywords with `scripts/normalize-keywords.ts`: lowercase, trim, collapse whitespace, and dedupe by normalized form while preserving first spelling.
7. Write JSON matching `schemas/output.ts`.
8. Run `npm run validate`.
9. Run `npm run sanity-check <output.json>`.
10. Return the validated JSON to the caller.

## Tools
- `web_search`: discover SERP result patterns, provider docs, category pages, comparison pages, and public content gaps.
- `browser_navigate` and `browser_snapshot`: inspect source pages when available.
- `Bash(npm run validate)`, `Bash(npm run sanity-check <output.json>)`, and `Bash(npm run orchestrate -- <run-dir>)`: deterministic gates.
- File write tools: write only inside the run directory or this skill folder when updating fixtures.

## Hard constraints
1. Facts only. No campaign recommendations, budget recommendations, ad copy, launch plans, LLM scores, confidence labels, priority scores, or fabricated metrics.
2. Every factual query, metric, gap, exclusion, provider-status claim, and source gap must include `source_url` and `retrieved_at` where the schema requires it.
3. If a paid provider is unavailable, set `metric_status` to `unavailable`, omit metric values, and explain the gap in `source_gaps`.
4. Never write `unknown`, `TBD`, `n/a`, `Not verified`, scaffold text, placeholders, or empty strings.
5. Keep this skill self-contained. Do not import from `src/`, `research-worker/`, root `lib/`, or another skill.
6. Use prior `ingest-identity` output only for canonical company, domain, category, core keywords, and negative keywords.
7. Use optional `research-market` and `research-icp` only to refine query themes. The skill must still work without them.
8. External fetch or provider failures must throw with provider, query, status, and run id.

## Output
The output schema is `researchKeywordsOutputSchema` in `schemas/output.ts`.

Top-level fields:

- `run_id`
- `brief_snapshot_id`
- `stage: "research-demand-intent"`
- `company_name`
- `category`
- `provider_status`
- `intent_clusters`
- `paid_keyword_opportunities`
- `content_gaps`
- `negative_keywords`
- `excluded_terms`
- `source_gaps`
- `generated_at`

Every sourced nested object uses the shared source primitive:

```ts
{
  source_url: string;
  retrieved_at: string;
}
```

## Verification gate
Before declaring the skill output usable:

```bash
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

All commands must pass without `ALLOW_SUSPECT=1`.
