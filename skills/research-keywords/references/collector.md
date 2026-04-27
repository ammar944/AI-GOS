# Collector Prompt - research-keywords

Use this prompt when collecting the JSON artifact for `research-demand-intent`.

## Inputs

- Locked GTM brief from `schemas/input.ts`.
- Required `ingest_identity` output:
  - `canonical_company_name`
  - `canonical_domain`
  - `category`
  - `core_keywords`
  - `negative_keywords`
- Optional `research_market` output for category framing, demand drivers, buying triggers, and adoption barriers.
- Optional `research_icp` output for persona pains, objections, and search intent.

## Collection Plan

1. Confirm provider coverage.
   - Inspect available provider exports or documented provider availability.
   - Write one `provider_status` claim per provider used or attempted.
   - If SpyFu, Google Ads, SEMrush, Ahrefs, SearchAPI, or public SERP data is unavailable, source the claim and add relevant `source_gaps`.

2. Build seed query themes.
   - Start from `ingest_identity.core_keywords`.
   - Expand with brief fields: category, product description, target customer, primary ICP, job titles, ICP pains, current alternatives, awareness level, campaign objective, and target market.
   - Use optional market and ICP outputs only as refiners, not as unsourced fact sources unless their nested claim has `source_url` and `retrieved_at`.

3. Collect intent clusters.
   - Map each cluster to one output intent:
     - `problem`
     - `category`
     - `solution`
     - `comparison`
     - `competitor`
     - `pricing`
     - `implementation`
     - `content_gap`
   - Map each cluster to one funnel stage:
     - `problem_aware`
     - `solution_aware`
     - `product_aware`
     - `most_aware`
   - Every query must be a `keywordMetricSchema` object.
   - If metrics are unavailable, do not include `search_volume`, `cpc`, or `competition`.

4. Collect paid keyword opportunities.
   - Include only provider-sourced paid metrics or unavailable-metric entries that honestly record the missing provider coverage.
   - Do not rank, score, budget, or recommend spend.

5. Collect content gaps.
   - Use observed SERP pages, public comparison pages, docs pages, pricing pages, help-center pages, or listicles.
   - Each gap must identify the observed query, current result pattern, and buyer question.
   - Do not infer a content gap from the company description alone.

6. Collect negative keywords and excluded terms.
   - Start from `ingest_identity.negative_keywords`.
   - Add public SERP ambiguity only when the source proves the irrelevant meaning.
   - Keep reasons factual and sourced.

7. Finalize.
   - Write JSON matching `schemas/output.ts`.
   - Run `npm run validate`.
   - Run `npm run sanity-check <output.json>`.
   - Run `npm run orchestrate -- <run-dir>` before returning if duplicate normalized keywords may exist.

## Output Mapping

- Provider coverage -> `provider_status`, `source_gaps`
- Query themes -> `intent_clusters`
- Paid metric coverage -> `paid_keyword_opportunities`, `source_gaps`
- SERP/content observations -> `content_gaps`
- Identity and ambiguity exclusions -> `negative_keywords`, `excluded_terms`
- Missing provider evidence -> `source_gaps`
