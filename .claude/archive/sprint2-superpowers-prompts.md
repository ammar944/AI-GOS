# Sprint 2: Remaining Task Prompts for Claude Code + Superpowers

**Status**: Phase 1 (Foundation) and Phase 2 (Backend) are COMPLETE.
**Remaining**: Tasks 3.1 → 5.3 (10 tasks across Phases 3, 4, 5)
**Workflow**: Each task = separate Claude Code session with Superpowers installed.
**Branch**: `aigos-v2`

> **How to use**: Copy the prompt for a task into a fresh Claude Code session. Superpowers will automatically kick in via SessionStart hook. Additionally, each prompt below includes explicit `Skill()` invocations that you should run at the start of the session to activate the relevant Superpowers features for that task.

> **Superpowers install** (if not already installed):
> ```
> /plugin marketplace add obra/superpowers-marketplace
> /plugin install superpowers@superpowers-marketplace
> ```

---

## Task 3.1: AskUser Card Component (IN PROGRESS — was interrupted)

> **Note**: This component was partially built in a prior session. File exists at `src/components/journey/ask-user-card.tsx` (536 lines). Review what exists first — it may be complete and just needs verification, or it may need fixes.

```
I'm working on AI-GOS v2 Sprint 2 — conversational onboarding. I need to verify and potentially fix the AskUserCard component.

## Superpowers Skills — Invoke These First
Run each of these at the start of this session:
- Skill(superpowers:subagent-driven-development) — THIS IS PRIMARY. Use agent teams to orchestrate subtasks. Each subagent gets a fresh context with a clear spec. Agents communicate through agent teams for handoffs and status.
- Skill(superpowers:verification-before-completion) — verify every acceptance criterion with evidence before marking done
- Skill(superpowers:systematic-debugging) — use 4-phase root cause analysis if any issues found
- Skill(superpowers:writing-plans) — create a verification plan before diving in
- Skill(superpowers:executing-plans) — execute the verification plan systematically

## Context
- Branch: aigos-v2
- This component renders inline in chat when the AI agent calls the `askUser` tool
- The file already exists: `src/components/journey/ask-user-card.tsx` (~536 lines)
- It was built in a prior session that was interrupted — I need you to verify it meets all contracts

## Authority Documents (READ THESE FIRST)
- `.claude/orchestration-sprint2-onboarding/DISCOVERY.md` — decisions D1-D5 cover UX behavior
- `.claude/orchestration-sprint2-onboarding/tasks/task-3.1.md` — exact contracts and acceptance criteria
- `.claude/orchestration-sprint2-onboarding/skills/chip-card-component/SKILL.md` — component patterns
- `CLAUDE.md` — project conventions (imports, naming, styling)

## Key Files to Read
- `src/components/journey/ask-user-card.tsx` — THE FILE (verify it)
- `src/lib/ai/tools/ask-user.ts` — tool schema (props must match)
- `src/app/globals.css` — design tokens (--accent-blue, --bg-hover, --border-default, --text-tertiary)
- `src/lib/motion.ts` — springs.snappy for animations

## Acceptance Criteria (from PHASES.md)
- [ ] Single-select: tap immediately submits after 200ms animation
- [ ] Multi-select: toggle chips freely, "Done" button submits
- [ ] "Other" chip: dashed border, transparent bg, expands inline text input
- [ ] Chips disabled after submission, selected chips highlighted
- [ ] Border-radius: 12px with descriptions, 999px (pill) without descriptions
- [ ] Design tokens used: --accent-blue, --text-tertiary, --bg-hover, --border-default
- [ ] Keyboard accessible (Tab, Enter, Space, arrow keys)
- [ ] WAI-ARIA: radiogroup (single) / checkbox group (multi)
- [ ] Props interface matches: toolCallId, question, fieldName, options, multiSelect, isSubmitted, selectedIndices, onSubmit
- [ ] AskUserResult type: single | multi | other union
- [ ] `npm run build` passes

## What to Do
1. Use Skill(superpowers:writing-plans) to create a verification plan
2. Read the existing file thoroughly
3. Compare against every acceptance criterion and contract in task-3.1.md
4. Fix anything that doesn't match — use Skill(superpowers:systematic-debugging) for any issues
5. If everything matches, confirm it's complete
6. Run `npm run build` to verify
7. Use Skill(superpowers:verification-before-completion) — provide evidence for EACH criterion before declaring done
```

---

## Task 3.2: ThinkingBlock Enhancement

```
I'm working on AI-GOS v2 Sprint 2 — conversational onboarding. I need to enhance the existing ThinkingBlock component with a live timer, streaming state, and blue accent border.

## Superpowers Skills — Invoke These First
Run each of these at the start of this session:
- Skill(superpowers:subagent-driven-development) — THIS IS PRIMARY. Use agent teams to orchestrate subtasks. Each subagent gets a fresh context with a clear spec. Agents communicate through agent teams for handoffs and status.
- Skill(superpowers:writing-plans) — plan the modifications before coding
- Skill(superpowers:executing-plans) — execute modifications systematically
- Skill(superpowers:verification-before-completion) — verify every criterion with evidence
- Skill(superpowers:systematic-debugging) — if timer or state logic has issues, debug systematically

## Context
- Branch: aigos-v2
- The ThinkingBlock already exists at `src/components/chat/thinking-block.tsx` (~87 lines)
- It needs: state prop, client-side timer, border color change

## Authority Documents (READ THESE FIRST)
- `.claude/orchestration-sprint2-onboarding/DISCOVERY.md` — decisions D4 (no auto-expand), D5 (blue border), D19 (timer impl), D20 (reasoning part streaming)
- `.claude/orchestration-sprint2-onboarding/tasks/task-3.2.md` — exact contracts
- `CLAUDE.md` — project conventions

## Key Files to Read
- `src/components/chat/thinking-block.tsx` — THE FILE to modify
- `src/app/globals.css` — design tokens (--accent-blue = rgb(54, 94, 255))

## Contracts (from PHASES.md)
- Updated props:
  ```typescript
  interface ThinkingBlockProps {
    content: string;
    state?: 'streaming' | 'done';  // NEW: from ReasoningUIPart.state
    defaultOpen?: boolean;
  }
  // REMOVE durationMs prop (timer is self-managed)
  ```
- Timer: useRef(Date.now()) on mount, setInterval(100ms) while streaming, freeze when done
- Label: "Thinking for X.Xs" (streaming) → "Thought for X.Xs" (done) → "Thinking" (no state)
- Border: change from --border-default to --accent-blue
- Keep: collapsed by default, chevron toggle, AnimatePresence, italic text
- Do NOT auto-expand during streaming (DISCOVERY D4)

## Acceptance Criteria
- [ ] Timer counts up during streaming, freezes when done
- [ ] Label format correct for all 3 states (streaming/done/no-state)
- [ ] Border color is --accent-blue
- [ ] Collapsed by default, expands on click
- [ ] No auto-expand during streaming
- [ ] durationMs prop removed, state prop added
- [ ] `npm run build` passes

## Workflow
1. Skill(superpowers:writing-plans) to outline modifications
2. Skill(superpowers:executing-plans) to implement
3. If any timer/state bugs: Skill(superpowers:systematic-debugging)
4. Skill(superpowers:verification-before-completion) — show evidence for each criterion
```

---

## Task 3.3: Progress Bar in Journey Header

```
I'm working on AI-GOS v2 Sprint 2 — conversational onboarding. I need to add a thin progress bar below the journey header showing required field completion.

## Superpowers Skills — Invoke These First
Run each of these at the start of this session:
- Skill(superpowers:subagent-driven-development) — THIS IS PRIMARY. Use agent teams to orchestrate subtasks. Each subagent gets a fresh context with a clear spec. Agents communicate through agent teams for handoffs and status.
- Skill(superpowers:writing-plans) — plan the implementation
- Skill(superpowers:executing-plans) — execute systematically
- Skill(superpowers:verification-before-completion) — verify with evidence before marking done

## Context
- Branch: aigos-v2
- Simple CSS task — 2px bar below the header

## Authority Documents (READ THESE FIRST)
- `.claude/orchestration-sprint2-onboarding/DISCOVERY.md` — decision D21 (progress bar spec)
- `.claude/orchestration-sprint2-onboarding/tasks/task-3.3.md` — exact contracts
- `CLAUDE.md` — project conventions

## Key Files to Read
- `src/components/journey/journey-header.tsx` — THE FILE to modify (~32 lines)
- `src/app/globals.css` — design tokens (--accent-blue, --border-subtle)

## Contracts
- New prop: `completionPercentage?: number` (0-100, default 0)
- 2px bar below header, full width
- Fill width = `${completionPercentage}%`
- Fill color: --accent-blue
- Background: --border-subtle or transparent
- Transition: `transition: width 0.3s ease`
- No step labels, no text, pure visual indicator

## Acceptance Criteria
- [ ] 2px bar renders below header
- [ ] Width scales 0-100% based on prop
- [ ] Fill color is --accent-blue
- [ ] Smooth width transition
- [ ] Default to 0% when prop not provided
- [ ] `npm run build` passes

## Workflow
1. Skill(superpowers:writing-plans) to plan
2. Skill(superpowers:executing-plans) to implement
3. Skill(superpowers:verification-before-completion) — screenshot or code evidence for each criterion
```

---

## Task 3.R: Phase 3 Regression

```
I'm working on AI-GOS v2 Sprint 2. Phase 3 (Frontend Components) should now be complete. I need to run the regression checks.

## Superpowers Skills — Invoke These First
Run each of these at the start of this session:
- Skill(superpowers:subagent-driven-development) — THIS IS PRIMARY. Use agent teams to orchestrate subtasks. Each subagent gets a fresh context with a clear spec. Agents communicate through agent teams for handoffs and status.
- Skill(superpowers:verification-before-completion) — provide evidence for every check
- Skill(superpowers:systematic-debugging) — if any regression found, debug systematically
- Skill(superpowers:writing-plans) — plan the regression test sequence

## Context
- Branch: aigos-v2
- Phase 3 added/modified: ask-user-card.tsx, thinking-block.tsx, journey-header.tsx

## Authority Documents
- `.claude/orchestration-sprint2-onboarding/tasks/task-3.R.md`
- `.claude/orchestration-sprint2-onboarding/PHASES.md` — Phase 3 Regression section

## Regression Checklist
1. Run `npm run build` — must pass
2. Run `npm run lint` — must pass
3. Start dev server: `npm run dev`
4. Navigate to http://localhost:3000/journey — page loads without errors
5. Verify header visible with progress bar at 0%
6. Send a message, verify thinking block appears with blue border (--accent-blue)
7. Take screenshots as evidence
8. If any failures, use Skill(superpowers:systematic-debugging) to fix, then re-verify

## Files to Verify Exist and Compile
- `src/components/journey/ask-user-card.tsx`
- `src/components/chat/thinking-block.tsx` (modified)
- `src/components/journey/journey-header.tsx` (modified)

## Workflow
1. Skill(superpowers:writing-plans) to sequence the regression tests
2. Execute each check, collecting evidence
3. If failures: Skill(superpowers:systematic-debugging) with 4-phase root cause
4. Skill(superpowers:verification-before-completion) — evidence for ALL checks passing
```

---

## Task 4.1: Chat Message askUser Rendering

```
I'm working on AI-GOS v2 Sprint 2 — conversational onboarding. I need to update chat-message.tsx to render AskUserCard for askUser tool parts and pass the `state` prop to ThinkingBlock.

## Superpowers Skills — Invoke These First
Run each of these at the start of this session:
- Skill(superpowers:subagent-driven-development) — THIS IS PRIMARY. Use agent teams to orchestrate subtasks. Each subagent gets a fresh context with a clear spec. Agents communicate through agent teams for handoffs and status.
- Skill(superpowers:writing-plans) — plan the integration carefully (multiple files involved)
- Skill(superpowers:executing-plans) — execute the plan step by step
- Skill(superpowers:verification-before-completion) — verify every criterion with evidence
- Skill(superpowers:systematic-debugging) — if rendering issues arise, debug systematically
- Skill(superpowers:dispatching-parallel-agents) — parallelize independent modifications

## Context
- Branch: aigos-v2
- This is the integration task that connects AskUserCard into the chat message rendering pipeline
- chat-message.tsx already has a renderToolPart() switch for other tools — I'm adding askUser

## Authority Documents (READ THESE FIRST)
- `.claude/orchestration-sprint2-onboarding/DISCOVERY.md` — D6-D8 (SDK APIs), D20 (reasoning part state), D22 (error handling), D23 (free text while chips pending)
- `.claude/orchestration-sprint2-onboarding/tasks/task-4.1.md` — exact contracts
- `.claude/orchestration-sprint2-onboarding/skills/ai-sdk-interactive-tools/SKILL.md` — SDK patterns
- `.claude/orchestration-sprint2-onboarding/skills/chip-card-component/SKILL.md` — component patterns
- `CLAUDE.md` — project conventions

## Key Files to Read
- `src/components/journey/chat-message.tsx` — THE FILE to modify (~450 lines)
- `src/components/journey/ask-user-card.tsx` — component to import and render
- `src/components/chat/thinking-block.tsx` — verify it accepts state prop now

## Contracts (from PHASES.md)
- Import AskUserCard from `@/components/journey/ask-user-card`
- In renderToolPart(), add case for `toolName === 'askUser'`:
  - `state === 'input-available'`: render `<AskUserCard>` with props from input
  - `state === 'output-available'`: render `<AskUserCard isSubmitted={true}>` with selectedIndices from output
  - `state === 'input-streaming'`: render loading indicator
- New prop on ChatMessageProps: `onToolOutput?: (toolCallId: string, result: unknown) => void`
- Pass onToolOutput through to AskUserCard.onSubmit
- In reasoning part rendering, pass `state` from ReasoningUIPart to ThinkingBlock:
  ```tsx
  <ThinkingBlock
    content={(part.text as string) || ''}
    state={(part as { state?: string }).state as 'streaming' | 'done' | undefined}
  />
  ```
- Existing tool renderers (editBlueprint, deepResearch, etc.) MUST remain unchanged

## Acceptance Criteria
- [ ] askUser tool parts render as AskUserCard
- [ ] Pending askUser shows interactive chips
- [ ] Submitted askUser shows static/disabled chips with selection highlighted
- [ ] ThinkingBlock receives state prop from reasoning parts
- [ ] onToolOutput callback threaded through to AskUserCard
- [ ] Existing tool renderers unchanged
- [ ] `npm run build` passes

## Workflow
1. Skill(superpowers:writing-plans) — plan both changes (askUser rendering + ThinkingBlock state)
2. Consider Skill(superpowers:dispatching-parallel-agents) if the two changes are independent
3. Skill(superpowers:executing-plans) — implement each change
4. If rendering bugs: Skill(superpowers:systematic-debugging)
5. Skill(superpowers:verification-before-completion) — evidence for each criterion
```

---

## Task 4.2: Journey Page Wiring

```
I'm working on AI-GOS v2 Sprint 2 — conversational onboarding. I need to wire addToolOutput, update sendAutomaticallyWhen, add session hydration, and connect progress tracking in the journey page.

## Superpowers Skills — Invoke These First
Run each of these at the start of this session:
- Skill(superpowers:subagent-driven-development) — THIS IS PRIMARY. Use agent teams to orchestrate subtasks. Each subagent gets a fresh context with a clear spec. Agents communicate through agent teams for handoffs and status.
- Skill(superpowers:writing-plans) — plan the wiring carefully (this is the most complex integration task)
- Skill(superpowers:executing-plans) — execute step by step
- Skill(superpowers:verification-before-completion) — verify every criterion with evidence
- Skill(superpowers:systematic-debugging) — debug any addToolOutput or persistence issues
- Skill(superpowers:dispatching-parallel-agents) — parallelize independent parts

## Context
- Branch: aigos-v2
- This is the final integration task that connects everything in page.tsx
- Task 4.1 (chat-message askUser rendering) must be complete before this

## Authority Documents (READ THESE FIRST)
- `.claude/orchestration-sprint2-onboarding/DISCOVERY.md` — D6 (new APIs), D7 (sendAutomaticallyWhen), D8 (tool output format), D9 (onFinish), D11 (persistence model), D15 (no resume yet)
- `.claude/orchestration-sprint2-onboarding/tasks/task-4.2.md` — exact contracts
- `.claude/orchestration-sprint2-onboarding/skills/ai-sdk-interactive-tools/SKILL.md`
- `.claude/orchestration-sprint2-onboarding/skills/onboarding-persistence/SKILL.md`
- `CLAUDE.md` — project conventions

## Key Files to Read
- `src/app/journey/page.tsx` — THE FILE to modify (~163 lines)
- `src/lib/journey/session-state.ts` — calculateCompletion, OnboardingState
- `src/lib/storage/local-storage.ts` — getJourneySession, setJourneySession
- `src/components/journey/chat-message.tsx` — verify onToolOutput prop exists
- `src/components/journey/journey-header.tsx` — verify completionPercentage prop exists

## Contracts (from PHASES.md)
1. From useChat: destructure `addToolOutput` (NOT deprecated `addToolResult`)
2. Update sendAutomaticallyWhen:
   ```typescript
   import { lastAssistantMessageIsCompleteWithToolCalls, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';

   sendAutomaticallyWhen: (msg) =>
     lastAssistantMessageIsCompleteWithToolCalls(msg) ||
     lastAssistantMessageIsCompleteWithApprovalResponses(msg),
   ```
3. Add onToolOutput handler:
   ```typescript
   const handleToolOutput = (toolCallId: string, result: unknown) => {
     addToolOutput({ toolCallId, output: JSON.stringify(result) });
     // Persist to localStorage immediately
     const askUserResult = result as { fieldName: string; [key: string]: unknown };
     updateLocalSession(askUserResult.fieldName, askUserResult);
   };
   ```
4. Session hydration on mount from localStorage
5. Pass completionPercentage to JourneyHeader
6. Pass onToolOutput={handleToolOutput} to each ChatMessage
7. Update completion percentage after each addToolOutput

## Acceptance Criteria
- [ ] addToolOutput destructured from useChat (NOT addToolResult)
- [ ] sendAutomaticallyWhen uses combined predicate
- [ ] Tapping a chip calls addToolOutput with structured JSON
- [ ] localStorage updated immediately after each selection
- [ ] Progress bar updates after each required field answered
- [ ] Session hydration on mount from localStorage
- [ ] Existing error handling preserved
- [ ] `npm run build` passes

## Workflow
1. Skill(superpowers:writing-plans) — plan all 7 contract items
2. Skill(superpowers:subagent-driven-development) — consider breaking into: addToolOutput wiring, sendAutomaticallyWhen, persistence, progress tracking
3. Skill(superpowers:executing-plans) — implement each part
4. If addToolOutput or persistence bugs: Skill(superpowers:systematic-debugging)
5. Skill(superpowers:verification-before-completion) — evidence for each criterion
```

---

## Task 4.R: Phase 4 Integration Regression

```
I'm working on AI-GOS v2 Sprint 2. Phase 4 (Integration) should now be complete. I need to run full integration testing.

## Superpowers Skills — Invoke These First
Run each of these at the start of this session:
- Skill(superpowers:subagent-driven-development) — THIS IS PRIMARY. Use agent teams to orchestrate subtasks. Each subagent gets a fresh context with a clear spec. Agents communicate through agent teams for handoffs and status.
- Skill(superpowers:verification-before-completion) — provide evidence for every test step
- Skill(superpowers:systematic-debugging) — if any integration issue found, debug with 4-phase root cause
- Skill(superpowers:writing-plans) — plan the test sequence

## Context
- Branch: aigos-v2
- Phase 4 wired: chat-message.tsx renders askUser cards, page.tsx has addToolOutput + progress + hydration

## Authority Documents
- `.claude/orchestration-sprint2-onboarding/tasks/task-4.R.md`
- `.claude/orchestration-sprint2-onboarding/PHASES.md` — Phase 4 Regression section

## Integration Test Checklist
1. Run `npm run build` — must pass
2. Run `npm run lint` — must pass
3. Start dev server: `npm run dev`
4. Navigate to http://localhost:3000/journey
5. Send initial message with company info (e.g., "I run a SaaS called TaskFlow that helps teams manage projects")
6. Verify: agent calls askUser → chips render inline in chat
7. Verify: tapping a chip submits and agent continues to next question
8. Verify: thinking block shows blue border (--accent-blue) and timer counting
9. Verify: progress bar advances after answering required fields
10. Verify: no console errors in browser DevTools
11. Take screenshots of each step as evidence
12. If any failures, use Skill(superpowers:systematic-debugging) to fix and re-verify

## Workflow
1. Skill(superpowers:writing-plans) to sequence all 12 checks
2. Execute each, collecting screenshots/logs as evidence
3. If failures: Skill(superpowers:systematic-debugging) — 4-phase root cause analysis
4. Skill(superpowers:verification-before-completion) — evidence for ALL checks passing
```

---

## Task 5.1: Happy Path E2E

```
I'm working on AI-GOS v2 Sprint 2. All implementation is complete. I need to run the full happy path E2E test.

## Superpowers Skills — Invoke These First
Run each of these at the start of this session:
- Skill(superpowers:subagent-driven-development) — THIS IS PRIMARY. Use agent teams to orchestrate subtasks. Each subagent gets a fresh context with a clear spec. Agents communicate through agent teams for handoffs and status.
- Skill(superpowers:verification-before-completion) — screenshot evidence for every test step
- Skill(superpowers:systematic-debugging) — debug any end-to-end issues found
- Skill(superpowers:writing-plans) — plan the test execution sequence
- Skill(superpowers:executing-plans) — execute the test plan methodically

## Context
- Branch: aigos-v2
- Everything should be wired and working — this is verification

## Authority Documents
- `.claude/orchestration-sprint2-onboarding/tasks/task-5.1.md`
- `.claude/orchestration-sprint2-onboarding/DISCOVERY.md` — full context

## Happy Path Test Script
1. Start dev server: `npm run dev`
2. Navigate to http://localhost:3000/journey
3. Verify welcome message displays
4. Type company info: "I'm building a B2B SaaS called TaskFlow — project management for remote teams. We charge $49/mo."
5. Wait for agent to call askUser → verify chip card renders with options
6. Click a chip → verify: 200ms highlight animation, auto-submission, agent continues
7. Continue through multiple questions (at least 4-5)
8. Verify progress bar advances after each required field
9. Verify thinking blocks appear with blue --accent-blue border and live timer
10. Complete all 8 required fields → verify summary appears
11. Verify confirmation askUser renders ("Looks good" / "Change something")
12. Click "Looks good" → verify completion
13. Screenshot every key screen as evidence
14. If any issues found, use Skill(superpowers:systematic-debugging) to fix, then re-run full flow

## Workflow
1. Skill(superpowers:writing-plans) to plan the 14-step test
2. Skill(superpowers:executing-plans) to run through each step
3. If any bugs: Skill(superpowers:systematic-debugging) with 4-phase root cause
4. Skill(superpowers:verification-before-completion) — screenshot evidence for EVERY step
```

---

## Task 5.2: Edge Cases E2E

```
I'm working on AI-GOS v2 Sprint 2. Happy path is passing. I need to test edge cases.

## Superpowers Skills — Invoke These First
Run each of these at the start of this session:
- Skill(superpowers:subagent-driven-development) — THIS IS PRIMARY. Use agent teams to orchestrate subtasks. Each subagent gets a fresh context with a clear spec. Agents communicate through agent teams for handoffs and status.
- Skill(superpowers:verification-before-completion) — evidence for every edge case tested
- Skill(superpowers:systematic-debugging) — debug any edge case failures
- Skill(superpowers:writing-plans) — plan the edge case test matrix
- Skill(superpowers:executing-plans) — execute each test systematically
- Skill(superpowers:dispatching-parallel-agents) — parallelize independent edge case tests

## Context
- Branch: aigos-v2
- Task 5.1 (happy path) must be passing before this

## Authority Documents
- `.claude/orchestration-sprint2-onboarding/tasks/task-5.2.md`
- `.claude/orchestration-sprint2-onboarding/DISCOVERY.md` — D3 (Other styling), D22 (error handling), D23 (free text while chips pending)

## Edge Case Tests
1. **"Other" selection**: Click "Other" chip → verify text input appears → type custom answer → submit → verify agent receives it
2. **Multi-select**: On the marketing channels question, verify toggle behavior → multiple chips selectable → "Done" button appears → submit
3. **Free text while chips pending**: While askUser chips are showing, type in the chat input and send → verify agent handles gracefully (D23)
4. **localStorage persistence**: Open DevTools → Application → Local Storage → verify `aigog_journey_session` key updates after each chip tap
5. **Thinking block behavior**: Verify collapsed by default → click to expand → see reasoning text → verify timer shows "Thinking for X.Xs" while streaming, "Thought for X.Xs" when done
6. **Malformed tool call fallback**: If possible, test what happens if agent sends bad askUser args (may need to modify prompt temporarily)
7. Screenshot all edge cases as evidence

## Workflow
1. Skill(superpowers:writing-plans) to create edge case test matrix
2. Skill(superpowers:dispatching-parallel-agents) for independent edge cases (1-2 can run in parallel with 4-5)
3. Skill(superpowers:executing-plans) to execute each test
4. If failures: Skill(superpowers:systematic-debugging)
5. Skill(superpowers:verification-before-completion) — evidence for ALL edge cases
```

---

## Task 5.3: Regression (Existing Pages)

```
I'm working on AI-GOS v2 Sprint 2. I need to verify all existing pages still work — no regressions from Sprint 2 changes.

## Superpowers Skills — Invoke These First
Run each of these at the start of this session:
- Skill(superpowers:subagent-driven-development) — THIS IS PRIMARY. Use agent teams to orchestrate subtasks. Each subagent gets a fresh context with a clear spec. Agents communicate through agent teams for handoffs and status.
- Skill(superpowers:verification-before-completion) — evidence for every page check
- Skill(superpowers:systematic-debugging) — debug any regression found
- Skill(superpowers:writing-plans) — plan the regression sequence
- Skill(superpowers:dispatching-parallel-agents) — parallelize independent page checks

## Context
- Branch: aigos-v2
- Sprint 2 modified shared components (thinking-block.tsx, local-storage.ts) that other pages may use

## Regression Checklist
1. Run `npm run build` — must pass (final verification)
2. Run `npm run lint` — must pass (final verification)
3. Start dev server: `npm run dev`
4. Navigate to http://localhost:3000/dashboard → page loads without errors
5. Navigate to http://localhost:3000/strategy → page loads without errors
6. Navigate to http://localhost:3000/chat → page loads, chat works (send a message, get response)
7. Navigate to http://localhost:3000/journey → page loads (verify independently from 5.1)
8. Check browser console on each page — no new errors introduced
9. Screenshot each page as evidence

If any page fails:
- Use Skill(superpowers:systematic-debugging) to diagnose
- Check if ThinkingBlock changes broke existing chat (state prop is optional, should be backward compatible)
- Check if localStorage changes broke existing storage (only added new key, shouldn't affect existing)
- Fix any issues, rebuild, re-verify all pages

## Workflow
1. Skill(superpowers:writing-plans) to plan the regression test sequence
2. Skill(superpowers:dispatching-parallel-agents) — parallelize page checks (dashboard + strategy + chat can run simultaneously)
3. Execute each check with evidence collection
4. If regressions: Skill(superpowers:systematic-debugging) with 4-phase root cause
5. Skill(superpowers:verification-before-completion) — evidence for ALL pages passing
```

---

## Execution Order

```
Can run in PARALLEL:
├── Task 3.1 (AskUser card — verify/fix)
├── Task 3.2 (ThinkingBlock enhancement)
└── Task 3.3 (Progress bar)

Then:
└── Task 3.R (Phase 3 regression)

Then can run in PARALLEL:
├── Task 4.1 (Chat message askUser rendering)
└── (wait for 4.1, then)
    └── Task 4.2 (Journey page wiring)

Then:
└── Task 4.R (Phase 4 integration regression)

Then can run in PARALLEL:
├── Task 5.1 (Happy path E2E)
├── Task 5.3 (Regression — existing pages)
└── (wait for 5.1, then)
    └── Task 5.2 (Edge cases E2E)
```

## Superpowers Skills Reference

Every task above uses a combination of these Superpowers skills. Here's the full list available:

| Skill | Invocation | When to Use |
|-------|-----------|-------------|
| **Subagent-Driven Development** | **`Skill(superpowers:subagent-driven-development)`** | **PRIMARY SKILL — ALWAYS invoke first. Orchestrates agent teams where each subagent gets a fresh context with a clear spec. Agents communicate through agent teams for handoffs and status.** |
| Writing Plans | `Skill(superpowers:writing-plans)` | Before starting ANY implementation or test |
| Executing Plans | `Skill(superpowers:executing-plans)` | When executing a written plan |
| Verification Before Completion | `Skill(superpowers:verification-before-completion)` | Before marking ANY task as done — requires evidence |
| Systematic Debugging | `Skill(superpowers:systematic-debugging)` | 4-phase root cause analysis for any bug |
| Dispatching Parallel Agents | `Skill(superpowers:dispatching-parallel-agents)` | Run independent subtasks concurrently via agent teams |
| Test-Driven Development | `Skill(superpowers:test-driven-development)` | RED-GREEN-REFACTOR cycle (if unit tests needed) |
| Brainstorming | `Skill(superpowers:brainstorming)` | Ideate approaches before committing |
| Using Git Worktrees | `Skill(superpowers:using-git-worktrees)` | Isolated branches per task |
| Requesting Code Review | `Skill(superpowers:requesting-code-review)` | Two-stage review (spec compliance + code quality) |
| Finishing a Branch | `Skill(superpowers:finishing-a-development-branch)` | Complete and merge a branch |

## Sprint 2 Complete When
- All 17 tasks (7 done + 10 remaining) show DONE
- `npm run build` passes
- `npm run lint` passes
- All E2E tests pass with screenshots
- No regressions on existing pages
