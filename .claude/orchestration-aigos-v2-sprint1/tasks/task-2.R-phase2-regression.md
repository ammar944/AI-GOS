# Task 2.R: Phase 2 Regression

## Objective

Full regression test of all Phase 2 UI components. Verify all 5 components build, render correctly, and don't break existing v1 pages.

## Context

Regression gate for Phase 2. All implementation tasks (2.1–2.5) must be complete. No Phase 3 work begins until this passes.

## Dependencies

- Task 2.1 (Journey Layout) — complete
- Task 2.2 (Journey Header) — complete
- Task 2.3 (Chat Message) — complete
- Task 2.4 (Chat Input) — complete
- Task 2.5 (Streaming Cursor + Typing Indicator) — complete

## Blocked By

- Tasks 2.1, 2.2, 2.3, 2.4, 2.5

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds with zero new errors
- [ ] `npm run lint` passes with zero new warnings

### Component Import Verification

- [ ] `import { JourneyLayout } from '@/components/journey/journey-layout'` — resolves
- [ ] `import { JourneyHeader } from '@/components/journey/journey-header'` — resolves
- [ ] `import { ChatMessage } from '@/components/journey/chat-message'` — resolves
- [ ] `import { JourneyChatInput } from '@/components/journey/chat-input'` — resolves
- [ ] `import { StreamingCursor } from '@/components/journey/streaming-cursor'` — resolves
- [ ] `import { TypingIndicator } from '@/components/journey/typing-indicator'` — resolves

### Component File Verification

- [ ] All files in `src/components/journey/` follow conventions (kebab-case, named exports, Props interfaces)
- [ ] All interactive components have 'use client' directive
- [ ] All components use `cn()` utility
- [ ] All components use CSS variables via inline `style` (follows codebase pattern)

### V1 Regression

- [ ] Playwright: Navigate to `/dashboard` — renders correctly
- [ ] Playwright: Navigate to `/generate` — renders correctly
- [ ] No new import side effects from journey components

## Acceptance Criteria

- [ ] All checks above pass
- [ ] 6 components created in `src/components/journey/`
- [ ] No TypeScript errors
- [ ] No visual regressions on v1 pages

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 2.R:`
