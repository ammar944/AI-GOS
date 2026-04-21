# Task 4.3: Build, Lint, Deploy Verification

## Objective

Final build, lint, test, and deployment readiness verification for the complete Sprint 1 implementation. Confirms the codebase is clean, production-ready, and deployable to Vercel without issues. This is the final gate before Sprint 1 is considered complete.

## Context

Phase 4 final task. This runs after Tasks 4.1 (E2E flow) and 4.2 (V1 regression) have passed. It focuses on toolchain verification: TypeScript compilation, ESLint conformance, Vitest test suite, bundle analysis, environment variable requirements, and Vercel deployment constraints. No browser testing in this task — that was covered by 4.1 and 4.2.

## Dependencies

- Task 4.1 (Full User Flow E2E) — must pass
- Task 4.2 (V1 Regression Suite) — must pass
- All Phases 1-3 complete

## Blocked By

- Tasks 4.1 and 4.2

## Implementation Plan

This task is a verification plan, not an implementation task. Execute the following checks sequentially.

### Check 1: TypeScript Build (`npm run build`)

1. Run `npm run build` in the project root
2. Verify the build completes successfully with exit code 0
3. Analyze build output for:
   - **Zero new TypeScript errors**: Pre-existing errors in test files (openrouter tests, chat blueprint tests) are acceptable and documented in CLAUDE.md. No NEW errors from Sprint 1 code.
   - **Zero new warnings**: No unused variable warnings, no missing return type warnings from new code
   - **All pages compile**: Verify the build output lists `/journey` as a compiled page alongside existing pages (`/`, `/dashboard`, `/generate`, `/sign-in`)
   - **API routes compile**: Verify `/api/journey/stream` compiles alongside existing API routes
4. Record the full build output for evidence

### Check 2: ESLint (`npm run lint`)

1. Run `npm run lint` in the project root
2. Verify lint passes with exit code 0
3. Analyze lint output for:
   - **Zero new warnings**: No ESLint warnings from files created or modified in Sprint 1
   - **Zero new errors**: No ESLint errors from Sprint 1 code
   - Pre-existing lint issues in legacy code are acceptable
4. If lint fails, identify the specific rule and file, fix, and re-run
5. Record the lint output for evidence

### Check 3: Vitest Test Suite (`npm run test:run`)

1. Run `npm run test:run` in the project root
2. Verify all existing tests pass:
   - No test failures caused by Sprint 1 changes
   - Pre-existing test failures (if any documented) are acceptable
3. Analyze test output for:
   - Total tests run, passed, failed, skipped
   - Any test files that reference modified shared modules (providers.ts, globals.css, layout.tsx) still pass
4. If any tests fail due to Sprint 1 changes:
   - Identify the root cause (missing mock, changed export, modified shared module)
   - Fix the test or the source code
   - Re-run and verify all pass
5. Record the test output for evidence

### Check 4: TypeScript Strict Mode Verification

1. Run `npx tsc --noEmit` to check TypeScript without building
2. Verify no new type errors in Sprint 1 files:
   - `src/components/journey/*.tsx` — all journey components
   - `src/app/journey/page.tsx` — journey page
   - `src/app/api/journey/stream/route.ts` — API route
   - `src/lib/ai/prompts/lead-agent-system.ts` — system prompt
   - `src/lib/ai/providers.ts` — model constant (modified file)
   - `src/app/layout.tsx` — root layout (modified file)
   - `src/app/globals.css` — styles (CSS file, not type-checked, but verify no Tailwind config errors)
3. Verify that type exports are clean:
   - Props interfaces are exported correctly
   - No `any` types introduced in Sprint 1 code
   - Zod schemas (if any) validate at compile time

### Check 5: Bundle Size Analysis

1. After a successful build, check the `.next` output for bundle size:
   - Run `ls -la .next/static/chunks/` to get chunk sizes
   - Or check the `npm run build` output which reports page sizes
2. Verify no unexpected large additions:
   - DM Sans font files: reasonable (Google Fonts via next/font are optimized, typically 20-50KB per weight)
   - JetBrains Mono font files: reasonable (similar size range)
   - Instrument Sans: already existed, no change expected
   - Journey components: should be small (few KB total, simple React components)
   - Framer Motion: already in the bundle (used by v1), no new addition
   - No new large dependencies introduced
3. Compare the journey page bundle size to existing pages:
   - `/journey` should be comparable to or smaller than `/generate` (which has more components)
4. Flag if any single chunk exceeds 500KB that wasn't present before Sprint 1

### Check 6: Environment Variable Verification

1. Verify that Sprint 1 requires NO new environment variables beyond what already exists:
   - `ANTHROPIC_API_KEY` — already required for v1 (Claude Sonnet for chat agent, synthesis)
   - No new API keys, no new secrets, no new public env vars
2. Verify that the journey API route uses the existing Anthropic provider:
   - Check `src/app/api/journey/stream/route.ts` imports from `@ai-sdk/anthropic`
   - Model `claude-opus-4-6` uses the same `ANTHROPIC_API_KEY` as existing models
3. Verify no hardcoded secrets or API keys in Sprint 1 code:
   - Search all new/modified files for patterns like `sk-`, `key=`, hardcoded tokens
   - Ensure all sensitive values come from environment variables

### Check 7: Vercel Deployment Constraints

1. Verify `maxDuration = 300` is exported from the journey stream route:
   - Check `src/app/api/journey/stream/route.ts` for `export const maxDuration = 300`
   - This is required for Vercel Pro tier to allow long-running streaming responses
2. Verify the route exports are correct for Vercel serverless:
   - `export async function POST(request: Request)` — correct handler signature
   - No default export (App Router uses named exports)
3. Verify no server-side code leaks into client bundles:
   - Journey components marked with `'use client'` should not import server-only modules
   - API route should not be imported by any client component
4. Verify the journey page is compatible with Vercel's edge/serverless model:
   - Page is a client component (renders in browser)
   - API route is a serverless function (runs on server)
   - No unsupported Node.js APIs (fs, child_process, etc.) in client components

### Check 8: Tree-Shaking and Side Effects

1. Verify journey components have no side effects on import:
   - Components should not execute code at module scope (beyond `'use client'` directive)
   - No global variable mutations
   - No `window` or `document` access at import time (only inside hooks/effects)
2. Verify barrel exports (if any) are tree-shakeable:
   - If `src/components/journey/index.ts` exists, verify it uses named re-exports
   - No `export *` that might prevent tree-shaking
3. Verify no circular dependencies:
   - Journey components should not import from each other in a circular pattern
   - API route should not import from client components
   - System prompt file should be a leaf module (no imports beyond type references)

### Check 9: Circular Dependency Check

1. Check for circular dependencies in the journey module graph:
   - `src/components/journey/*.tsx` — verify no component imports another in a cycle
   - `src/app/journey/page.tsx` — verify it imports components, not the reverse
   - `src/app/api/journey/stream/route.ts` — verify it imports from lib, not from components
2. Check that modified shared files don't create new cycles:
   - `src/lib/ai/providers.ts` — adding CLAUDE_OPUS should not create new import paths
   - `src/app/layout.tsx` — font changes should not add new dependencies

### Check 10: Git Status and Branch Verification

1. Run `git status` on the `aigos-v2` branch
2. Verify:
   - All Sprint 1 changes are committed
   - No untracked Sprint 1 files left uncommitted
   - Working tree is clean for Sprint 1 deliverables
   - Branch is `aigos-v2` (not accidentally on main or another branch)
3. Run `git log --oneline -20` to verify:
   - Sprint 1 commits are present with appropriate prefixes (Task 1.1:, Task 2.3:, etc.)
   - Commit history is clean and logical
4. Verify the branch can be merged cleanly:
   - Run `git diff main...aigos-v2 --stat` to see all changed files
   - Verify only expected files are modified/created
   - No unexpected deletions or modifications to v1 core files

## Acceptance Criteria

- [ ] `npm run build` succeeds with zero new errors (exit code 0)
- [ ] `npm run lint` passes with zero new warnings (exit code 0)
- [ ] `npm run test:run` passes — all existing tests still green
- [ ] `npx tsc --noEmit` produces no new TypeScript errors in Sprint 1 files
- [ ] No unexpected large bundle additions (fonts are reasonable, no new heavy dependencies)
- [ ] No new environment variables required — only existing `ANTHROPIC_API_KEY`
- [ ] `maxDuration = 300` exported on `/api/journey/stream` route
- [ ] All journey components tree-shake correctly (no side effects on import)
- [ ] No circular dependency warnings in the journey module graph
- [ ] No hardcoded secrets or API keys in Sprint 1 code
- [ ] All Sprint 1 changes committed on `aigos-v2` branch
- [ ] Branch diff shows only expected file changes (no accidental v1 modifications)
- [ ] Vercel deployment constraints met (correct exports, no server/client leaks, maxDuration set)

## Testing Protocol

### Prerequisites

- [ ] Tasks 4.1 and 4.2 have passed
- [ ] All Sprint 1 code is committed on `aigos-v2` branch

### Execution

All checks are run via command line (Bash tool):

1. **Build**: `npm run build` — capture full output
2. **Lint**: `npm run lint` — capture full output
3. **Test**: `npm run test:run` — capture full output
4. **Type check**: `npx tsc --noEmit` — capture output
5. **Bundle analysis**: Inspect build output page sizes and `.next/static/chunks/`
6. **Env var check**: Grep Sprint 1 files for hardcoded keys or new env var references
7. **maxDuration check**: Read the route file and verify export
8. **Side effect check**: Read component files, verify no module-scope side effects
9. **Circular dep check**: Trace import graph of journey modules
10. **Git status**: `git status`, `git log`, `git diff main...aigos-v2 --stat`

### Evidence Collection

For each check, capture:
- Command output (build log, lint log, test results)
- Pass/fail determination with specific evidence
- Any issues found and their resolution

### Pass/Fail Criteria

- **PASS**: All 13 acceptance criteria met. Sprint 1 is deployment-ready.
- **FAIL**: Any critical criterion not met (build fails, lint errors, test failures, missing maxDuration). Must fix before Sprint 1 is considered complete.
- **PARTIAL**: Minor issues that do not block deployment (e.g., a pre-existing lint warning, a slightly larger than expected chunk). Document and proceed.

### Final Sign-Off

When all checks pass:
1. Record final build output as evidence
2. Record final git status showing clean working tree
3. Record git diff stat showing all Sprint 1 changes
4. Sprint 1 is complete and ready for merge to main

## Skills to Read

- None specific (this is a verification task)

## Research Files to Read

- `.claude/orchestration-aigos-v2-sprint1/PHASES.md` — Phase 4 and deployment expectations
- `CLAUDE.md` — Build commands, deployment info, environment variables

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 4.3:`
- Note: This task should produce no code changes if everything passes. If issues are found during verification, fix them and commit with descriptive messages. The final state of the branch after this task should be clean and deployment-ready.
