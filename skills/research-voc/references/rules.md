# research-voc Rules

## Scope

- Category problem-space evidence only.
- Preserve raw language about pains, workarounds, objections, and desired outcomes.
- Facts only. No recommendations, scores, strategy, scripts, or market sizing.
- Use `research_competitor.competitor_set` only to build exclusions.

## Source Rules

- Every retained quote, claim, workaround, rejection, and source gap must include `source_url` and `retrieved_at`.
- Use real source URLs.
- Use ISO datetimes for `retrieved_at`.
- Omit unsourced values instead of filling placeholders.
- If no category-safe source remains, emit a `source_gaps` entry with attempted queries.

## Exclusion Rules

Build exclusions from competitor set names, brief competitors and alternatives, subject company names, and identity negative keywords.

After normalizing case and punctuation, reject any retained:

- quote
- claim
- workaround
- source title
- review-site evidence naming an excluded product

Rejected matches belong in `rejected_competitor_matches` with source URL, retrieval time, rejected term, and matched competitor.

## Review-Site Rules

Review sites are allowed only when the evidence is category-level or status-quo-level and does not name a product in the exclusion set.

Do not mine:

- named competitor pros and cons
- product review pages
- pricing complaints about a named vendor
- switching stories that name a vendor
- feature requests for a named vendor

## Placeholder Ban

Never emit these values in any string field:

- unknown
- TBD
- n/a
- scaffold
- placeholder
- lorem ipsum
