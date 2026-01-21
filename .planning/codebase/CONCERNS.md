# Codebase Concerns

**Analysis Date:** 2026-01-21

## Test Coverage Gaps

**Low test coverage relative to source code:**
- What's not tested: 163 production files (non-test) with only 16 test files (9.8% coverage ratio)
- Files: `src/components/**`, `src/app/**` (React components and API routes lack unit tests)
- Risk: UI regressions go undetected; API endpoint errors discovered late in production
- Priority: High - affects stability and maintainability
- Fix approach: Add comprehensive component tests for critical UI (`src/components/chat/**`, `src/components/strategic-blueprint/**`), add API route tests for all `/api/**` endpoints

**Missing integration tests for core flows:**
- What's not tested: End-to-end flows like blueprint generation → chat interaction → edits → approval
- Files: `src/app/generate/page.tsx` (1221 lines), `src/app/api/strategic-blueprint/generate/route.ts`
- Risk: Data pipeline breaks silently; users unaware of corrupted state
- Priority: High
- Fix approach: Create integration tests simulating complete user journeys

**Component test patterns:**
- Location: Only 16 test files total across codebase
- Affected files: All 179 source files (163 production + 16 tests)
- Why fragile: Large components are difficult to test (see below)

## Fragile Areas

**Oversized monolithic components:**
- Files:
  - `src/components/strategic-research/section-content.tsx` (1413 lines)
  - `src/components/chat/chat-sidebar.tsx` (1380 lines)
  - `src/components/chat/blueprint-chat.tsx` (1374 lines)
- Why fragile: Single component handles multiple concerns (rendering, state management, edit handling, validation). Changes to one section risk breaking unrelated sections.
- Safe modification: Extract smaller sub-components for each section type before making changes. Test in isolation.
- Test coverage: Current implementation has no dedicated tests
- Fix approach: Refactor into smaller composable components (e.g., `IndustryOverviewSection`, `CompetitorSection`, etc.) with independent test files

**State management complexity in chat components:**
- Files:
  - `src/components/chat/chat-sidebar.tsx` (lines 71-150+ state declarations)
  - `src/components/chat/blueprint-chat.tsx` (similar pattern)
- Why fragile: Multiple useState hooks managing interdependent state (messages, pendingEdits, isLoading, isStreaming, etc.). State mutations not atomic.
- Safe modification: Add state validation before each render; add tests for state transitions
- Example issue: Edit confirmation can leave pendingEdits stale if error occurs mid-confirmation
- Fix approach: Consider state machine pattern (e.g., xstate) or reducer pattern for complex chat state

**Loose TypeScript in critical areas:**
- Files: `src/lib/chat/retrieval.ts:51` uses `any` type in data mapping
- Code: `const chunks: BlueprintChunk[] = (data || []).map((row: any) => ({...}))`
- Risk: Type errors in data transformation pass silently; malformed chunks sent to LLM
- Fix approach: Create strict type for Supabase RPC response and use Zod validation

**Type safety issue in blueprint editing:**
- Files: `src/lib/strategic-blueprint/approval.ts:104` uses `as any` to bypass type checking
- Code: `(approved as any)[sectionKey] = sectionData;`
- Why needed: Dynamic section access by string key; approved blueprint type doesn't match runtime structure
- Risk: Field assignment could fail silently; edits lost
- Fix approach: Create type-safe wrapper function or use `Object.assign` with proper typing

## Performance Bottlenecks

**Large JSON parse/stringify operations:**
- Pattern: 132 occurrences of `JSON.parse` / `JSON.stringify` across codebase
- Files: `src/lib/storage/local-storage.ts`, `src/lib/strategic-blueprint/approval.ts`, `src/app/api/**`
- Problem: No streaming for large blueprints; entire object serialized/deserialized synchronously
- Impact: Blocks UI thread during blueprint generation/save; perceptible delay on slower devices
- Improvement path: Implement incremental serialization; consider protobuf or structured streaming for large objects

**Unoptimized rendering in large lists:**
- Files: `src/components/strategic-research/section-content.tsx` renders competitor lists without virtualization
- Problem: All items render regardless of viewport; 100+ competitors = hundreds of DOM nodes
- Impact: Slow scroll performance in large competitor lists
- Improvement path: Add react-window or react-virtualized for list virtualization

**SSE streaming without backpressure:**
- Files: `src/app/api/chat/blueprint/stream/route.ts`
- Problem: Server streams all chunks without respecting client buffer
- Impact: Large blueprints may overwhelm client; message loss possible
- Improvement path: Implement backpressure handling; batch chunks

**No pagination for Supabase queries:**
- Files: `src/lib/chat/retrieval.ts` retrieves chunks without limit
- Problem: Vector search returns all matches; no pagination
- Impact: Large blueprints with 1000+ chunks loaded entirely into memory
- Improvement path: Add pagination to `match_blueprint_chunks` RPC; fetch in batches

## Security Considerations

**Secrets exposed in tracked `.env.local`:**
- Risk: Repository contains actual API keys and tokens
- Files: `.env.local` (OPENROUTER_API_KEY, SUPABASE_SERVICE_ROLE_KEY, VERCEL_OIDC_TOKEN, SEARCHAPI_KEY all committed)
- Current mitigation: File is version-controlled; only private repo mitigates exposure
- Recommendations:
  - Immediately rotate all keys in `.env.local`
  - Add `.env.local` to `.gitignore`
  - Use Vercel environment variables for secrets in CI/CD
  - Audit git history for key exposure (use git-secrets)
  - Implement secrets scanning in pre-commit hooks

**Client-side storage of sensitive data:**
- Files: `src/lib/storage/local-storage.ts` stores entire blueprint in browser localStorage
- Risk: XSS vulnerability can leak all stored data; no encryption
- Current state: Blueprints may contain customer information
- Recommendations:
  - Store only blueprint IDs in localStorage; fetch full blueprint from server
  - Encrypt sensitive fields before storage
  - Add Content Security Policy headers

**Unvalidated JSON parsing from LLM:**
- Files: `src/app/api/chat/blueprint/stream/route.ts:134` - `JSON.parse(jsonMatch[1])`
- Risk: Malformed JSON crashes server; no error boundary
- Current mitigation: Try-catch block, but error logged without recovery
- Improvement: Add strict schema validation with Zod before trusting parsed data

**RAG context injection risk:**
- Files: `src/app/api/chat/blueprint/stream/route.ts:355-364` - RAG retrieval builds context without sanitization
- Risk: If vector search returns malicious chunks, they're injected into prompt
- Current mitigation: Chunks from own database, but no input sanitization
- Improvement: Add prompt injection detection; sanitize retrieved context

## Known Bugs

**Stream ended without done signal:**
- Symptoms: Chat messages don't finalize metadata; UI shows incomplete state
- Files:
  - `src/components/chat/blueprint-chat.tsx:587`
  - `src/components/chat/chat-sidebar.tsx:574`
- Comments: "Stream ended without done signal - still apply any collected metadata"
- Trigger: Network disconnect or server timeout during streaming
- Workaround: Manual page reload; data preserved in localStorage
- Fix approach: Implement timeout-based finalization; retry incomplete streams

**Silent failures in localStorage:**
- Symptoms: User loses work without notification
- Files: `src/lib/storage/local-storage.ts:36-39` catches errors but only logs
- Trigger: localStorage quota exceeded or disabled in privacy mode
- Workaround: None - data silently lost
- Fix approach: Dispatch error events; show user notification on storage failure

## Technical Debt

**Inconsistent error handling:**
- Pattern: API routes mix console.error logging with structured logging (logger.ts)
- Files:
  - `src/app/api/chat/blueprint/stream/route.ts` - console.error (line 377)
  - `src/app/api/chat/blueprint/route.ts` - mixed approaches
  - `src/lib/logger.ts` - structured logging via console (not true logger service)
- Impact: Log aggregation impossible; debugging production issues difficult
- Fix approach: Standardize on structured logger throughout; move console out of business logic

**Duplicated error types:**
- Problem: Multiple definitions of same types across files (Message, PendingEdit, etc.)
- Files:
  - `src/app/api/chat/blueprint/route.ts` - defines PendingEdit
  - `src/app/api/chat/blueprint/stream/route.ts` - redefines PendingEdit
  - `src/components/chat/chat-sidebar.tsx` - redefines PendingEdit
- Impact: Type changes require updating 3+ places; inconsistency likely
- Fix approach: Create `src/lib/chat/types.ts` with canonical definitions

**Inline markdown generation:**
- Files: `src/lib/strategic-blueprint/markdown-generator.ts` (724 lines) generates markdown via string concatenation
- Problem: Error-prone; no schema validation; hard to maintain formatting rules
- Impact: Exported PDFs/markdown may have formatting issues
- Fix approach: Use markdown builder library or template engine

**Untested ad library integration:**
- Files: `src/lib/ad-library/service.ts` - integrates with external ad library
- Problem: No mocks or tests; integration breaks silently
- Impact: Ad carousel may fail to render in production
- Fix approach: Add integration tests with mock responses; validate API contract

**RAG implementation without chunking optimization:**
- Files: `src/lib/chat/chunking.ts` (630 lines) chunks blueprints but no overlap/context windows
- Problem: Chunks are point-in-time facts, lack surrounding context
- Impact: RAG retrieval may miss relationships between concepts
- Fix approach: Add overlap windows; semantic chunking improvements

## Scaling Limits

**LocalStorage ceiling:**
- Current capacity: ~5-10MB per origin (browser-dependent)
- Limit: Large blueprints (100+ competitors + detailed analysis) approach limit
- When it breaks: Users with 50+ saved blueprints hit quota
- Scaling path: Implement IndexedDB for larger storage; sync to server for backups

**In-memory blueprint processing:**
- Current: Entire blueprint loaded in memory during generation
- Limit: 200+ competitor analysis generates 2-5MB blueprint
- When it breaks: Concurrent requests exhaust server memory
- Scaling path: Implement streaming generation; store sections as they're generated

**API key sharing across all users:**
- Current: Single OPENROUTER_API_KEY for all requests
- Limit: Rate limits hit at 100+ concurrent users
- When it breaks: "Too Many Requests" errors; generation fails
- Scaling path: Implement per-user rate limiting; API key pooling

**Vector search without indexing:**
- Current: `match_blueprint_chunks` RPC on unindexed table
- Limit: Linear scan on 10k+ chunks
- When it breaks: 100+ concurrent RAG queries timeout
- Scaling path: Add database index on embedding column; use pgvector extension

## Dependencies at Risk

**Single-source OpenRouter API:**
- Package: openrouter API client (custom implementation)
- Risk: No fallback provider; single point of failure for blueprint generation
- Current mitigation: Circuit breaker pattern (good), exponential backoff
- Migration plan: Implement provider abstraction; add Anthropic Claude as fallback
- Files: `src/lib/openrouter/client.ts`, `src/lib/openrouter/circuit-breaker.ts`

**Supabase coupling:**
- Packages: `@supabase/supabase-js`, `@supabase/ssr`
- Risk: Database operations hardcoded to Supabase; migration difficult
- Migration plan: Create database adapter layer before scaling
- Files: `src/lib/supabase/**`, `src/lib/chat/retrieval.ts`

**html2pdf.js limitation:**
- Package: `html2pdf.js@0.12.1`
- Risk: Outdated library; no maintenance; PDF generation may fail on complex HTML
- Current issue: PDF export uses this; failures cause silent drops
- Migration plan: Evaluate puppeteer or pdfkit for production use
- Files: `src/components/strategic-blueprint/pdf-export-content.tsx`

## Missing Critical Features

**No authentication UI:**
- Problem: Login exists but no auth state display
- Blocks: Multi-user scenarios; no user profiles
- Files: `src/app/login/**` (basic auth only)
- Priority: Medium - likely needed for production

**No data persistence strategy:**
- Problem: Blueprints stored in localStorage; no server-side state recovery
- Blocks: Multi-device usage; shared workspace collaboration
- Files: `src/lib/storage/local-storage.ts` only
- Priority: High - critical for real usage

**No audit logging:**
- Problem: No record of what edits were made, by whom, when
- Blocks: Compliance requirements; debugging production issues
- Priority: Medium - needed for enterprise features

**No rate limiting on API routes:**
- Problem: No per-user or global rate limits
- Blocks: Protection against abuse
- Priority: High - security concern
- Files: All `/api/**` routes
- Fix approach: Implement middleware using token bucket or sliding window

---

*Concerns audit: 2026-01-21*
