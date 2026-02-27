# Task 1.R: Phase 1 Regression

## Objective

Verify all Phase 1 outputs compile correctly, new files exist, and the existing app is not broken.

## Context

Phase 1 created 2 new files and modified 1 existing file. This regression task ensures everything compiles, the new types/exports work, and no regressions were introduced.

## Dependencies

- Task 1.1, Task 1.2, Task 1.3 — all must be complete

## Blocked By

- Tasks 1.1, 1.2, 1.3

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` passes — all routes compile, no type errors
- [ ] `npm run lint` passes

### File Verification

- [ ] `src/lib/ai/tools/ask-user.ts` exists and exports `askUser`
- [ ] `src/lib/journey/session-state.ts` exists and exports `OnboardingState`, `calculateCompletion`, `extractAskUserResults`, `persistToSupabase`, `createEmptyState`
- [ ] `src/lib/storage/local-storage.ts` has `JOURNEY_SESSION` in STORAGE_KEYS and exports `getJourneySession`, `setJourneySession`, `clearJourneySession`

### Browser Smoke Test (Playwright MCP)

- [ ] Start dev server: `npm run dev`
- [ ] Navigate to `http://localhost:3000/journey` — page loads without console errors
- [ ] Send a message — agent responds (basic streaming still works)
- [ ] Navigate to `http://localhost:3000/dashboard` — page loads (regression check)

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 1.R:`
