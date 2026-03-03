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

## Sprint Coverage
- Sprint 1-3: Not reviewed by QA agent
- Sprint 4 Session A (fe467c0..c5ace1a): REVIEWED — PASS, no critical issues
