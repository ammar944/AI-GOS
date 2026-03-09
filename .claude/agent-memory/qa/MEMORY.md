# QA Agent Memory

## Pre-Existing Failures (Do Not Flag)
These test files have failures that predate all V2 sprint work:
- `src/components/generate/__tests__/generate-header.test.tsx` — 19/19 failing (Location type mismatch)
- `src/lib/ai/__tests__/hook-diversity-validator.test.ts` — ~8 failing
- `src/lib/storage/__tests__/local-storage.test.ts` — 1 failing (stale schema property names)
- `src/lib/ai/__tests__/keyword-prefilter.test.ts` — 1 failing (mojibake test)
- Pre-existing TS errors in same test files (stale schema fields, Location type)

## Architecture Facts (Confirmed)

### Journey Stream Route (`src/app/api/journey/stream/route.ts`)
- Registers 5 tools: `askUser`, `researchIndustry`, `researchCompetitors`, `researchICP`, `researchOffer`, `synthesizeResearch`
- `researchKeywords` is NOT registered yet — forward-declared in chat-message.tsx RESEARCH_TOOL_SECTIONS only
- Uses `toUIMessageStreamResponse()` — frontend must use `DefaultChatTransport`

### chat-message.tsx Tool Name Convention
- Tool part types arrive as `tool-researchIndustry` etc.
- `renderToolPart` strips prefix: `toolName = part.type.replace('tool-', '')`
- `RESEARCH_TOOL_SECTIONS` map uses stripped names as keys

### Research Tool Output Shape
All 5 research tools return: `{ status: 'complete'|'error', section: string, data: unknown, sources: [], durationMs: number }`
- On JSON parse failure: fallback to `{ summary: resultText }` — buildSubsectionCards returns [] for this shape (safe)
- All 4 research files have `console.error` in extraction failure path — server-side, acceptable

### intel-cards Pattern
- `AnyCardProps.allocations` is required (not optional) — `compact()` adds `allocations: []` default for all card types
- `intel-card-header.tsx` has no `'use client'` — correct (no hooks), but will need it if framer-motion is added
- `buildSubsectionCards` has top-level try/catch — UI cannot crash from malformed research JSON

## Recurring Issues to Watch
- `console.log` in route `onFinish` callback — acceptable for dev, remove pre-production
- Forward-declared tool mappings (researchKeywords) — flag as dead code until tool is registered
- Merged prop types with required fields patched by defaults — type smell, watch for expansion

## Directive Injection Pattern (route.ts)
Directives are appended to systemPrompt in this order:
1. Stage 2 Directive (competitor detection)
2. Strategist Mode guard (synthComplete)
3. Prefill Research / Research Running (isPrefillMessage)
4. Section Approved Directive (isApprovalMessage)

KEY BUG FOUND: Stage 2 + Prefill Research can both fire on Request 1 when prefill data contains competitor names. Both say "call X as FIRST action" — conflicting. Fix: guard competitor block with `!isPrefillMessage`.

`sendAutomaticallyWhen` auto-send does NOT add a new user message — `isFirstRequest` stays true across auto-send rounds.

## Pre-Existing Build Failures
- `hydrateOnboardingState` import in `session/route.ts` — export removed from `session-state.ts`, import stale
- `setProposedField` in `session-state.test.ts` — same pattern (removed export, stale test)

## Sprint Coverage
- Sprint 1-3: Not reviewed by QA agent
- Sprint 4 Session A (fe467c0..c5ace1a): REVIEWED — PASS, no critical issues
- Directive bifurcation review (4b0962b): REVIEWED — 1 critical (Stage 2 conflict), see above
