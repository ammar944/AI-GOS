# T4 Review Bodies Evidence

Date: 2026-06-04
Branch: feat/research-quality-truthgate

## What changed

- Added `mode: "bodies"` to `src/lib/lab-engine/agents/tools/reviews.ts`.
- Body mode discovers review/forum URLs through SearchAPI, then performs bounded Firecrawl v2 scrapes with `blockAds: true`.
- Added G2, Trustpilot, and generic review-body extraction.
- Body mode returns a non-consuming content gap when Firecrawl yields no usable review body; it does not silently promote SERP snippets.
- Snippet mode remains the default compatibility path.
- VoC prepass calls `reviews` with `mode: "bodies"`.
- VoC only promotes `reviewText` from reviews output into review candidates, so SERP snippets cannot satisfy the review-body path.

## Gates

- `pnpm vitest run src/lib/lab-engine/agents/tools/__tests__/reviews.test.ts src/lib/lab-engine/agents/tools/__tests__/serp-shim-descriptions.test.ts src/lib/lab-engine/agents/__tests__/run-section-voice-of-customer-candidates.test.ts src/lib/lab-engine/artifacts/schemas/__tests__/voice-of-customer.test.ts`
  - 4 files passed
  - 25 tests passed
- `pnpm exec tsc --noEmit`
  - exit 0
- `pnpm run test:run`
  - 174 files passed
  - 1477 tests passed
  - 1 skipped
- `pnpm run build`
  - compiled successfully
  - TypeScript clean
- `pnpm run lint`
  - exit 0
  - 0 errors
  - 32 existing warnings

## Review

- Read-only QA re-review verdict: GO for T4 behavior.
- QA confirmed body mode no longer silently promotes SearchAPI SERP snippets into VoC when Firecrawl does not yield usable review bodies.

## Pending

- Live Ramp gate is still pending.
- T4 should not be marked fully done until a live run produces verbatim VoC quotes across at least 3 independent domains or commits an honest evidence-gap artifact.
