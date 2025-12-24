---
phase: 02-timeout-retry
plan: 01
type: summary
completed: 2025-12-25
---

# Summary: Timeout and Exponential Backoff

## What Was Done

### Task 1: Timeout Wrapper for OpenRouter Client
- Created `TimeoutError` class extending Error with `timeout` property
- Created `APIError` class extending Error with `status` property for retry classification
- Added `timeout` option to `ChatCompletionOptions` interface (default: 45000ms)
- Modified `chat()` method to use AbortController with setTimeout
- Properly clears timeout on success and throws `TimeoutError` on timeout

### Task 2: Exponential Backoff Retry
- Added `sleep(ms)` helper function for async delays
- Added `calculateBackoff(attempt, baseDelay, maxDelay)` function
  - Formula: min(baseDelay * 2^attempt + jitter, maxDelay)
  - Jitter: random 0-500ms to prevent thundering herd
- Added `isRetryableError()` function for error classification:
  - `TimeoutError`: RETRY (transient)
  - 429 Too Many Requests: RETRY with longer backoff (5s base, 30s max)
  - 5xx Server Errors: RETRY (transient)
  - 4xx Client Errors (except 429): NO RETRY (permanent)
  - Parse/validation errors: RETRY (AI might fix)
- Updated `chatJSONValidated()` and `chatJSON()` with exponential backoff

### Task 3: Slow Section Detection
- Added timing configuration constants:
  - `SECTION_TIMEOUT_MS = 45000` (45 seconds)
  - `SLOW_SECTION_THRESHOLD_MS = 30000` (30 seconds)
- Updated `MediaPlanGeneratorResult.metadata` to include:
  - `slowSections: string[]` - sections exceeding threshold
  - `averageSectionTime: number` - average time per section in ms
- Added slow section logging with `console.warn`
- Pass timeout option to OpenRouter client calls
- Added generation summary log on completion

## Files Changed

1. **src/lib/openrouter/client.ts**
   - Added: `TimeoutError`, `APIError` classes
   - Added: `sleep()`, `calculateBackoff()`, `isRetryableError()` helpers
   - Modified: `chat()`, `chatJSON()`, `chatJSONValidated()` with timeout and backoff

2. **src/lib/media-plan/pipeline/media-plan-generator.ts**
   - Added: Timing configuration constants
   - Modified: `MediaPlanGeneratorResult` interface
   - Added: Slow section detection and logging
   - Added: Timeout passed to AI calls
   - Added: Generation summary logging

## Decisions Made

- Used native `AbortController` and `setTimeout` (no external libraries)
- 45s timeout per section matches typical AI response times with buffer
- 30s slow threshold catches sections taking notably longer
- Rate limit errors (429) get longer backoff (5s base vs 1s base)
- Validation errors are retryable since AI might produce valid JSON on retry

## Verification

- [x] `npx tsc --noEmit` passes
- [x] `npm run build` succeeds
- [x] TimeoutError properly thrown on timeout
- [x] Exponential backoff delays calculated correctly
- [x] No breaking changes to existing API

## Next Steps

Continue with 02-02-PLAN.md to add circuit breaker pattern for resilient generation.
