# Sprint 2: Conversational Onboarding — Implementation Phases

**Target**: Sprint 2 completion
**Execution**: Sequential phases, autonomous subagent execution
**Authority**: DISCOVERY.md overrides everything
**Branch**: `aigos-v2`

---

## Scope Constraints (from DISCOVERY.md D16)

These are OUT of scope. Do NOT implement:
- No voice input (Sprint 3+)
- No background research during onboarding
- No research activity ticker
- No URL scraping (store URLs in metadata for Sprint 3)
- No two-column layout (stays centered chat)
- No separate onboarding agent or route
- No session resume logic (persist state, don't resume)
- No v1 regressions (all existing pages must work)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| AI SDK | Vercel AI SDK v6 (`ai@6.0.73`, `@ai-sdk/react@3.0.75`) |
| AI Provider | `@ai-sdk/anthropic@3.0.36` — Claude Opus 4.6 (conversation), Sonnet (extraction) |
| Auth | Clerk (`@clerk/nextjs@6.36.8`) |
| Database | Supabase (`@supabase/supabase-js@2.87.1`) — `journey_sessions` table |
| UI | React 19, Framer Motion 12, Tailwind CSS v4, Radix primitives |
| Validation | Zod v4 |
| Testing | `npm run build` + `npm run lint` + Playwright MCP (e2e) |

---

## Skills Reference

All skills at `.claude/orchestration-sprint2-onboarding/skills/`. Agents MUST read relevant skills before starting a task.

| Skill | Use When |
|-------|----------|
| `ai-sdk-interactive-tools` | Working with askUser tool definition, addToolOutput, stepCountIs, sendAutomaticallyWhen, route.ts |
| `chip-card-component` | Building AskUserCard component — props, state machine, styling, animations, accessibility |
| `onboarding-persistence` | OnboardingState interface, localStorage helpers, Supabase extraction from body.messages |
| `onboarding-prompt` | Extending lead-agent-system.ts — question sequence, field tracking, pushback, completion flow |

---

## Tools Reference

| Server/Tool | Use For | Key Operations |
|-------------|---------|----------------|
| **Playwright MCP** | Browser testing on localhost:3000 | navigate, click, fill, screenshot, snapshot, evaluate, console |
| **Supabase MCP** | Database operations, migrations | execute_sql, apply_migration, list_tables |

---

## Testing Methods

| Method | Tool | Description |
|--------|------|-------------|
| Type check | `npm run build` | Catches type errors, import issues, route compilation |
| Lint | `npm run lint` | ESLint with Next.js rules |
| E2E happy path | Playwright MCP | Navigate `/journey`, complete full onboarding, verify chips, selections, thinking block, progress bar |
| E2E edge cases | Playwright MCP | Test "Other" selection, multi-select, vague answers, change after summary |
| Regression | Playwright MCP | Verify `/dashboard`, `/strategy`, `/chat` pages still load |

---

## Phase Overview

| Phase | Goal | Tasks |
|-------|------|-------|
| 1: Foundation | Type definitions, tool definition, storage helpers | 4 |
| 2: Backend | Route integration + system prompt extension | 3 |
| 3: Frontend Components | AskUser card, ThinkingBlock enhancement, progress bar | 4 |
| 4: Integration | Wire everything in chat-message.tsx + page.tsx | 3 |
| 5: E2E Testing | Comprehensive Playwright testing on live dev server | 3 |
| **Total** | | **17** |

---

## Phase 1: Foundation

**Goal**: Create all type definitions, the askUser tool, and storage helpers. These are pure CREATE/EXTEND tasks with no cross-file dependencies on existing Sprint 1 code beyond imports.

### Task 1.1: askUser Tool Definition
- **Objective**: Create the askUser interactive tool with Zod schema — the core building block for structured questions
- **Dependencies**: None
- **Blocked by**: None
- **Files**: CREATE `src/lib/ai/tools/ask-user.ts`
- **Contracts**:
  - Tool name: `askUser`
  - No `execute` function (interactive tool pattern — SDK waits for client `addToolOutput()`)
  - Input schema (Zod):
    ```
    {
      question: z.string()        // The question to display
      fieldName: z.string()       // Which OnboardingState field this maps to
      options: z.array(z.object({
        label: z.string()
        description: z.string().optional()
      })).min(2).max(4)           // 2-4 options
      multiSelect: z.boolean().default(false)
    }
    ```
  - Export: `export const askUser = tool({ ... })`
- **Acceptance Criteria**:
  - [ ] Tool exports correctly with `tool()` from `ai` package
  - [ ] Zod schema validates: question (required string), fieldName (required string), options (2-4 objects with label + optional description), multiSelect (boolean, default false)
  - [ ] No `execute` function defined
  - [ ] `npm run build` passes with this file included
- **Testing**:
  - [ ] Build: `npm run build` compiles without errors
- **Skills**: `ai-sdk-interactive-tools`

### Task 1.2: OnboardingState Interface + Persistence Helpers
- **Objective**: Create the session state interface and Supabase persistence functions
- **Dependencies**: None
- **Blocked by**: None
- **Files**: CREATE `src/lib/journey/session-state.ts`
- **Contracts**:
  - `OnboardingState` interface with 8 required fields, 14 optional fields, 4 meta fields:
    ```
    Required: businessModel, industry, icpDescription, productDescription, competitors, offerPricing, marketingChannels, goals
    Optional: companyName, websiteUrl, teamSize, monthlyBudget, currentCac, targetCpa, topPerformingChannel, biggestMarketingChallenge, buyerPersonaTitle, salesCycleLength, avgDealSize, primaryKpi, geographicFocus, seasonalityPattern
    Meta: phase ('onboarding' | 'complete'), completedFields (string[]), completionPercentage (number 0-100), lastUpdated (ISO string)
    ```
  - `calculateCompletion(state: OnboardingState): number` — counts non-null required fields / 8 * 100
  - `extractAskUserResults(messages: UIMessage[]): Record<string, unknown>` — scans messages for `tool-askUser` parts with `state: 'output-available'`, extracts `input.fieldName` + `output`
  - `persistToSupabase(userId: string, fields: Record<string, unknown>): Promise<void>` — fetch current metadata, deep merge, upsert. Silent fail with console.error.
  - Uses `createAdminClient()` from existing Supabase utils
- **Acceptance Criteria**:
  - [ ] OnboardingState interface exported with all 26 fields
  - [ ] calculateCompletion returns correct percentage (0-100)
  - [ ] extractAskUserResults correctly scans UIMessage[] for tool-askUser parts
  - [ ] persistToSupabase uses fetch-then-merge pattern, handles errors silently
  - [ ] `npm run build` passes
- **Testing**:
  - [ ] Build: `npm run build` compiles without errors
- **Skills**: `onboarding-persistence`

### Task 1.3: localStorage Extension
- **Objective**: Add JOURNEY_SESSION key and typed helpers to existing localStorage utility
- **Dependencies**: Task 1.2 (imports OnboardingState type)
- **Blocked by**: Task 1.2
- **Files**: EXTEND `src/lib/storage/local-storage.ts`
- **Contracts**:
  - Add `JOURNEY_SESSION: 'aigog_journey_session'` to STORAGE_KEYS
  - `getJourneySession(): OnboardingState | null`
  - `setJourneySession(data: OnboardingState): boolean`
  - `clearJourneySession(): boolean`
  - Import `OnboardingState` from `@/lib/journey/session-state`
- **Acceptance Criteria**:
  - [ ] STORAGE_KEYS includes JOURNEY_SESSION
  - [ ] get/set/clear functions work with OnboardingState type
  - [ ] Follows existing patterns (uses generic getItem/setItem/removeItem)
  - [ ] No changes to existing functions
  - [ ] `npm run build` passes
- **Testing**:
  - [ ] Build: `npm run build` compiles without errors
- **Skills**: `onboarding-persistence`

### Task 1.R: Phase 1 Regression
- **Objective**: Verify all Phase 1 outputs compile and don't break existing code
- **Dependencies**: All Phase 1 tasks
- **Testing**:
  - [ ] `npm run build` passes (all routes compile)
  - [ ] `npm run lint` passes
  - [ ] Verify new files exist: `src/lib/ai/tools/ask-user.ts`, `src/lib/journey/session-state.ts`
  - [ ] Verify modified file: `src/lib/storage/local-storage.ts` has JOURNEY_SESSION key
  - [ ] Playwright: navigate `http://localhost:3000/journey` — page loads without errors

---

## Phase 2: Backend

**Goal**: Integrate the askUser tool into the streaming route and extend the system prompt with onboarding intelligence.

### Task 2.1: Route Integration
- **Objective**: Add askUser tool, step control, and body.messages persistence to the journey stream route
- **Dependencies**: Task 1.1 (askUser tool), Task 1.2 (session-state helpers)
- **Blocked by**: Phase 1 complete
- **Files**: MODIFY `src/app/api/journey/stream/route.ts`
- **Contracts**:
  - Import `askUser` from `@/lib/ai/tools/ask-user`
  - Import `stepCountIs` from `ai`
  - Import `extractAskUserResults`, `persistToSupabase` from `@/lib/journey/session-state`
  - Add to `streamText()`:
    ```
    tools: { askUser },
    stopWhen: stepCountIs(15),
    onFinish: async ({ usage, steps }) => {
      // Logging/monitoring only — interactive tool results NOT in steps
      console.log('[journey] stream finished', { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, steps: steps.length });
    },
    ```
  - BEFORE `streamText()`: extract askUser results from incoming body.messages, persist to Supabase:
    ```
    const askUserFields = extractAskUserResults(body.messages);
    if (Object.keys(askUserFields).length > 0) {
      persistToSupabase(userId, askUserFields); // fire-and-forget, no await blocking
    }
    ```
  - Keep existing sanitization logic (INCOMPLETE_TOOL_STATES)
  - Keep existing auth, message parsing
- **Acceptance Criteria**:
  - [ ] `tools: { askUser }` present in streamText config
  - [ ] `stopWhen: stepCountIs(15)` present
  - [ ] Body.messages extraction runs before streamText
  - [ ] Supabase persistence is fire-and-forget (does not block response)
  - [ ] Existing sanitization logic preserved
  - [ ] `npm run build` passes
- **Testing**:
  - [ ] Build: route compiles in `npm run build`
  - [ ] Verify the route still handles basic chat (no tools) without regression
- **Skills**: `ai-sdk-interactive-tools`, `onboarding-persistence`

### Task 2.2: System Prompt Extension
- **Objective**: Add onboarding intelligence to the lead agent system prompt — question flow, field tracking, pushback rules, completion flow
- **Dependencies**: None (text-only changes)
- **Blocked by**: None (can run parallel with 2.1)
- **Files**: MODIFY `src/lib/ai/prompts/lead-agent-system.ts`
- **Contracts**:
  - PRESERVE: identity paragraph ("senior paid media strategist..."), personality section ("NEVER" / "ALWAYS" lists)
  - REPLACE: "What You're Doing Right Now" section → onboarding instructions
  - REPLACE: "Scope" section → updated scope with tool awareness
  - UPDATE: Welcome message — remove "I'll dig in while we talk" (no background research in Sprint 2)
  - ADD: Required fields list with when to use askUser vs open text
  - ADD: Dynamic option generation rules (Q3 changes based on Q1/Q2)
  - ADD: Pushback instructions for vague answers
  - ADD: Completion flow: detect 8/8 → summary → confirmation askUser
  - ADD: Field tracking format for internal reasoning
  - Total prompt budget: ~2200-2600 tokens
- **Acceptance Criteria**:
  - [ ] Identity and personality sections preserved verbatim
  - [ ] Onboarding instructions present with 8 required fields listed
  - [ ] askUser usage guidance (categorical = chips, nuanced = open text)
  - [ ] Dynamic option generation rules
  - [ ] Pushback instructions for vague answers
  - [ ] Completion flow (summary → confirmation)
  - [ ] Welcome message updated
  - [ ] `npm run build` passes
- **Testing**:
  - [ ] Build: `npm run build` compiles
  - [ ] Manual review: read the prompt and verify it's coherent, complete, under ~2600 tokens
- **Skills**: `onboarding-prompt`

### Task 2.R: Phase 2 Regression
- **Objective**: Verify backend changes work end-to-end
- **Dependencies**: All Phase 2 tasks
- **Testing**:
  - [ ] `npm run build` passes
  - [ ] `npm run lint` passes
  - [ ] Start dev server, navigate to `/journey`
  - [ ] Send a message — agent responds (streaming works)
  - [ ] Agent should start using askUser tool calls after initial exchange (verify in browser console/network tab that tool call parts appear in stream)

---

## Phase 3: Frontend Components

**Goal**: Build the three new/enhanced UI components: interactive chip card, enhanced thinking block, and progress bar. These are self-contained components with no cross-dependencies.

### Task 3.1: AskUser Card Component
- **Objective**: Create the interactive chip selection card that renders inline in chat when the agent calls askUser
- **Dependencies**: Task 1.1 (for schema knowledge — props match tool input)
- **Blocked by**: Phase 1 complete
- **Files**: CREATE `src/components/journey/ask-user-card.tsx`
- **Contracts**:
  - Props interface:
    ```
    interface AskUserCardProps {
      toolCallId: string;          // For addToolOutput
      question: string;
      fieldName: string;
      options: Array<{ label: string; description?: string }>;
      multiSelect: boolean;
      isSubmitted: boolean;         // true after addToolOutput called
      selectedIndices: number[];    // highlight after submission
      onSubmit: (result: AskUserResult) => void;
    }

    type AskUserResult =
      | { fieldName: string; selectedLabel: string; selectedIndex: number }          // single
      | { fieldName: string; selectedLabels: string[]; selectedIndices: number[] }   // multi
      | { fieldName: string; otherText: string };                                     // other
    ```
  - State machine: IDLE → SELECTING → OTHER_INPUT → SUBMITTED
  - Chip styling per DISCOVERY.md D1-D3:
    - With descriptions: rounded rectangle (12px border-radius)
    - Without descriptions: pill (999px border-radius)
    - "Other" chip: dashed border, transparent bg, `--text-tertiary`
    - Selected: `--accent-blue` glow, unselected fade
  - Single-select: tap → 200ms highlight animation → auto-submit
  - Multi-select: toggle chips → "Done" button → submit
  - "Other": expand inline text input → submit
  - After submission: all chips become static/disabled, selected highlighted
  - Animations: use `springs.snappy` from `src/lib/motion.ts`
  - Accessibility: WAI-ARIA radiogroup (single) / checkbox group (multi), keyboard navigation
- **Acceptance Criteria**:
  - [ ] Single-select: tap immediately submits after 200ms animation
  - [ ] Multi-select: toggle chips freely, "Done" button submits
  - [ ] "Other" chip expands inline text input
  - [ ] Chips disabled after submission, selected chips highlighted
  - [ ] Correct border-radius based on description presence
  - [ ] Design tokens used: `--accent-blue`, `--text-tertiary`, `--bg-hover`, `--border-default`
  - [ ] Keyboard accessible (Tab, Enter, Space, arrow keys)
  - [ ] `npm run build` passes
- **Testing**:
  - [ ] Build: `npm run build` compiles
- **Skills**: `chip-card-component`

### Task 3.2: ThinkingBlock Enhancement
- **Objective**: Add live timer, streaming state, and blue accent border to the existing ThinkingBlock
- **Dependencies**: None
- **Blocked by**: None (can run parallel with all Phase 3 tasks)
- **Files**: MODIFY `src/components/chat/thinking-block.tsx`
- **Contracts**:
  - Updated props:
    ```
    interface ThinkingBlockProps {
      content: string;
      state?: 'streaming' | 'done';  // NEW: from ReasoningUIPart.state
      defaultOpen?: boolean;
    }
    // REMOVE durationMs prop (timer is self-managed)
    ```
  - Timer behavior:
    - `useRef(Date.now())` on mount as start time
    - `setInterval(100ms)` while `state === 'streaming'` → update elapsed
    - Freeze elapsed when `state === 'done'`
    - Label: `state === 'streaming'` → "Thinking for X.Xs" (live), `state === 'done'` → "Thought for X.Xs" (frozen), no state → "Thinking" (no duration)
  - Border: change from `--border-default` to `--accent-blue` (`rgb(54, 94, 255)`)
  - Keep: collapsible behavior (collapsed by default), chevron toggle, AnimatePresence, italic text style
  - Do NOT auto-expand during streaming (DISCOVERY.md D4)
- **Acceptance Criteria**:
  - [ ] Timer counts up during streaming, freezes when done
  - [ ] Label shows "Thinking for X.Xs" while streaming, "Thought for X.Xs" when done
  - [ ] Historical messages (no state) show "Thinking" without duration
  - [ ] Border color is `--accent-blue`
  - [ ] Collapsed by default, expands on click
  - [ ] `npm run build` passes
- **Testing**:
  - [ ] Build: `npm run build` compiles
- **Skills**: (none — research in `thinking-block-streaming.md` covers implementation)

### Task 3.3: Progress Bar
- **Objective**: Add a thin progress bar below the journey header showing required field completion
- **Dependencies**: Task 1.2 (OnboardingState for completion calculation)
- **Blocked by**: Phase 1 complete
- **Files**: MODIFY `src/components/journey/journey-header.tsx`
- **Contracts**:
  - New prop: `completionPercentage?: number` (0-100, default 0)
  - 2px bar below header, full width
  - Fill width = `${completionPercentage}%`
  - Fill color: `--accent-blue`
  - Background: `--border-subtle` or transparent
  - Subtle width transition: `transition: width 0.3s ease`
  - No step labels, no text, pure visual indicator
- **Acceptance Criteria**:
  - [ ] 2px bar renders below header
  - [ ] Width scales 0-100% based on prop
  - [ ] Fill color is `--accent-blue`
  - [ ] Smooth width transition
  - [ ] Default to 0% when prop not provided
  - [ ] `npm run build` passes
- **Testing**:
  - [ ] Build: `npm run build` compiles
- **Skills**: (none — straightforward CSS)

### Task 3.R: Phase 3 Regression
- **Objective**: Verify all new/modified components render correctly
- **Dependencies**: All Phase 3 tasks
- **Testing**:
  - [ ] `npm run build` passes
  - [ ] `npm run lint` passes
  - [ ] Playwright: `/journey` loads, header visible with progress bar at 0%
  - [ ] Playwright: send a message, verify thinking block appears with blue border

---

## Phase 4: Integration

**Goal**: Wire all components together — render askUser cards in chat messages, connect addToolOutput in the page, hydrate session state.

### Task 4.1: Chat Message askUser Rendering
- **Objective**: Update chat-message.tsx to render AskUserCard for askUser tool parts and pass `state` to ThinkingBlock
- **Dependencies**: Task 3.1 (AskUserCard), Task 3.2 (ThinkingBlock new props)
- **Blocked by**: Phase 3 complete
- **Files**: MODIFY `src/components/journey/chat-message.tsx`
- **Contracts**:
  - Import `AskUserCard` from `@/components/journey/ask-user-card`
  - In `renderToolPart()`: add case for `toolName === 'askUser'`:
    - When `state === 'input-available'`: render `<AskUserCard>` with props from `input`
    - When `state === 'output-available'`: render `<AskUserCard isSubmitted={true}>` with selectedIndices from output
    - When `state === 'input-streaming'`: render loading indicator (existing pattern)
  - New prop on `ChatMessageProps`: `onToolOutput?: (toolCallId: string, result: unknown) => void`
  - Pass `onToolOutput` through `renderMessageParts` → `renderToolPart` → `AskUserCard.onSubmit`
  - In reasoning part rendering: pass `state` from `ReasoningUIPart` to `ThinkingBlock`:
    ```
    <ThinkingBlock
      content={(part.text as string) || ''}
      state={(part as { state?: string }).state as 'streaming' | 'done' | undefined}
    />
    ```
- **Acceptance Criteria**:
  - [ ] askUser tool parts render as AskUserCard
  - [ ] Pending askUser shows interactive chips
  - [ ] Submitted askUser shows static/disabled chips with selection highlighted
  - [ ] ThinkingBlock receives `state` prop from reasoning parts
  - [ ] onToolOutput callback threaded through to AskUserCard
  - [ ] Existing tool renderers (editBlueprint, deepResearch, etc.) unchanged
  - [ ] `npm run build` passes
- **Testing**:
  - [ ] Build: `npm run build` compiles
- **Skills**: `ai-sdk-interactive-tools`, `chip-card-component`

### Task 4.2: Journey Page Wiring
- **Objective**: Connect addToolOutput, update sendAutomaticallyWhen, add session hydration and progress tracking
- **Dependencies**: Task 1.2, 1.3, 2.1, 4.1
- **Blocked by**: Task 4.1 complete
- **Files**: MODIFY `src/app/journey/page.tsx`
- **Contracts**:
  - From `useChat`: destructure `addToolOutput` (NOT `addToolResult`)
  - Update `sendAutomaticallyWhen` to combined predicate:
    ```
    import { lastAssistantMessageIsCompleteWithToolCalls, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';

    sendAutomaticallyWhen: (msg) =>
      lastAssistantMessageIsCompleteWithToolCalls(msg) ||
      lastAssistantMessageIsCompleteWithApprovalResponses(msg),
    ```
  - Add `onToolOutput` handler passed to `<ChatMessage>`:
    ```
    const handleToolOutput = (toolCallId: string, result: unknown) => {
      addToolOutput({ toolCallId, output: JSON.stringify(result) });
      // Also persist to localStorage immediately
      const askUserResult = result as { fieldName: string; [key: string]: unknown };
      updateLocalSession(askUserResult.fieldName, askUserResult);
    };
    ```
  - Session hydration on mount:
    ```
    const [completionPercentage, setCompletionPercentage] = useState(0);
    useEffect(() => {
      const saved = getJourneySession();
      if (saved) setCompletionPercentage(saved.completionPercentage);
    }, []);
    ```
  - Pass `completionPercentage` to `<JourneyHeader>`
  - Pass `onToolOutput={handleToolOutput}` to each `<ChatMessage>`
  - Update completion percentage after each addToolOutput
- **Acceptance Criteria**:
  - [ ] `addToolOutput` destructured from useChat (NOT addToolResult)
  - [ ] sendAutomaticallyWhen uses combined predicate (tool calls OR approval responses)
  - [ ] Tapping a chip calls addToolOutput with structured JSON
  - [ ] localStorage updated immediately after each selection
  - [ ] Progress bar updates after each required field answered
  - [ ] Session hydration on mount from localStorage
  - [ ] Existing error handling preserved
  - [ ] `npm run build` passes
- **Testing**:
  - [ ] Build: `npm run build` compiles
- **Skills**: `ai-sdk-interactive-tools`, `onboarding-persistence`

### Task 4.R: Phase 4 Regression
- **Objective**: Full integration test — everything works together
- **Dependencies**: All Phase 4 tasks
- **Testing**:
  - [ ] `npm run build` passes
  - [ ] `npm run lint` passes
  - [ ] Start dev server
  - [ ] Playwright: navigate `/journey`, send initial message with company info
  - [ ] Verify agent calls askUser → chips render inline
  - [ ] Verify tapping a chip submits and agent continues
  - [ ] Verify thinking block shows blue border and timer
  - [ ] Verify progress bar advances
  - [ ] Verify no console errors

---

## Phase 5: E2E Testing

**Goal**: Comprehensive Playwright testing of the full onboarding flow, edge cases, and regression.

### Task 5.1: Happy Path E2E
- **Objective**: Test the complete onboarding flow from start to finish
- **Dependencies**: All Phase 4 complete
- **Blocked by**: Phase 4 complete
- **Testing**:
  - [ ] Start dev server (`npm run dev`)
  - [ ] Navigate to `http://localhost:3000/journey`
  - [ ] Verify welcome message displays
  - [ ] Type company name and send
  - [ ] Wait for agent to call askUser → verify chip card renders
  - [ ] Click a chip → verify selection animation + submission
  - [ ] Continue through multiple questions
  - [ ] Verify progress bar advances after each required field
  - [ ] Verify thinking blocks appear with blue border and timer
  - [ ] Complete all required fields → verify summary appears
  - [ ] Verify confirmation askUser renders ("Looks good" / "Change")
  - [ ] Click "Looks good" → verify completion
  - [ ] Screenshot key screens as evidence

### Task 5.2: Edge Cases E2E
- **Objective**: Test non-happy-path scenarios
- **Dependencies**: Task 5.1
- **Blocked by**: Task 5.1
- **Testing**:
  - [ ] "Other" selection: click "Other" chip → verify text input appears → type and submit
  - [ ] Multi-select: verify toggle behavior on marketing channels question → "Done" button
  - [ ] Malformed tool call: if agent sends bad askUser args, verify graceful fallback (no crash)
  - [ ] Verify localStorage persistence: open DevTools → Application → Local Storage → verify `aigog_journey_session` key updates
  - [ ] Verify thinking block collapsed by default, expandable on click
  - [ ] Verify timer on thinking block (counts up during streaming, freezes when done)

### Task 5.3: Regression
- **Objective**: Verify existing pages still work
- **Dependencies**: None (can run parallel with 5.1/5.2)
- **Blocked by**: Phase 4 complete
- **Testing**:
  - [ ] Navigate `/dashboard` → page loads without errors
  - [ ] Navigate `/strategy` → page loads without errors
  - [ ] Navigate `/chat` → page loads, chat works
  - [ ] Navigate `/journey` → page loads (covered by 5.1 but verify independently)
  - [ ] `npm run build` passes (final verification)
  - [ ] `npm run lint` passes (final verification)

---

## Dependency Graph

```
Phase 1: Foundation
  1.1 (ask-user.ts)         ─┐
  1.2 (session-state.ts)    ─┤──→ 1.R
  1.3 (local-storage.ts)  ←1.2┘
         │
         ▼
Phase 2: Backend              Phase 3: Components
  2.1 (route.ts)    ←1.1,1.2    3.1 (ask-user-card.tsx)
  2.2 (prompt.ts)   (parallel)   3.2 (thinking-block.tsx)  ← independent
  2.R                            3.3 (journey-header.tsx)  ←1.2
                                 3.R
         │                          │
         ▼                          ▼
Phase 4: Integration
  4.1 (chat-message.tsx) ←3.1, 3.2
  4.2 (page.tsx)         ←1.2, 1.3, 2.1, 4.1
  4.R
         │
         ▼
Phase 5: E2E Testing
  5.1 (happy path)
  5.2 (edge cases)  ←5.1
  5.3 (regression)  (parallel with 5.1)
```

**Parallelism notes**:
- Phase 1: Tasks 1.1 and 1.2 are parallel. Task 1.3 depends on 1.2.
- Phase 2 and Phase 3 can run in PARALLEL (no cross-dependencies except both depend on Phase 1).
- Phase 4: Task 4.1 and 4.2 are sequential (4.2 depends on 4.1).
- Phase 5: Tasks 5.1 and 5.3 are parallel. Task 5.2 depends on 5.1.

---

## Task Execution Protocol

### For each task:
1. **Orient**: Read task file + relevant skills from `.claude/orchestration-sprint2-onboarding/skills/` + PROGRESS.md
2. **Explore**: Read existing source files listed in the task to understand current patterns
3. **Implement**: Write code following contracts exactly, using design tokens from `globals.css`
4. **Build check**: Run `npm run build` — fix any type errors
5. **Complete**: Update PROGRESS.md with task status

### For regression tasks:
1. Run `npm run build` + `npm run lint`
2. Start dev server if not running
3. Run all Playwright tests from the phase
4. Fix any failures, rebuild, retest
5. Mark phase complete in PROGRESS.md

### For Phase 5 (E2E):
1. Ensure dev server is running
2. Execute each test via Playwright MCP
3. Screenshot key screens as evidence
4. Fix any issues found, then re-verify
5. All tests green = Sprint 2 complete
