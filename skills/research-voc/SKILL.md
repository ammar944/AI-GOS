---
name: research-voc
description: Category voice-of-customer mining for AIGOS v3. Produces sourced problem-space language while excluding subject company and competitor names.
version: 1.0.0
---

# research-voc

## Goal

Produce a sourced category voice-of-customer card for a locked GTM brief: raw problem-space language, workarounds, frustrations, desired outcomes, and objections that are not tied to named competitors.

The agent collects candidate public evidence. TypeScript builds the exclusion set, filters competitor leakage, validates the schema, and blocks placeholders or product-specific review mining.

## Trigger

Use this skill for the `research-voc` stage after a locked GTM brief and `ingest-identity` output exist.

Do not use this skill for competitor reviews, competitor pricing, ad libraries, positioning moves, market sizing, persona strategy, scripts, or UI rendering.

## Inputs

- `run_id`
- `brief_snapshot_id`
- `stage: "research-voc"`
- locked `gtm_brief`
- required `ingest_identity`
- optional `research_market`
- optional `research_competitor` used only for `competitor_set` exclusions

## Output

Validated JSON matching `schemas/output.ts`:

- `exclusion_terms`
- `category_pain_language`
- `status_quo_frustrations`
- `workarounds`
- `desired_outcomes`
- `objection_language`
- `source_gaps`
- `rejected_competitor_matches`

Every quote, workaround, claim, rejection, and source gap carries `source_url` and `retrieved_at`.

## Collection Rules

- Search for category/problem-space language, not product names.
- Use communities, forums, Hacker News, Reddit, blog comments, and category-level review pages.
- Review sites are allowed only for category or status-quo patterns where the evidence does not name an excluded product.
- If safe evidence cannot be retained after filtering, emit empty arrays where allowed and explain the attempted queries in `source_gaps`.
- Do not backfill with competitor review quotes.

## Exclusion Rules

Before final validation, build `exclusion_terms` from:

- `research_competitor.competitor_set[*].name`
- brief `topCompetitors`
- brief `knownCompetitors`
- brief `alternatives`
- brief `currentAlternative`
- subject company name
- identity canonical company name
- identity negative keywords

Reject any quote, claim, workaround, or source title containing an excluded term after case folding and punctuation removal.

## Local Commands

```bash
npm run check
npm run validate
npm run sanity-check example/output.json
npm run orchestrate -- example
```

## Implementation Notes

- There is no legacy `research-worker/src/runners/*voc*` runner.
- `research-worker/src/runners/competitors.ts` was inspected only to keep review-source skepticism and compact evidence handling.
- The competitor output contract was inspected only for `competitor_set`; this skill does not import it.
- The package is self-contained. Do not import from `src/`, `research-worker/`, root `lib/`, or sibling skills.
