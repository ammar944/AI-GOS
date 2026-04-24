# Rules — ingest-identity

Load-bearing constraints extracted from team feedback (Choros).

## Hard constraints

### [CONSTRAINT] Handle max-tokens truncation
Identity resolution JSON must not truncate mid-field. Budget: 2000 input tokens + 4000 response tokens minimum. If response JSON fails to parse or lacks required fields, retry with doubled max_tokens.
- *Source: Choros feedback, commit `d171ee3f`*

### [CONSTRAINT] Produce canonical identity card with required fields
Output MUST include:
- `companyName`, `domain`, `businessModel` (SLG / PLG / PLG-with-paid-upgrade / Ecommerce)
- `coreKeywords[]` (≥3, used downstream by research-competitor ad-lookup)
- `negativeKeywords[]` (exclusions for ad-lookup false positives)
- `segments[]` (distinct addressable ICPs — feeds research-icp multi-ICP logic)

Downstream skills depend on these fields. If any is unresolvable from available signal, emit the field as `null` with explicit reason — never omit silently.

## Sanity gates (`scripts/sanity-check.ts`)

- **[FAIL]** if response JSON failed to parse after retry — caller must handle
- **[FAIL]** if `coreKeywords[].length < 3` — research-competitor's ad-lookup will break
- **[WARN]** if `businessModel` is null — downstream synthesize-media-plan defaults to SLG with `[WARN]`
- **[WARN]** if `segments[].length > 5` — likely over-segmentation; collapse or flag

## Cross-cutting

- Every field carries `source_url` (the source page) + `retrieved_at`
- No guessed companyName — if URL doesn't clearly resolve, ask for clarification or emit `null`
