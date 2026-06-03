# Ad Engine Google Identity Guard Findings

Branch: `fix/ad-engine-google-identity-guard`

## Summary

Implemented the precision-first guard from `docs/handoffs/2026-06-04-ad-engine-google-leak-fix-codex.md`.

The root cause was that `resolveBestCandidate` treated a broad `domainMatch` heuristic and a real candidate-domain match as the same thing. For Google advertiser-search records, SearchAPI supplies only `id` and `name`, so an alias-less short-name match like `Notion` -> `Notion Limited` could be accepted by the corporate-suffix heuristic. `identityFromVerdict` then mapped any accepted match with a requested target domain to `identityVerified:true` / `identityBasis:"domain"`.

## Changes

- `src/lib/lab-engine/agents/tools/advertiser-match.ts:541`
  - Added `domainCorroborated?: boolean` to `ResolverResult`.
  - Added `domainCorroborated` to candidate diagnostics.
- `src/lib/lab-engine/agents/tools/advertiser-match.ts:689`
  - Computes `domainCorroborated` from the real `candidateDomainSignal(candidate, domain) === "match"` path only.
  - Keeps existing candidate selection/ranking intact; `domainMatch` can still represent name/base heuristics.
- `src/lib/lab-engine/agents/tools/adlibrary.ts:499`
  - `identityFromVerdict` now emits `identityVerified:true` / `identityBasis:"domain"` only when `domainCorroborated` is true.
  - Accepted but uncorroborated matches now emit `identityVerified:false` / `identityBasis:"name_only"`.
- `src/lib/lab-engine/agents/tools/adlibrary.ts:577`
  - Google wrapper passes `candidateResult.domainCorroborated`.
- `src/lib/lab-engine/agents/tools/adlibrary.ts:638`
  - Meta wrapper uses the same resolver signal.
- `src/lib/lab-engine/agents/tools/adlibrary.ts:688`
  - Part B verified Meta page-id recovery remains explicitly domain-corroborated.

## Notion Before / After

Case: `advertiser:"Notion"`, `domain:"notion.so"`, Google advertiser candidate `{ id:"notion-limited", name:"Notion Limited" }`.

- Before: resolver accepted the candidate through the alias-less short-name corporate-suffix heuristic, and `identityFromVerdict` tagged ads `identityVerified:true` / `identityBasis:"domain"`.
- After: resolver may still select the candidate, but `domainCorroborated:false`; Google ads are tagged `identityVerified:false` / `identityBasis:"name_only"`, so the adapter routes them to quarantine instead of the verified wall.

## Tests Added / Updated

- `src/lib/lab-engine/agents/tools/__tests__/advertiser-match.test.ts:126`
  - Inverted the corporate-suffix resolver test to assert alias-less suffix matches are not domain-corroborated.
- `src/lib/lab-engine/agents/tools/__tests__/advertiser-match.test.ts:141`
  - Added the `Notion Limited` resolver regression.
- `src/lib/lab-engine/agents/tools/__tests__/google-meta-ads.test.ts:104`
  - Added the Google wrapper regression asserting `name_only` / unverified output.
- `src/lib/lab-engine/agents/tools/__tests__/google-meta-ads.test.ts:276`
  - Updated platform profile URL behavior: Facebook profile URLs are ignored and do not earn domain verification.
- `src/lib/lab-engine/agents/tools/__tests__/competitor-ad-adapter.test.ts:342`
  - Added adapter coverage proving `name_only` creatives are quarantined and preserve identity metadata.
- `src/lib/lab-engine/agents/tools/__tests__/adapter-identity-dedup.test.ts:3`
  - Updated the dedup fixture from ambiguous to `name_only` for the quarantined SearchAPI copy.

## Tradeoff

This is precision-first. Alias-less accepted matches that lack a real candidate-domain signal are now quarantined, even when they may be legitimate short-name Google or Meta matches. That is intentional: Google advertiser-search records do not include destination domain data, so the system cannot distinguish `Notion Labs` from `Notion Limited` on name alone. Verified-wall recall is preserved for real domain-backed Meta candidates and the existing Foreplay/Part B page-id recovery path.

Skipped the optional textless-creative guard. It is unnecessary for this leak and would change cap/ranking behavior for sparse but legitimate image/video creatives.

## Verification

Red phase reproduced before implementation:

- `advertiser-match.test.ts` failed because `result.domainCorroborated` was `undefined`.
- `google-meta-ads.test.ts` failed because `Notion Limited` returned `identityVerified:true` / `identityBasis:"domain"`.

Final verification:

```bash
npm run test:run -- src/lib/lab-engine/agents/tools/__tests__/advertiser-match.test.ts src/lib/lab-engine/agents/tools/__tests__/google-meta-ads.test.ts src/lib/lab-engine/agents/tools/__tests__/competitor-ad-adapter.test.ts src/lib/lab-engine/agents/tools/__tests__/adapter-identity-dedup.test.ts src/lib/lab-engine/agents/tools/__tests__/fetch-verified-meta-page-ads.test.ts src/lib/lab-engine/agents/tools/__tests__/ad-language.test.ts
# 6 test files passed, 68 tests passed

npm run test:run
# 167 test files passed, 1 skipped; 1412 tests passed, 1 skipped

npm run build
# exits 0
```

Build emitted existing non-blocking warnings about stale `baseline-browser-mapping` data and the deprecated Next.js `middleware` file convention.
