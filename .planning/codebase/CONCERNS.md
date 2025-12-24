# Codebase Concerns

**Analysis Date:** 2025-12-24

## Tech Debt

**Missing Test Coverage:**
- Issue: Zero test files in the entire codebase
- Files: All of `src/lib/`, `src/app/api/`, `src/components/`
- Why: MVP development prioritized features over tests
- Impact: No automated verification, regression risks, refactoring is dangerous
- Fix approach: Add Vitest + React Testing Library, prioritize critical paths (JSON extraction, validation)

**Hardcoded AI Model Temperatures:**
- Issue: Temperature values embedded in generator code
- Files: `src/lib/media-plan/pipeline/media-plan-generator.ts` (0.4), `src/lib/strategic-blueprint/pipeline/strategic-blueprint-generator.ts` (0.3)
- Why: Quick implementation
- Impact: Can't tune model behavior without code changes
- Fix approach: Extract to configuration constants or environment variables

**No Structured Logging:**
- Issue: Using console.log/error throughout, no structured logging
- Files: All API routes and generators
- Why: Development convenience
- Impact: Hard to correlate errors in production, no log aggregation
- Fix approach: Add structured logging (e.g., pino) with request context

## Known Bugs

**No bugs documented at this time.**

Review recent commits and user feedback for emerging issues.

## Security Considerations

**Environment Variable Access Without Validation:**
- Risk: Non-null assertion (`!`) on env vars could cause runtime crashes if missing
- Files: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`
- Current mitigation: None - assumes env vars always present
- Recommendations: Add startup validation or use a config loader with defaults

**Type Assertions Without Runtime Validation:**
- Risk: API request bodies are cast to expected types without full runtime validation
- Files: `src/app/api/media-plan/generate/route.ts`, `src/app/api/strategic-blueprint/generate/route.ts`
- Current mitigation: Partial validation via discriminator functions
- Recommendations: Add Zod schemas for complete runtime validation

**TypeScript Suppressions in Critical Code:**
- Risk: `@ts-expect-error` bypasses type checking for dynamic section assignment
- Files: `src/lib/media-plan/pipeline/media-plan-generator.ts` (line ~529), `src/lib/strategic-blueprint/pipeline/strategic-blueprint-generator.ts` (line ~513)
- Current mitigation: None
- Recommendations: Refactor to use properly typed accumulators or Record types

**Silent Error Handling in Storage:**
- Risk: localStorage operations silently return null on errors, no user feedback
- File: `src/lib/storage/local-storage.ts`
- Current mitigation: Callers must handle null values
- Recommendations: Add error reporting or recovery prompts

## Performance Bottlenecks

**No Per-Section Timeouts in Generators:**
- Problem: 11-section media plan generation has single 5-minute timeout
- Files: `src/app/api/media-plan/full-plan/route.ts`, `src/lib/media-plan/pipeline/media-plan-generator.ts`
- Measurement: Each section gets ~27 seconds average (300s / 11)
- Cause: Global timeout, no individual safeguards
- Improvement path: Add per-section timeout with retry or partial result return

**No Retry Logic at API Layer:**
- Problem: Transient failures cause full request failure
- Files: All API routes
- Cause: Direct calls to generators without retry wrapper
- Improvement path: Add exponential backoff retry for OpenRouter calls

**Sequential Section Generation:**
- Problem: Media plan sections generated one-by-one sequentially
- File: `src/lib/media-plan/pipeline/media-plan-generator.ts`
- Measurement: Not profiled, but likely 30-60 seconds total
- Cause: Sections depend on accumulated context
- Improvement path: Parallelize independent sections where possible

## Fragile Areas

**JSON Extraction from AI Responses:**
- File: `src/lib/openrouter/client.ts` (extractJSON function, ~65 lines)
- Why fragile: 6 different extraction strategies, any could fail with model changes
- Common failures: Unexpected markdown formatting, partial JSON responses
- Safe modification: Add tests for each strategy before changing
- Test coverage: None

**Supabase Session Middleware Chain:**
- File: `src/middleware.ts`, `src/lib/supabase/middleware.ts`
- Why fragile: Silent error handling in cookie operations
- Common failures: Session refresh failures, stale cookies
- Safe modification: Add logging before changes
- Test coverage: None

## Scaling Limits

**LocalStorage for Large Data:**
- Current capacity: ~5-10MB per domain (browser limit)
- Limit: Media plan JSON could be hundreds of KB per plan
- Symptoms at limit: Silent storage failure, data loss
- Scaling path: Add size validation, consider IndexedDB or server-side storage

**OpenRouter Rate Limits:**
- Current capacity: Depends on tier (not documented)
- Limit: Unknown without monitoring
- Symptoms at limit: 429 errors, failed generations
- Scaling path: Add rate limiting awareness, queue system for high traffic

## Dependencies at Risk

**No high-risk dependencies detected.**

All major dependencies (Next.js, React, Supabase, Radix UI) are actively maintained and current versions.

## Missing Critical Features

**Error Tracking/Monitoring:**
- Problem: No Sentry or similar error tracking
- Current workaround: Console logs, user reports
- Blocks: Production debugging, proactive issue detection
- Implementation complexity: Low (Sentry SDK integration)

**Structured API Error Responses:**
- Problem: Generic error messages returned to client
- Current workaround: Console logging on server
- Blocks: Client-side error handling, user-friendly messages
- Implementation complexity: Low (standardize error response format)

**Rate Limiting:**
- Problem: No request rate limiting on API routes
- Current workaround: None
- Blocks: Protection against abuse, cost control
- Implementation complexity: Medium (add middleware or edge function)

## Test Coverage Gaps

**JSON Extraction Logic (Critical):**
- What's not tested: `extractJSON()` in `src/lib/openrouter/client.ts`
- Risk: JSON parsing failures break all AI responses
- Priority: High
- Difficulty to test: Medium (need mock AI responses for each strategy)

**Input Validation Functions (Critical):**
- What's not tested: `validateNicheForm()`, `validateBriefingForm()` in route handlers
- Risk: Invalid data passes to AI, wasted API costs
- Priority: High
- Difficulty to test: Low (pure functions)

**Pipeline Stage Functions (High):**
- What's not tested: extract.ts, research.ts, logic.ts, synthesize.ts
- Risk: Stage failures not caught until production
- Priority: High
- Difficulty to test: Medium (need to mock OpenRouter client)

**Storage Operations (Medium):**
- What's not tested: `src/lib/storage/local-storage.ts`
- Risk: Data persistence issues
- Priority: Medium
- Difficulty to test: Low (mock localStorage)

---

*Concerns audit: 2025-12-24*
*Update as issues are fixed or new ones discovered*
