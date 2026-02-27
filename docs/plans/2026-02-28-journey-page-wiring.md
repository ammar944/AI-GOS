# Task 4.2: Journey Page Wiring — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire `addToolOutput`, combined `sendAutomaticallyWhen`, session hydration, and progress tracking into `src/app/journey/page.tsx`.

**Architecture:** Single-file modification to the journey page component. Adds `addToolOutput` from `useChat`, combines two predicates for `sendAutomaticallyWhen`, creates a `handleAskUserResponse` callback that updates localStorage and calculates progress, and hydrates session state on mount. All upstream dependencies (ChatMessage `onToolOutput` prop, JourneyHeader `completionPercentage` prop, `calculateCompletion`, localStorage helpers) are already implemented.

**Tech Stack:** React 19, AI SDK v6 (`useChat`, `addToolOutput`, `lastAssistantMessageIsCompleteWithToolCalls`), localStorage persistence

---

## Pre-Implementation Checklist

Before starting, verify these upstream dependencies exist:
- `ChatMessage` has `onToolOutput?: (toolCallId: string, result: AskUserResult) => void` prop
- `JourneyHeader` has `completionPercentage?: number` prop
- `calculateCompletion()` exported from `src/lib/journey/session-state.ts`
- `getJourneySession()` / `setJourneySession()` exported from `src/lib/storage/local-storage.ts`
- `AskUserResult` type exported from `src/components/journey/ask-user-card.tsx`

---

### Task 1: Add New Imports

**Files:**
- Modify: `src/app/journey/page.tsx:1-14`

**Step 1: Add `lastAssistantMessageIsCompleteWithToolCalls` to the `ai` import**

```typescript
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
```

**Step 2: Add `useState` to the React import**

Change:
```typescript
import { useRef, useMemo, useEffect, useCallback } from 'react';
```
To:
```typescript
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
```

**Step 3: Add localStorage, session-state, and type imports**

```typescript
import { getJourneySession, setJourneySession } from '@/lib/storage/local-storage';
import { calculateCompletion, createEmptyState } from '@/lib/journey/session-state';
import type { OnboardingState } from '@/lib/journey/session-state';
import type { AskUserResult } from '@/components/journey/ask-user-card';
```

**Step 4: Verify no import errors**

Run: `npx tsc --noEmit src/app/journey/page.tsx 2>&1 | head -20`
Expected: No import-related errors (other errors OK at this stage)

---

### Task 2: Add Completion State and Hydration Effect

**Files:**
- Modify: `src/app/journey/page.tsx` — inside `JourneyPage` component body, after `messagesEndRef`

**Step 1: Add completion percentage state**

After `const messagesEndRef = useRef<HTMLDivElement>(null);`, add:

```typescript
const [completionPercentage, setCompletionPercentage] = useState(0);
```

**Step 2: Add hydration useEffect**

After the transport `useMemo`, add:

```typescript
// Hydrate completion from localStorage on mount (client-only, avoids SSR mismatch)
useEffect(() => {
  const saved = getJourneySession();
  if (saved) {
    setCompletionPercentage(saved.completionPercent ?? 0);
  }
}, []);
```

---

### Task 3: Update useChat — Destructure `addToolOutput` and Update `sendAutomaticallyWhen`

**Files:**
- Modify: `src/app/journey/page.tsx:29-48`

**Step 1: Add `addToolOutput` to destructuring**

Change:
```typescript
const { messages, sendMessage, addToolApprovalResponse, status, error, setMessages } = useChat({
```
To:
```typescript
const { messages, sendMessage, addToolOutput, addToolApprovalResponse, status, error, setMessages } = useChat({
```

**Step 2: Update `sendAutomaticallyWhen` to combined predicate**

Change:
```typescript
sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
```
To:
```typescript
sendAutomaticallyWhen: ({ messages }) =>
  lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
  lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
```

This ensures the SDK auto-sends after BOTH `addToolOutput()` (askUser tool calls) AND `addToolApprovalResponse()` (approval-gated tools like editBlueprint).

---

### Task 4: Update `hasPendingApproval` to Include `input-available` State

**Files:**
- Modify: `src/app/journey/page.tsx:55-69`

**Step 1: Rename and expand the pending check**

Change:
```typescript
const hasPendingApproval = messages.some(
  (msg) =>
    msg.role === 'assistant' &&
    msg.parts.some(
      (part) =>
        typeof part === 'object' &&
        'type' in part &&
        typeof (part as Record<string, unknown>).type === 'string' &&
        ((part as Record<string, unknown>).type as string).startsWith('tool-') &&
        'state' in part &&
        (part as Record<string, unknown>).state === 'approval-requested'
    )
);

const isLoading = isStreaming || isSubmitted || hasPendingApproval;
```

To:
```typescript
// Block input while any tool is waiting for user interaction (chips or approval)
const hasPendingToolInteraction = messages.some(
  (msg) =>
    msg.role === 'assistant' &&
    msg.parts.some(
      (part) =>
        typeof part === 'object' &&
        'type' in part &&
        typeof (part as Record<string, unknown>).type === 'string' &&
        ((part as Record<string, unknown>).type as string).startsWith('tool-') &&
        'state' in part &&
        ((part as Record<string, unknown>).state === 'approval-requested' ||
          (part as Record<string, unknown>).state === 'input-available')
    )
);

const isLoading = isStreaming || isSubmitted || hasPendingToolInteraction;
```

This blocks the chat input whenever askUser chips are visible (state: `input-available`) OR an approval card is showing (state: `approval-requested`).

---

### Task 5: Create `handleAskUserResponse` Callback

**Files:**
- Modify: `src/app/journey/page.tsx` — after the `handleSubmit` callback

**Step 1: Add the handleAskUserResponse callback**

After the `handleSubmit` callback (around line 83), add:

```typescript
// Handle askUser chip tap → persist to localStorage + send tool output
const handleAskUserResponse = useCallback(
  (toolCallId: string, result: AskUserResult) => {
    // 1. Extract the value for localStorage persistence
    const value: unknown = 'selectedLabels' in result
      ? result.selectedLabels
      : 'selectedLabel' in result
        ? result.selectedLabel
        : 'otherText' in result
          ? result.otherText
          : null;

    // 2. Update localStorage immediately (belt — fast hydration)
    if (value !== null) {
      const current = getJourneySession() ?? createEmptyState();
      const updated: OnboardingState = {
        ...current,
        [result.fieldName]: value,
        lastUpdated: new Date().toISOString(),
      };
      const { requiredFieldsCompleted, completionPercent } = calculateCompletion(updated);
      updated.requiredFieldsCompleted = requiredFieldsCompleted;
      updated.completionPercent = completionPercent;
      setJourneySession(updated);
      setCompletionPercentage(completionPercent);
    }

    // 3. Send tool output to SDK (triggers next round trip via sendAutomaticallyWhen)
    addToolOutput({
      tool: 'askUser',
      toolCallId,
      output: JSON.stringify(result),
    });
  },
  [addToolOutput]
);
```

---

### Task 6: Pass New Props to Components

**Files:**
- Modify: `src/app/journey/page.tsx` — JSX section

**Step 1: Pass `completionPercentage` to JourneyHeader**

Change:
```tsx
<JourneyHeader />
```
To:
```tsx
<JourneyHeader completionPercentage={completionPercentage} />
```

**Step 2: Pass `onToolOutput` to ChatMessage**

In the messages map, add `onToolOutput` prop. Change:
```tsx
<ChatMessage
  key={message.id}
  messageId={message.id}
  role={message.role as 'user' | 'assistant'}
  parts={message.parts}
  isStreaming={isThisMessageStreaming}
  onToolApproval={(approvalId, approved) =>
    addToolApprovalResponse({ id: approvalId, approved })
  }
/>
```
To:
```tsx
<ChatMessage
  key={message.id}
  messageId={message.id}
  role={message.role as 'user' | 'assistant'}
  parts={message.parts}
  isStreaming={isThisMessageStreaming}
  onToolApproval={(approvalId, approved) =>
    addToolApprovalResponse({ id: approvalId, approved })
  }
  onToolOutput={handleAskUserResponse}
/>
```

---

### Task 7: Build Verification

**Step 1: Run the build**

Run: `npm run build`
Expected: Build succeeds with no type errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: No lint errors in modified file

**Step 3: Commit**

```bash
git add src/app/journey/page.tsx
git commit -m "Task 4.2: wire addToolOutput, sendAutomaticallyWhen, session hydration, and progress tracking"
```

---

## Acceptance Criteria Verification

| Criterion | How to Verify |
|-----------|--------------|
| `addToolOutput` destructured from useChat (NOT `addToolResult`) | Grep `page.tsx` for `addToolOutput` — present; grep for `addToolResult` — absent |
| `sendAutomaticallyWhen` uses combined predicate | Grep for `lastAssistantMessageIsCompleteWithToolCalls` in page.tsx |
| Tapping a chip calls addToolOutput with structured JSON | `handleAskUserResponse` calls `addToolOutput({ tool: 'askUser', toolCallId, output: JSON.stringify(result) })` |
| localStorage updated immediately after each selection | `handleAskUserResponse` calls `setJourneySession(updated)` before `addToolOutput` |
| Progress bar updates after each required field answered | `handleAskUserResponse` calls `setCompletionPercentage(completionPercent)` |
| Session hydration on mount from localStorage | `useEffect` reads `getJourneySession()` and sets `completionPercentage` |
| Existing error handling preserved | `onError` callback unchanged, MissingToolResultsError cleanup preserved |
| `npm run build` passes | Run build, verify exit code 0 |
