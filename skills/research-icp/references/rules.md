# Rules - research-icp

## Non-negotiable collection rules

1. Every factual claim must include `source_url` and `retrieved_at`.
2. Do not write placeholders: `unknown`, `TBD`, `n/a`, empty strings, scaffold text, TODO text, or sample filler.
3. If a value cannot be sourced, omit it or emit an empty array.
4. Do not add scores, confidence percentages, TAM estimates, persona priority scores, or severity ratings.
5. Do not recommend strategy, positioning, campaigns, channels, hooks, budgets, or creative.
6. Respect `ingest_identity.negative_keywords`; exclude unrelated entities that share the same or similar company name.
7. Use `ingest_identity.core_keywords` as search anchors, not as facts by themselves.
8. Use `research_market` only for category framing; do not depend on it for correctness.
9. Use public pages, docs, integrations, job posts, customer pages, review snippets, and search-result pages as evidence.
10. External fetch or search failures must throw with provider, query, status, and run id.

## Source requirements by output key

- `persona_anchors.company_context`: source from customer stories, company pages, case studies, or public product pages.
- `persona_anchors.pains`: source from customer stories, help docs, integration docs, or public problem statements.
- `persona_anchors.triggers`: source from customer stories, product pages, docs, or public workflows.
- `persona_anchors.objections`: source from pricing pages, migration docs, admin docs, or public alternatives pages.
- `persona_anchors.current_alternatives`: source from customer stories, migration docs, alternatives pages, or integration docs.
- `awareness_stages.evidence`: source each stage with at least one factual observation.
- `job_titles`: source titles from job posts, customer stories, docs, or customer quotes with named roles.
- `search_intent`: source query patterns from public docs, product pages, pricing pages, or search result pages.
- `buying_committee_notes`: source from customer stories, enterprise pages, admin docs, security docs, or pricing pages.
- `exclusions`: source from identity negatives, product boundaries, docs, or pages showing unrelated meanings.

## Runtime behavior

When a source is ambiguous, collect the URL and exact context, then either omit the claim or put the ambiguity in `exclusions` with source evidence. Never smooth over uncertainty with invented language.
