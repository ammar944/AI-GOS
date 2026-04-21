# Task 4.2: Journey Page Wiring

## Objective

Connect `addToolOutput`, update `sendAutomaticallyWhen`, add session hydration from localStorage, and wire progress tracking in the journey page.

## Context

The journey page (`src/app/journey/page.tsx`, ~162 lines) currently uses `useChat` with `DefaultChatTransport` and only destructures `sendMessage`, `addToolApprovalResponse`, `status`, `error`, `setMessages`. It uses `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses` which only handles approval tools, not askUser tool calls.

This task wires everything together:
1. Destructure `addToolOutput` from `useChat`
2. Combine `sendAutomaticallyWhen` predicates (tool calls + approval responses)
3. Create `handleAskUserResponse` that writes to localStorage and calls `addToolOutput`
4. Add session hydration on mount from localStorage
5. Track and pass `completionPercent` to `JourneyHeader`
6. Pass `onAskUserResponse` to each `ChatMessage`

## Dependencies

- Task 1.2 — `OnboardingState`, `calculateCompletion` from session-state
- Task 1.3 — `getJourneySession`, `setJourneySession` from local-storage
- Task 2.1 — Route now supports askUser tool (backend ready)
- Task 4.1 — ChatMessage now accepts `onAskUserResponse` prop

## Blocked By

- Task 4.1 complete

## Research Findings

- From `ai-sdk-tool-implementation.md`: `addToolOutput({ tool, toolCallId, output })` — `tool` is the tool name string, `output` is a string. The `tool` field IS required.
- From `persistence-implementation.md`: Full hydration code, `handleAskUserResponse` callback, `sendAutomaticallyWhen` combined predicate.
- From DISCOVERY.md D6: Use `addToolOutput()` NOT deprecated `addToolResult()`.
- From DISCOVERY.md D7: Combine both predicates: `lastAssistantMessageIsCompleteWithToolCalls` OR `lastAssistantMessageIsCompleteWithApprovalResponses`.
- From DISCOVERY.md D11: localStorage for instant hydration, Supabase for authoritative storage.
- From DISCOVERY.md D15: No resume logic in Sprint 2. Persist state but start fresh conversation on return.

## Implementation Plan

### Step 1: Read current page

Read the full `src/app/journey/page.tsx`. Understand:
1. Current `useChat` destructuring
2. Current `sendAutomaticallyWhen` configuration
3. How messages are rendered
4. How `ChatMessage` is invoked with props
5. Existing error handling

### Step 2: Add imports

```typescript
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import { getJourneySession, setJourneySession } from '@/lib/storage/local-storage';
import { calculateCompletion } from '@/lib/journey/session-state';
import type { OnboardingState } from '@/lib/journey/session-state';
import type { AskUserResult } from '@/components/journey/ask-user-card';
```

### Step 3: Add state and hydration

```typescript
const [completionPercentage, setCompletionPercentage] = useState(0);

// Hydrate from localStorage on mount
useEffect(() => {
  const saved = getJourneySession();
  if (saved) {
    setCompletionPercentage(saved.completionPercent ?? 0);
  }
}, []);
```

### Step 4: Update useChat destructuring

```typescript
const {
  messages,
  sendMessage,
  addToolOutput,             // NEW
  addToolApprovalResponse,
  status,
  error,
  setMessages,
} = useChat({
  transport,
  sendAutomaticallyWhen: (msg) =>
    lastAssistantMessageIsCompleteWithToolCalls(msg) ||
    lastAssistantMessageIsCompleteWithApprovalResponses(msg),
  onError: (err) => { /* existing error handling */ },
});
```

### Step 5: Create handleAskUserResponse callback

```typescript
const handleAskUserResponse = useCallback(
  (toolCallId: string, fieldName: string, result: AskUserResult) => {
    // 1. Write to localStorage immediately (belt)
    const value = 'selectedLabels' in result
      ? result.selectedLabels
      : 'selectedLabel' in result
        ? result.selectedLabel
        : 'otherText' in result
          ? result.otherText
          : null;

    if (value !== null) {
      const current = getJourneySession() ?? {
        phase: 'onboarding' as const,
        requiredFieldsCompleted: 0,
        completionPercent: 0,
        lastUpdated: new Date().toISOString(),
      };
      const updated: OnboardingState = {
        ...current,
        [fieldName]: value,
        lastUpdated: new Date().toISOString(),
      };
      const { requiredFieldsCompleted, completionPercent } = calculateCompletion(updated);
      updated.requiredFieldsCompleted = requiredFieldsCompleted;
      updated.completionPercent = completionPercent;
      setJourneySession(updated);
      setCompletionPercentage(completionPercent);
    }

    // 2. Send tool output to backend (triggers next step)
    // NOTE: `tool` field IS required — specifies which tool this output is for
    addToolOutput({
      tool: 'askUser',
      toolCallId,
      output: JSON.stringify(result),
    });
  },
  [addToolOutput]
);
```

### Step 6: Pass props to components

```tsx
<JourneyHeader completionPercentage={completionPercentage} />

{/* In the messages map: */}
<ChatMessage
  key={message.id}
  messageId={message.id}
  role={message.role as 'user' | 'assistant'}
  parts={message.parts}
  isStreaming={/* existing logic */}
  onToolApproval={(approvalId, approved) =>
    addToolApprovalResponse({ id: approvalId, approved })
  }
  onAskUserResponse={handleAskUserResponse}
/>
```

### Step 7: Preserve existing functionality

- All existing error handling preserved
- `MissingToolResultsError` cleanup preserved
- Auto-scroll behavior preserved
- Welcome message rendering preserved
- Typing indicator preserved

## Files to Create

- None

## Files to Modify

- `src/app/journey/page.tsx` — add imports, add state + hydration, update useChat, add handleAskUserResponse, pass new props

## Contracts

### Provides (for downstream tasks)

- Complete working page: askUser chips → selection → addToolOutput → next question
- Progress bar updates after each required field answered
- Session state persisted to localStorage after each selection

### Consumes (from upstream tasks)

- Task 1.2: `OnboardingState`, `calculateCompletion` from `@/lib/journey/session-state`
- Task 1.3: `getJourneySession`, `setJourneySession` from `@/lib/storage/local-storage`
- Task 2.1: Route supports askUser tool and body.messages extraction
- Task 4.1: `ChatMessage` accepts `onAskUserResponse` prop

## Acceptance Criteria

- [ ] `addToolOutput` destructured from useChat (NOT `addToolResult`)
- [ ] `sendAutomaticallyWhen` uses combined predicate (tool calls OR approval responses)
- [ ] Tapping a chip calls addToolOutput with structured JSON
- [ ] localStorage updated immediately after each selection
- [ ] Progress bar updates after each required field answered
- [ ] Session hydration on mount from localStorage
- [ ] Existing error handling preserved (MissingToolResultsError cleanup)
- [ ] Existing auto-scroll behavior preserved
- [ ] Welcome message still renders correctly
- [ ] `npm run build` passes

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds

## Skills to Read

- `.claude/orchestration-sprint2-onboarding/skills/ai-sdk-interactive-tools/SKILL.md` — addToolOutput, sendAutomaticallyWhen
- `.claude/orchestration-sprint2-onboarding/skills/onboarding-persistence/SKILL.md` — localStorage hydration

## Research Files to Read

- `.claude/orchestration-sprint2-onboarding/research/persistence-implementation.md` — Section 6: Frontend Hydration
- `.claude/orchestration-sprint2-onboarding/research/ai-sdk-tool-implementation.md` — addToolOutput API

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 4.2:`
