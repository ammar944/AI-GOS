# Sprint 2: Conversational Onboarding — Execution Protocol

**Branch**: `aigos-v2`
**Authority**: DISCOVERY.md overrides everything
**Master Plan**: PHASES.md
**Progress**: PROGRESS.md

---

## Pre-Flight Checklist

Before starting execution:

- [ ] Verify branch: `git branch` → should be `aigos-v2`
- [ ] Verify build: `npm run build` → should pass (clean baseline)
- [ ] Verify dev server works: `npm run dev` → `http://localhost:3000/journey` loads
- [ ] Read DISCOVERY.md — all 24 decisions

---

## Execution Waves

Tasks within a wave can be executed in PARALLEL. Waves must be sequential.

### Wave 1: Foundation (Phase 1)

**Parallel tasks**: 1.1 + 1.2 (independent)

| Agent | Task | File | Action |
|-------|------|------|--------|
| Agent A | 1.1 | `src/lib/ai/tools/ask-user.ts` | CREATE askUser tool |
| Agent B | 1.2 | `src/lib/journey/session-state.ts` | CREATE OnboardingState + helpers |

**Then sequential**: 1.3 (depends on 1.2)

| Agent | Task | File | Action |
|-------|------|------|--------|
| Agent A | 1.3 | `src/lib/storage/local-storage.ts` | EXTEND with JOURNEY_SESSION |

**Then regression**: 1.R

| Agent | Task | Tests |
|-------|------|-------|
| Agent A | 1.R | `npm run build` + `npm run lint` + file verification + Playwright smoke |

**Gate**: Phase 1 must pass before proceeding.

---

### Wave 2: Backend + Frontend Components (Phase 2 + 3 in PARALLEL)

**KEY INSIGHT**: Phase 2 and Phase 3 have NO cross-dependencies. They both depend only on Phase 1 outputs. Run them in parallel.

**Phase 2 track** (sequential within):

| Agent | Task | File | Action |
|-------|------|------|--------|
| Agent A | 2.1 | `src/app/api/journey/stream/route.ts` | MODIFY: add tools, stepCountIs, body.messages extraction |
| Agent A | 2.2 | `src/lib/ai/prompts/lead-agent-system.ts` | MODIFY: onboarding instructions + welcome message |
| Agent A | 2.R | — | Regression: build + lint + Playwright |

**Phase 3 track** (3.1-3.3 parallel, then 3.R):

| Agent | Task | File | Action |
|-------|------|------|--------|
| Agent B | 3.1 | `src/components/journey/ask-user-card.tsx` | CREATE AskUserCard component |
| Agent C | 3.2 | `src/components/chat/thinking-block.tsx` | MODIFY: add state prop, timer, blue border |
| Agent D | 3.3 | `src/components/journey/journey-header.tsx` | MODIFY: add progress bar |
| Agent B | 3.R | — | Regression: build + lint + Playwright |

**Gate**: Both Phase 2 and Phase 3 must pass before proceeding.

---

### Wave 3: Integration (Phase 4)

**Sequential**: 4.1 → 4.2 → 4.R

| Agent | Task | File | Action |
|-------|------|------|--------|
| Agent A | 4.1 | `src/components/journey/chat-message.tsx` | MODIFY: render AskUserCard + pass state to ThinkingBlock |
| Agent A | 4.2 | `src/app/journey/page.tsx` | MODIFY: wire addToolOutput + hydration + progress |
| Agent A | 4.R | — | Full integration test via Playwright |

**Gate**: Phase 4 must pass before proceeding.

---

### Wave 4: E2E Testing (Phase 5)

**Parallel**: 5.1 + 5.3, then 5.2 (depends on 5.1)

| Agent | Task | Description |
|-------|------|-------------|
| Agent A | 5.1 | Happy path: full onboarding flow |
| Agent B | 5.3 | Regression: existing pages |

**Then**:

| Agent | Task | Description |
|-------|------|-------------|
| Agent A | 5.2 | Edge cases: Other, multi-select, reload, rapid click |

**Gate**: All Phase 5 tasks pass = Sprint 2 COMPLETE.

---

## Agent Instructions

### Before Starting Any Task

1. **Read the task file**: `.claude/orchestration-sprint2-onboarding/tasks/task-X.X.md`
2. **Read listed skills**: Each task file has a "Skills to Read" section — read those skill files first
3. **Read listed research files**: Each task file has a "Research Files to Read" section
4. **Read PROGRESS.md**: Check what's already done, verify dependencies are met
5. **Read existing source files**: The task file lists files to modify — read them first to understand current code

### While Implementing

1. **Follow contracts exactly**: Types, function signatures, export names must match the task spec
2. **Use design tokens**: All colors via CSS variables (`--accent-blue`, `--text-tertiary`, etc.) — never hardcode colors
3. **Preserve existing code**: When modifying files, keep all existing functionality intact
4. **Use v6 APIs only**: `addToolOutput` (not `addToolResult`), `stepCountIs` (not `maxSteps`), `tool()` from `ai`
5. **DISCOVERY.md is authority**: If a task file contradicts DISCOVERY.md, DISCOVERY.md wins

### After Completing a Task

1. **Run `npm run build`**: Must pass — fix any type errors
2. **Commit**: `git add <files>` then `git commit -m "Task X.X: <description>"`
3. **Update PROGRESS.md**: Mark task as COMPLETE with commit hash

### For Regression Tasks (X.R)

1. Run `npm run build` + `npm run lint`
2. Start dev server if not running: `npm run dev`
3. Run all Playwright checks from the task file
4. Fix any failures found — rebuild, retest
5. Mark phase as complete in PROGRESS.md

---

## Critical Reminders

- **D9 (REVISED)**: Interactive tool results are NOT in `onFinish.steps`. Extract from `body.messages` at the start of POST.
- **D6**: `stepCountIs(15)` NOT `maxSteps: 15`. `addToolOutput` NOT `addToolResult`.
- **D18**: askUser tool has NO `execute` function.
- **D7**: `sendAutomaticallyWhen` = `lastAssistantMessageIsCompleteWithToolCalls` OR `lastAssistantMessageIsCompleteWithApprovalResponses`.
- **D22**: Supabase failures = silent fail. Never block the conversation.
- **D4**: ThinkingBlock collapsed by default. No auto-expand.
- **D16**: No voice input, no background research, no URL scraping, no two-column layout, no session resume.

---

## File Manifest

### Files to CREATE (3)

| File | Task | Description |
|------|------|-------------|
| `src/lib/ai/tools/ask-user.ts` | 1.1 | askUser tool definition |
| `src/lib/journey/session-state.ts` | 1.2 | OnboardingState + persistence helpers |
| `src/components/journey/ask-user-card.tsx` | 3.1 | AskUser chip card component |

### Files to MODIFY (6)

| File | Task(s) | Changes |
|------|---------|---------|
| `src/lib/storage/local-storage.ts` | 1.3 | Add JOURNEY_SESSION key + helpers |
| `src/app/api/journey/stream/route.ts` | 2.1 | Add tools, stepCountIs, body.messages extraction |
| `src/lib/ai/prompts/lead-agent-system.ts` | 2.2 | Onboarding instructions + welcome message |
| `src/components/chat/thinking-block.tsx` | 3.2 | Add state prop, timer, blue border |
| `src/components/journey/journey-header.tsx` | 3.3 | Add progress bar |
| `src/components/journey/chat-message.tsx` | 4.1 | Render AskUserCard + pass state to ThinkingBlock |
| `src/app/journey/page.tsx` | 4.2 | Wire addToolOutput + hydration + progress |
