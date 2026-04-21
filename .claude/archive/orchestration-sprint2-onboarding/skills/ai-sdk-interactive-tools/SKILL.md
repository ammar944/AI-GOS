---
name: ai-sdk-interactive-tools
description: AI SDK v6 interactive tool patterns (tools without execute). Use when implementing tools that require user interaction (addToolOutput), configuring stopWhen/stepCountIs, or wiring sendAutomaticallyWhen.
---

## 1. Defining an Interactive Tool

An interactive tool has NO `execute` function. The SDK pauses the step and waits for the frontend to call `addToolOutput()`.

```typescript
// src/lib/ai/tools/ask-user.ts
import { tool } from 'ai';
import { z } from 'zod';

export const askUser = tool({
  description: 'Ask the user a structured question with tappable option chips.',
  inputSchema: z.object({
    question: z.string(),
    options: z.array(z.object({
      label: z.string(),
      description: z.string().optional(),
    })).min(2).max(6),
    multiSelect: z.boolean(),
    fieldName: z.string(),
  }),
  // NO execute -- omitting it makes this an interactive tool.
  // SDK will not auto-execute; frontend must call addToolOutput().
});
```

Import: `tool` comes from `'ai'` (re-exported from `@ai-sdk/provider-utils`).

---

## 2. Route Integration — `stepCountIs` replaces `maxSteps`

`maxSteps` is REMOVED from AI SDK v6. Use `stopWhen: stepCountIs(N)`.

```typescript
// src/app/api/journey/stream/route.ts
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { askUser } from '@/lib/ai/tools/ask-user';

const result = streamText({
  model: anthropic(MODELS.CLAUDE_OPUS),
  system: LEAD_AGENT_SYSTEM_PROMPT,
  messages: await convertToModelMessages(sanitizedMessages),
  tools: { askUser },
  stopWhen: stepCountIs(15),   // replaces maxSteps: 15
  temperature: 0.3,
  providerOptions: { anthropic: { thinking: { type: 'adaptive' } } },
  onFinish: async ({ steps, totalUsage }) => {
    // LOGGING ONLY for interactive tools (see section 5).
    console.log(`[journey/stream] ${totalUsage?.totalTokens} tokens, ${steps.length} steps`);
  },
});

return result.toUIMessageStreamResponse();
```

`stepCountIs` signature: `(stepCount: number) => StopCondition<any>`

---

## 3. `addToolOutput()` — Exact Signature

```typescript
// Full type (from ai/dist/index.d.ts:3416):
addToolOutput: <TOOL extends keyof InferUIMessageTools<UI_MESSAGE>>({
  state?,   // 'output-available' (default) | 'output-error'
  tool,     // tool name as literal string matching the key in tools: {}
  toolCallId,
  output,   // typed to the tool's output type
  errorText?, // only when state: 'output-error'
}) => Promise<void>
```

Usage in a chip click handler:

```typescript
// Destructure from useChat:
const { addToolOutput, ... } = useChat({ transport, ... });

// Call on user chip tap (single-select):
await addToolOutput({
  tool: 'askUser',
  toolCallId: part.toolCallId as string,
  output: { fieldName: input.fieldName, selected: [label], selectedIndex: i },
});

// On error:
await addToolOutput({
  state: 'output-error',
  tool: 'askUser',
  toolCallId: part.toolCallId as string,
  errorText: 'Failed to capture selection',
});
```

DO NOT call `sendMessage()` after `addToolOutput()` — the SDK handles resending automatically via `sendAutomaticallyWhen`.

---

## 4. `sendAutomaticallyWhen` — Combined Predicate

```typescript
// src/app/journey/page.tsx
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';

const { messages, sendMessage, addToolOutput, addToolApprovalResponse, status } = useChat({
  transport,
  sendAutomaticallyWhen: ({ messages }) =>
    lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
    lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
});
```

- `lastAssistantMessageIsCompleteWithToolCalls` — fires after `addToolOutput()` resolves all pending tool calls.
- `lastAssistantMessageIsCompleteWithApprovalResponses` — fires after `addToolApprovalResponse()` for approval-gated tools (e.g., editBlueprint).
- Combining both handles all interactive tool types in the same chat.

---

## 5. CRITICAL: Interactive Tool Results Are NOT in `onFinish.steps`

For a tool with `execute`, the server runs it and the result appears in `onFinish.steps[N].toolResults`.

For an interactive tool (no `execute`), the tool result comes from the CLIENT on the NEXT HTTP request. So:

- **Request 1**: Model calls `askUser`. `onFinish.steps[0].toolResults = []`. Nothing to persist.
- **Client**: User taps chip. `addToolOutput()` fires. SDK auto-sends **Request 2**.
- **Request 2**: `body.messages` now contains the tool result inside an assistant message part with `state: 'output-available'`.

**Persist askUser results by scanning the INCOMING `body.messages`, not `onFinish.steps`.**

```typescript
// Run this BEFORE streamText(), after parsing body.messages:
function extractOnboardingFields(messages: UIMessage[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      if (
        p.type === 'tool-askUser' &&
        p.state === 'output-available' &&
        p.input &&
        p.output !== undefined
      ) {
        const input = p.input as { fieldName: string };
        fields[input.fieldName] = p.output;
      }
    }
  }
  return fields;
}

// In POST handler:
const fields = extractOnboardingFields(body.messages);
if (Object.keys(fields).length > 0) {
  persistToSupabase(userId, fields).catch((err) =>
    console.error('[journey/stream] persist failed:', err)
  );
}
```

---

## 6. Tool Part State Machine

```
input-streaming   → Tool arguments still streaming from model
      ↓
input-available   → Tool arguments complete; render interactive UI (chips)
      ↓          (user interaction here; addToolOutput() called)
output-available  → Tool result received; render completed/read-only UI
output-error      → Tool result was an error; render error state
```

Check `part.state` to gate rendering. Sanitize before `convertToModelMessages()` by dropping parts in `input-streaming` or `input-available` states (these are incomplete tool calls that would cause `MissingToolResultsError`).

```typescript
const INCOMPLETE_STATES = new Set(['input-streaming', 'input-available', 'approval-requested']);

const sanitized = body.messages.map((msg) => ({
  ...msg,
  parts: msg.parts.filter((part) => {
    const p = part as Record<string, unknown>;
    if (typeof p.type === 'string' && p.type.startsWith('tool-')) {
      if (INCOMPLETE_STATES.has(p.state as string)) return false;
    }
    return true;
  }),
})) as UIMessage[];
```

---

## 7. Detecting `tool-askUser` Parts in `renderToolPart`

Tool part `type` follows the pattern `'tool-${toolName}'`. For the `askUser` tool, `part.type === 'tool-askUser'`.

```typescript
// In renderToolPart(part, key, onToolApproval, onToolOutput):
if (part.type === 'tool-askUser') {
  const input = part.input as {
    question: string;
    options: Array<{ label: string; description?: string }>;
    multiSelect: boolean;
    fieldName: string;
  } | undefined;

  if (part.state === 'input-streaming') {
    return <div key={key} className="animate-pulse text-xs" style={{ color: 'var(--text-tertiary)' }}>
      Preparing question...
    </div>;
  }

  if (part.state === 'input-available' && input) {
    return (
      <AskUserCard
        key={key}
        question={input.question}
        options={input.options}
        multiSelect={input.multiSelect}
        fieldName={input.fieldName}
        onSubmit={(value) => onToolOutput?.(part.toolCallId as string, value)}
      />
    );
  }

  if (part.state === 'output-available') {
    return <AskUserCardCompleted key={key} input={input} output={part.output} />;
  }

  if (part.state === 'output-error') {
    return <div key={key} style={{ color: '#ef4444' }}>{part.errorText as string}</div>;
  }

  return null; // Unknown state — render nothing
}
// Fall through to generic tool handlers for other tools
```

Place the `askUser` check BEFORE the generic `input-streaming` / `input-available` handlers so it short-circuits first.

---

## Quick Reference

| Concept | API | Import |
|---------|-----|--------|
| Define interactive tool | `tool({ inputSchema, description })` — no `execute` | `'ai'` |
| Step limit | `stopWhen: stepCountIs(15)` | `'ai'` |
| Provide tool result | `addToolOutput({ tool, toolCallId, output })` | `useChat` return |
| Auto-send after tool output | `sendAutomaticallyWhen: ({ messages }) => lastAssistantMessageIsCompleteWithToolCalls({ messages })` | `'ai'` |
| Detect tool part type | `part.type === 'tool-askUser'` | — |
| Persist interactive results | Scan `body.messages` for `state: 'output-available'` parts | — |
