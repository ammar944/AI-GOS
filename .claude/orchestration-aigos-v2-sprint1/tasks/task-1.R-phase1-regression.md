# Task 1.R: Phase 1 Regression

## Objective

Full regression test of all Phase 1 tasks. Verify fonts, tokens, system prompt, model constant, and Supabase table are all correctly in place with no v1 regressions.

## Context

This is the regression gate for Phase 1. All 5 implementation tasks (1.1–1.5) must be complete. No Phase 2 work begins until this passes.

## Dependencies

- Task 1.1 (Fonts) — complete
- Task 1.2 (Tokens) — complete
- Task 1.3 (System prompt) — complete
- Task 1.4 (Model constant) — complete
- Task 1.5 (Supabase migration) — complete

## Blocked By

- Tasks 1.1, 1.2, 1.3, 1.4, 1.5

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds with zero new errors
- [ ] `npm run lint` passes with zero new warnings

### Font Verification

- [ ] Open `src/app/layout.tsx` — confirms DM_Sans, Instrument_Sans, JetBrains_Mono imports
- [ ] Open `src/app/globals.css` — confirms `--font-sans` maps to DM Sans, `--font-mono` maps to JetBrains Mono
- [ ] No references to `Inter` or `Geist_Mono` remain in layout.tsx

### Token Verification

- [ ] `@theme inline` contains v2 background scale tokens (bg-base through bg-input)
- [ ] `@theme inline` contains v2 text hierarchy tokens (text-primary, text-secondary, text-tertiary)
- [ ] `@theme inline` contains v2 border tokens (border-subtle through border-focus)
- [ ] `@theme inline` contains v2 accent tokens (accent-blue through accent-red)
- [ ] `.dark` scope contains `--accent-red: #ef4444`
- [ ] `.dark` scope contains `--shadow-glow-blue`
- [ ] `--bg-card-blue` opacity is 0.06
- [ ] `--border-subtle` opacity is 0.06

### System Prompt Verification

- [ ] `src/lib/ai/prompts/lead-agent-system.ts` exists
- [ ] Exports `LEAD_AGENT_SYSTEM_PROMPT` and `LEAD_AGENT_WELCOME_MESSAGE`
- [ ] Can be imported: `import { LEAD_AGENT_SYSTEM_PROMPT } from '@/lib/ai/prompts/lead-agent-system'`

### Model Constant Verification

- [ ] `MODELS.CLAUDE_OPUS` exists in `src/lib/ai/providers.ts`
- [ ] Value is `'claude-opus-4-6'`

### Supabase Verification

- [ ] `journey_sessions` table exists (Supabase MCP `list_tables`)
- [ ] Insert with `user_id` only succeeds (defaults work)
- [ ] `updated_at` auto-updates on modification

### V1 Regression (Browser Testing)

- [ ] Playwright: Navigate to `/dashboard` — renders correctly, no broken styles
- [ ] Playwright: Navigate to `/generate` — renders correctly
- [ ] Playwright: Navigate to `/` — landing page renders
- [ ] Screenshot: `/dashboard` as visual evidence

## Acceptance Criteria

- [ ] All checks above pass
- [ ] No new TypeScript errors
- [ ] No visual regressions on v1 pages
- [ ] All Phase 1 deliverables verified

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 1.R:`
