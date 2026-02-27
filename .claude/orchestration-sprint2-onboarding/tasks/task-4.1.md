# Task 4.1: Chat Message askUser Rendering

## Objective

Update `chat-message.tsx` to render `AskUserCard` for askUser tool parts and pass `state` to `ThinkingBlock` for reasoning parts.

## Context

The existing `chat-message.tsx` (`src/components/journey/chat-message.tsx`, ~615 lines) has a complex `renderMessageParts()` function that processes message parts and renders appropriate components. It currently handles reasoning parts (ThinkingBlock), tool parts (various cards), text parts (markdown rendering), etc.

This task adds two things:
1. A new case in `renderToolPart()` for `toolName === 'askUser'` that renders `<AskUserCard>`
2. Passing the `state` property from `ReasoningUIPart` to `ThinkingBlock`

## Dependencies

- Task 3.1 — AskUserCard component
- Task 3.2 — ThinkingBlock with `state` prop

## Blocked By

- Phase 3 complete

## Research Findings

- From `ai-sdk-tool-implementation.md`: Tool parts have `state` field: `'input-streaming'`, `'input-available'`, `'output-available'`.
- From DISCOVERY.md D8: Output format for addToolOutput.
- From `thinking-block-streaming.md`: ReasoningUIPart has `state?: 'streaming' | 'done'`.
- From DISCOVERY.md D20: Must pass `state` from reasoning part to ThinkingBlock (currently missing).

## Implementation Plan

### Step 1: Read current chat-message.tsx

Read the full `src/components/journey/chat-message.tsx`. Identify:
1. The `renderToolPart()` function and existing tool name cases
2. The reasoning part rendering block in `renderMessageParts()`
3. The `ChatMessageProps` interface
4. How `onToolApproval` is threaded through

### Step 2: Add import

```typescript
import { AskUserCard } from '@/components/journey/ask-user-card';
import type { AskUserResult } from '@/components/journey/ask-user-card';
```

### Step 3: Add `onAskUserResponse` prop

```typescript
interface ChatMessageProps {
  role: 'user' | 'assistant';
  content?: string;
  parts?: Array<{ type: string; [key: string]: unknown }>;
  messageId?: string;
  isStreaming?: boolean;
  onToolApproval?: (approvalId: string, approved: boolean) => void;
  onAskUserResponse?: (toolCallId: string, fieldName: string, result: AskUserResult) => void;  // NEW
  className?: string;
}
```

### Step 4: Add askUser case in renderToolPart

The existing `renderToolPart()` extracts `toolName` from `part.type.replace('tool-', '')` and already handles `input-streaming`/`input-available` generically. Add a SPECIFIC check for `toolName === 'askUser'` BEFORE the generic loading states so it short-circuits:

```typescript
// ADD THIS at the top of renderToolPart, right after the variable declarations:
if (toolName === 'askUser') {
  const askInput = input as {
    question?: string;
    fieldName?: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  } | undefined;

  if (state === 'input-streaming') {
    return <ToolLoadingIndicator key={key} toolName="askUser" args={{ label: 'Preparing question...' }} />;
  }

  if (state === 'input-available' && askInput) {
    return (
      <AskUserCard
        key={key}
        fieldName={askInput.fieldName ?? 'unknown'}
        options={askInput.options ?? []}
        multiSelect={askInput.multiSelect ?? false}
        onSubmit={(result) => {
          onAskUserResponse?.(
            part.toolCallId as string,
            askInput.fieldName ?? 'unknown',
            result
          );
        }}
      />
    );
  }

  if (state === 'output-available') {
    let previousSelection: AskUserResult | undefined;
    try {
      const raw = part.output;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      previousSelection = parsed as AskUserResult;
    } catch { /* ignore parse errors */ }

    return (
      <AskUserCard
        key={key}
        fieldName={askInput?.fieldName ?? 'unknown'}
        options={askInput?.options ?? []}
        multiSelect={askInput?.multiSelect ?? false}
        onSubmit={() => {}}
        disabled
        previousSelection={previousSelection}
      />
    );
  }

  return null; // Unknown state
}
// THEN the existing generic tool handling continues below...
```

**NOTE**: The existing code uses `toolName` (extracted from `part.type.replace('tool-', '')`), NOT `part.type` directly. Checking `toolName === 'askUser'` is correct and consistent with the codebase pattern (see line 275: `const toolName = (part.type as string).replace('tool-', '');`).

### Step 5: Pass `state` to ThinkingBlock

Update the reasoning part rendering in `renderMessageParts()`:

From:
```typescript
<ThinkingBlock
  key={`${messageId}-thinking-${i}`}
  content={(part.text as string) || ''}
/>
```

To:
```typescript
<ThinkingBlock
  key={`${messageId}-thinking-${i}`}
  content={(part.text as string) || ''}
  state={(part as { state?: string }).state as 'streaming' | 'done' | undefined}
/>
```

### Step 6: Thread onAskUserResponse through rendering

Update `renderToolPart()` to accept an `onAskUserResponse` parameter (same pattern as `onToolApproval`):

```typescript
function renderToolPart(
  part: Record<string, unknown>,
  key: string,
  onToolApproval?: (approvalId: string, approved: boolean) => void,
  onAskUserResponse?: (toolCallId: string, fieldName: string, result: AskUserResult) => void,  // NEW
): React.ReactNode {
```

Update `renderMessageParts()` to accept and pass through `onAskUserResponse`:

```typescript
function renderMessageParts(
  parts: Array<{ type: string; [key: string]: unknown }>,
  messageId: string,
  isStreaming: boolean,
  onToolApproval?: (approvalId: string, approved: boolean) => void,
  onAskUserResponse?: (toolCallId: string, fieldName: string, result: AskUserResult) => void,  // NEW
): React.ReactNode {
  // ... in the tool- check:
  const toolElement = renderToolPart(part as Record<string, unknown>, `${messageId}-tool-${i}`, onToolApproval, onAskUserResponse);
```

In the `ChatMessage` component itself, pass `onAskUserResponse` through to `renderMessageParts`.

### Step 7: Verify existing renderers unchanged

Ensure no changes to:
- editBlueprint tool rendering
- deepResearch tool rendering
- Any other existing tool rendering
- Text/markdown rendering
- All other message part handling

## Files to Create

- None

## Files to Modify

- `src/components/journey/chat-message.tsx` — add AskUserCard import, add `onAskUserResponse` prop, add askUser case in renderToolPart, pass `state` to ThinkingBlock

## Contracts

### Provides (for downstream tasks)

- `ChatMessage` component now renders askUser tool parts as interactive chip cards
- `ChatMessage` passes `state` to ThinkingBlock for live timer
- New prop: `onAskUserResponse?: (toolCallId: string, fieldName: string, result: AskUserResult) => void`

### Consumes (from upstream tasks)

- Task 3.1: `AskUserCard` component and `AskUserResult` type
- Task 3.2: `ThinkingBlock` with `state` prop

## Acceptance Criteria

- [ ] askUser tool parts render as AskUserCard when `state === 'input-available'`
- [ ] Answered askUser parts render as disabled AskUserCard with previous selection
- [ ] Streaming askUser parts show loading indicator
- [ ] ThinkingBlock receives `state` prop from reasoning parts
- [ ] `onAskUserResponse` callback threaded through to AskUserCard's onSubmit
- [ ] Existing tool renderers (editBlueprint, deepResearch, etc.) unchanged
- [ ] Existing text/markdown rendering unchanged
- [ ] `npm run build` passes

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds

## Skills to Read

- `.claude/orchestration-sprint2-onboarding/skills/ai-sdk-interactive-tools/SKILL.md` — tool part states
- `.claude/orchestration-sprint2-onboarding/skills/chip-card-component/SKILL.md` — AskUserCard props

## Research Files to Read

- `.claude/orchestration-sprint2-onboarding/research/chip-component-implementation.md` — Section 1.2 Props Interface
- `.claude/orchestration-sprint2-onboarding/research/thinking-block-streaming.md` — Section 7 Implementation Plan

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 4.1:`
