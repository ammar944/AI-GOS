---
name: ingest-url
description: Discover high-signal company website pages and emit sourced GTM brief prefill proposals before research starts.
---

# Trigger

Use this skill when the user provides a company URL and AIGOS needs a sourced draft of GTM brief fields before research stages run.

Do not use this skill for uploaded files, Fathom calls, competitor research, ICP research, VoC research, keyword research, strategy synthesis, or presentation write-back.

# What it does

`ingest-url` accepts a company website URL, validates optional LinkedIn company URL context, discovers high-signal public pages, normalizes page and field keys, and writes JSON containing:

- `canonical_url`
- `company_name`
- `discovered_pages`
- sourced `prefilled_fields`
- `unresolved_fields`

The output feeds `enrich-brief`, `review-brief`, `lock-brief`, and `present-workspace`. It does not lock the brief.

# Boundaries

- No Supabase writes.
- No UI cards.
- No market, ICP, competitor, VoC, keyword, offer, media-plan, or script research.
- No PDFs, DOCX files, transcripts, meeting recordings, or Fathom exports.
- No hidden pricing, ACV, conversion path, or competitor inference without source evidence.
- No imports from `src/`, `research-worker/`, root `lib/`, or another skill.

# Workflow

1. Validate `example/input.json` or the provided run input with `schemas/input.ts`.
2. Normalize the base URL and optional LinkedIn company URL.
3. Discover candidate pages through the provider adapter or fixture input.
4. Filter duplicates, assets, auth pages, legal pages, blogs, news, and off-domain URLs.
5. Rank homepage, pricing, product, customer, case-study, about, demo, then other pages.
6. Normalize collected fields into current GTM brief field keys.
7. Validate output with `scripts/validate.ts`.
8. Run deterministic integrity gates with `scripts/sanity-check.ts`.

# Tools

- `node --import tsx/esm scripts/validate.ts`
- `node --import tsx/esm scripts/sanity-check.ts <output.json>`
- `node --import tsx/esm scripts/discover-pages.ts <input.json>`
- `node --import tsx/esm scripts/orchestrate.ts <run_dir>`
- Optional browser or web tools only for collecting real source pages before writing JSON.

# Hard constraints

- Every factual value must carry `source_url` and `retrieved_at`.
- Empty arrays are allowed.
- Placeholder values are forbidden: `unknown`, `TBD`, `n/a`, `not found`, and `scaffold`.
- Legacy field names such as `websiteUrl`, `valueProp`, and `headquartersLocation` must be normalized before output or rejected.
- Provider adapters must be mockable and fixture-safe.
- External API failures must throw with provider, URL or query, status, and run id.
- The skill emits JSON files only.

# Output

The output is `ingestUrlOutputSchema` in `schemas/output.ts`. It contains only sourced URL intake facts and reviewable GTM brief prefill proposals. It never contains research cards, reports, screenshots, or database write instructions.
