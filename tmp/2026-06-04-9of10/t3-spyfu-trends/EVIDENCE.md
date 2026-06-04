# T3 Evidence — SpyFu Keyword Economics + SearchAPI Trends Fallback

## Scope

- Promoted `SPYFU_API_KEY` from optional to required env validation and health-check coverage.
- Added `keyword_trends`, a bounded SearchAPI Google Trends fallback tool for relative-interest signals when `keyword_volume` has a gap, rate limit, or no row.
- Registered `keyword_trends` for Demand Intent and updated the Demand Intent skill/prompt contract.
- Hardened Demand Intent provenance checks so each row must match its own `keyword_volume` or `keyword_trends` tool evidence, or be an explicit data gap.
- Rejected CPC and numeric volume/CPC/difficulty siblings unless the same keyword was returned by SpyFu.
- Rejected empty or malformed SearchAPI Google Trends payloads as gaps instead of success-shaped zero-interest rows.

## SpyFu Probe

One scrubbed local probe used the existing `.env.local` `SPYFU_API_KEY`, with shell quotes stripped before the request.

- Endpoint: `https://api.spyfu.com/apis/keyword_api/v2/related/getKeywordInformation`
- Keyword: `project management software`
- Status: HTTP 200
- Result summary: `resultCount=1`, `totalMatchingResults=2`, first row had `keyword=true`, `searchVolume=true`, `cpc=false`, `difficulty=false`

This proves the key is valid/funded for the keyword-information endpoint. The specific row returned volume but not CPC/difficulty, so the implementation still treats per-field absence as tool data absence rather than inventing numbers.

## Verification

- `pnpm exec tsc --noEmit` — passed, 0 errors.
- Targeted T3 Vitest command — passed, 9 files / 75 tests.
- `pnpm run test:run` — passed, 175 files / 1492 tests / 1 skipped.
- `pnpm run build` — passed.
- `pnpm run lint` — passed with 0 errors / 32 existing warnings.
- Read-only QA re-review — GO on the prior row-scoped provenance and empty-Trends-payload blockers.

## Live Gate

Pending. A live Demand Intent run still needs to prove:

- SpyFu-backed rows carry tool-sourced volume/provenance.
- SearchAPI Trends rows appear when SpyFu is unavailable or has no usable row.
- No Demand Intent output uses model-estimated CPC, volume, or difficulty.
