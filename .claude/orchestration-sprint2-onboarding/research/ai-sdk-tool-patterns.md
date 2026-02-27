# AI SDK Tool Patterns Research

**Date**: 2026-02-27
**Scope**: Vercel AI SDK v6 tool patterns for Sprint 2 conversational onboarding
**SDK Version in project**: `ai@^6.0.70`, `@ai-sdk/react@^3.0.75`, `@ai-sdk/anthropic@^3.0.36`

---

## 1. Three Categories of Tools in AI SDK v6

The AI SDK recognizes three distinct tool categories based on where execution happens:

### 1a. Server-Side Automatic Tools
- Have an `execute` function defined in the tool definition
- Execute automatically on the server when the model calls them
- Results are forwarded to the client stream automatically
- Example in codebase: `searchBlueprint`, `webResearch` in `src/lib/ai/chat-tools/`

### 1b. Client-Side Automatic Tools
- Server defines the tool with NO `execute` function (omit it entirely)
- Client handles via `onToolCall` callback on `useChat`
- Must call `addToolOutput()` inside `onToolCall` (WITHOUT await to avoid deadlocks)
- `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` triggers re-send

### 1c. Interactive User-Input Tools (What We Need for `askUser`)
- Server defines the tool with NO `execute` function
- Client renders a UI component based on the tool part state
- User interacts with the UI (clicks chip, types text, etc.)
- On interaction, client calls `addToolOutput()` with the user's response
- `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` triggers re-send
- The model receives the tool result and can continue the conversation

**This is the pattern for `askUser`.** The tool has no `execute` function on the server. The frontend renders chip cards, and when the user makes a selection, `addToolOutput()` sends the result back.

---

## 2. Tool Definition with `tool()`

### Import
```typescript
import { tool } from 'ai';
import { z } from 'zod';
```

### Server-Side Tool (with execute)
```typescript
const searchBlueprint = tool({
  description: 'Search the blueprint for information',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async ({ query }) => {
    return { results: [...] };
  },
});
```

### Interactive Tool (WITHOUT execute) -- The askUser Pattern
```typescript
const askUser = tool({
  description: 'Ask the user a structured question with tappable options',
  inputSchema: z.object({
    question: z.string().describe('The question to ask'),
    options: z.array(z.object({
      label: z.string(),
      description: z.string().optional(),
    })).describe('2-4 tappable options'),
    multiSelect: z.boolean().describe('Allow multiple selections'),
    fieldName: z.string().describe('The onboarding field this question populates'),
  }),
  // NO execute function -- result comes from user interaction on frontend
});
```

**Key**: When `execute` is omitted, the tool call is sent to the client as a tool part, the model's generation pauses (the step ends with `finishReason: 'tool-calls'`), and the SDK waits for the client to provide a result via `addToolOutput()` before continuing.

### Tool Definition Properties
| Property | Required | Description |
|----------|----------|-------------|
| `description` | Optional but recommended | Helps model decide when to call the tool |
| `inputSchema` | Yes | Zod schema defining parameters. Consumed by LLM and used for validation |
| `execute` | Optional | Async function. Omit for client-side/interactive tools |
| `needsApproval` | Optional | Boolean or async function. For approval workflows (NOT what we want for askUser) |
| `strict` | Optional | Enable strict schema validation |
| `inputExamples` | Optional | Example inputs to guide model behavior |
| `toModelOutput` | Optional | Custom mapping of what the model sees vs. what the UI sees |

---

## 3. `addToolOutput()` -- Frontend API

### Import and Usage
```typescript
const { messages, sendMessage, addToolOutput, status } = useChat({
  transport: new DefaultChatTransport({ api: '/api/journey/stream' }),
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
});
```

### Signature
```typescript
addToolOutput(options: {
  tool: string;        // Tool name (e.g., 'askUser')
  toolCallId: string;  // Unique ID from the tool part
  output: unknown;     // The result data (user's selection)
}) => void

// OR for errors:
addToolOutput(options: {
  tool: string;
  toolCallId: string;
  state: 'output-error';
  errorText: string;
}) => void
```

### How to Call It
```tsx
// In your component rendering tool parts:
case 'tool-askUser': {
  if (part.state === 'input-available') {
    return (
      <AskUserCard
        question={part.input.question}
        options={part.input.options}
        multiSelect={part.input.multiSelect}
        onSubmit={(selectedValues) => {
          addToolOutput({
            tool: 'askUser',
            toolCallId: part.toolCallId,
            output: JSON.stringify(selectedValues),
          });
        }}
      />
    );
  }
  if (part.state === 'output-available') {
    return <AskUserCardCompleted selection={part.output} />;
  }
}
```

### Critical Rules for `addToolOutput()`
1. **NEVER `await` it inside `onToolCall`** -- causes deadlocks
2. Call it directly (synchronously) when the user interacts
3. The `tool` parameter must match the tool name exactly
4. The `toolCallId` comes from the tool part object
5. The `output` can be any serializable value -- string, object, array
6. After calling `addToolOutput()`, the SDK updates the message parts locally and (if `sendAutomaticallyWhen` returns true) automatically re-sends the conversation to the server

---

## 4. `addToolOutput()` vs `addToolApprovalResponse()` -- When to Use Each

### `addToolOutput()` -- For providing tool results
- **Use when**: The tool has NO `execute` function and the result comes from the client (user interaction or client computation)
- **What it does**: Sets the tool part state to `output-available` with the provided output
- **When the model gets it**: The output is sent back to the server as a tool result in the next request
- **Our use case**: `askUser` tool -- user selects chips, we call `addToolOutput` with their selection

### `addToolApprovalResponse()` -- For approving/denying tool execution
- **Use when**: The tool HAS an `execute` function AND `needsApproval: true`
- **What it does**: Either allows the server-side `execute` to run (approved) or blocks it (denied)
- **State flow**: `approval-requested` -> `approval-responded` -> `output-available` (if approved) or `output-denied` (if denied)
- **Existing use case**: `editBlueprint` tool in the chat agent -- user approves/rejects edits

### Decision Matrix

| Scenario | Tool has `execute`? | `needsApproval`? | Frontend calls |
|----------|--------------------|--------------------|----------------|
| Server auto-executes | Yes | No | Nothing |
| Server needs approval | Yes | Yes | `addToolApprovalResponse()` |
| Client auto-executes | No | No | `addToolOutput()` in `onToolCall` |
| User provides input | No | No | `addToolOutput()` on user action |

**For `askUser`: No `execute`, no `needsApproval`. Use `addToolOutput()`.**

### Signature Comparison
```typescript
// addToolOutput -- provides the result
addToolOutput({
  tool: 'askUser',
  toolCallId: 'call_abc123',
  output: { selected: ['B2B SaaS'] },
});

// addToolApprovalResponse -- approves/denies execution
addToolApprovalResponse({
  id: 'approval_xyz789',     // approval.id from the part
  approved: true,            // boolean
  reason: 'User confirmed',  // optional
});
```

---

## 5. Tool Part States in `message.parts`

### Part Type Convention
Tool parts use the naming pattern `tool-${toolName}`. For a tool named `askUser`, the part type is `tool-askUser`.

### State Machine

```
Server tools (with execute):
  input-streaming → input-available → output-available
                                    → output-error

Server tools (with execute + needsApproval):
  input-streaming → input-available → approval-requested → approval-responded → output-available
                                                         → output-denied

Interactive tools (without execute) -- THE askUser PATTERN:
  input-streaming → input-available → [waiting for addToolOutput] → output-available
                                                                   → output-error (if error sent)
```

### Part Object Structure
```typescript
// During streaming (input-streaming):
{
  type: 'tool-askUser',
  toolCallId: 'call_abc123',
  state: 'input-streaming',
  input: { /* partial input as it streams */ },
}

// Input complete (input-available):
{
  type: 'tool-askUser',
  toolCallId: 'call_abc123',
  state: 'input-available',
  input: {
    question: 'What type of business do you run?',
    options: [
      { label: 'B2B SaaS', description: 'Software sold to businesses' },
      { label: 'B2C', description: 'Direct to consumer' },
    ],
    multiSelect: false,
    fieldName: 'businessModel',
  },
}

// For needsApproval tools only (NOT askUser):
{
  type: 'tool-editBlueprint',
  state: 'approval-requested',
  input: { ... },
  approval: { id: 'approval_xyz789' },
}

// After addToolOutput (output-available):
{
  type: 'tool-askUser',
  toolCallId: 'call_abc123',
  state: 'output-available',
  input: { ... },
  output: { selected: ['B2B SaaS'] },
}
```

### Rendering Pattern
```tsx
function renderToolPart(part: ToolPart) {
  switch (part.type) {
    case 'tool-askUser': {
      switch (part.state) {
        case 'input-streaming':
          return <Skeleton />; // Optional: show loading
        case 'input-available':
          return <AskUserCard {...part.input} onSubmit={...} />;
        case 'output-available':
          return <AskUserCardCompleted input={part.input} output={part.output} />;
        case 'output-error':
          return <ErrorCard message={part.errorText} />;
      }
    }
  }
}
```

---

## 6. Multi-Step Tool Execution

### Server-Side: `stopWhen` (replaces deprecated `maxSteps`)

```typescript
import { streamText, stepCountIs } from 'ai';

const result = streamText({
  model: anthropic(MODELS.CLAUDE_OPUS),
  system: LEAD_AGENT_SYSTEM_PROMPT,
  messages: await convertToModelMessages(sanitizedMessages),
  tools: { askUser },
  stopWhen: stepCountIs(15),  // Up to 15 tool-call-result cycles
  temperature: 0.3,
});
```

**How it works**:
1. Model generates text + tool calls in step 1
2. If tool has `execute`: SDK runs it, feeds result back, model continues in step 2
3. If tool has NO `execute`: Step ends, stream completes, client receives tool part
4. Client calls `addToolOutput()`, which triggers a new request (new step starts)
5. Repeat until model generates text without tool calls, or step limit reached

**`stopWhen` conditions are evaluated ONLY when the last step contains tool results.** This means they don't prevent the initial generation, only limit the loop count.

### `stopWhen` vs `maxSteps`
- `maxSteps` was deprecated in AI SDK v5.0
- `stopWhen: stepCountIs(N)` is the replacement
- `stepCountIs(1)` is the default (no multi-step)
- Can combine conditions: `stopWhen: [stepCountIs(10), hasToolCall('finalizeTask')]`
- Can use custom logic: `stopWhen: ({ steps }) => steps.length > 3`

### `prepareStep` for Per-Step Control
```typescript
prepareStep: ({ steps, stepNumber }) => {
  // After an askUser tool response, don't force any specific tool
  // Let the model decide what to do next
  return {};

  // OR: Force a specific tool on step 0
  if (stepNumber === 0) {
    return { toolChoice: { type: 'tool', toolName: 'askUser' } };
  }
},
```

### Important: Multi-Step with Interactive Tools

When a tool has NO `execute` function, multi-step works differently:

1. **Server sends stream with tool call** -- step 1 completes with `finishReason: 'tool-calls'`
2. **Client receives the tool part** -- renders UI, waits for user
3. **User interacts** -- `addToolOutput()` is called
4. **`sendAutomaticallyWhen` triggers** -- a NEW HTTP request is made to the server
5. **Server receives the full message history** including the tool result
6. **Server continues** -- this counts as step 2 from the server's perspective
7. **`stopWhen` is evaluated** -- if conditions not met, model can call more tools

**Key insight**: Each client-to-server round trip counts as a step from the `stopWhen` perspective. With `stepCountIs(15)` and 8 `askUser` calls, you'd use 8+ steps (one per askUser, plus any that chain multiple server-executed tools).

---

## 7. `sendAutomaticallyWhen` -- The Auto-Submit Mechanism

### Purpose
Controls when `useChat` automatically re-submits the conversation to the server after tool output is added or the stream completes.

### Available Helpers
```typescript
import {
  lastAssistantMessageIsCompleteWithToolCalls,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
```

### `lastAssistantMessageIsCompleteWithToolCalls`
- Returns `true` when: the last assistant message is complete AND all tool calls in it have results (via `addToolOutput`)
- Use for: interactive tools and client-side tools
- **This is what we need for `askUser`**

### `lastAssistantMessageIsCompleteWithApprovalResponses`
- Returns `true` when: the last assistant message is complete AND all approval-requested tools have received approval responses (via `addToolApprovalResponse`)
- Use for: tools with `needsApproval: true`
- **This is what the existing journey page uses** (for `editBlueprint` compatibility)

### Choosing the Right One

For Sprint 2, we have TWO auto-submit scenarios:
1. `askUser` tool (no execute) -- needs `lastAssistantMessageIsCompleteWithToolCalls`
2. Potential future approval tools -- needs `lastAssistantMessageIsCompleteWithApprovalResponses`

**Solution**: Use BOTH. The `sendAutomaticallyWhen` accepts a custom function:
```typescript
sendAutomaticallyWhen: ({ messages }) => {
  return (
    lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
    lastAssistantMessageIsCompleteWithApprovalResponses({ messages })
  );
},
```

Or, since the journey page currently only has the `askUser` tool (no approval tools):
```typescript
sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
```

---

## 8. Gotchas and Edge Cases

### 8a. Sanitization of Incomplete Tool Parts
When sending messages back to the server, any tool parts in `input-streaming` or `input-available` state (without a result) will cause `MissingToolResultsError` during `convertToModelMessages()`.

**Current codebase pattern** (from `src/app/api/journey/stream/route.ts`):
```typescript
const INCOMPLETE_TOOL_STATES = new Set([
  'input-streaming',
  'input-available',
  'approval-requested',
]);

const sanitizedMessages = body.messages.map((msg) => ({
  ...msg,
  parts: msg.parts.filter((part) => {
    if (typeof part === 'object' && 'type' in part &&
        typeof part.type === 'string' && part.type.startsWith('tool-') &&
        part.type !== 'tool-invocation') {
      const state = (part as Record<string, unknown>).state as string | undefined;
      if (state && INCOMPLETE_TOOL_STATES.has(state)) return false;
    }
    return true;
  }),
})) as UIMessage[];
```

**This is critical**: When a user closes the browser mid-tool-call and returns, the message history may contain tool parts stuck in `input-available`. The sanitization filter prevents crashes.

### 8b. No `await` on `addToolOutput` in `onToolCall`
Calling `await addToolOutput(...)` inside the `onToolCall` callback creates a deadlock because `onToolCall` is called during the stream processing, and `addToolOutput` tries to update the same state.

**For interactive tools**, `addToolOutput` is called OUTSIDE `onToolCall` (in a click handler), so this is not an issue.

### 8c. `addToolOutput` vs Deprecated `addToolResult`
- `addToolResult` was deprecated in AI SDK v5.0 in favor of `addToolOutput`
- `addToolResult` is still available but will be removed in a future version
- **Always use `addToolOutput`** in new code
- The PRD mentions `addToolResult()` -- this should be updated to `addToolOutput()` in implementation

**Note**: The PRD says "Does NOT use `needsApproval` -- uses direct `addToolResult()` pattern". The intent is correct (interactive tool, no approval), but the method name should be `addToolOutput()`.

### 8d. Tool Output Format
The `output` parameter of `addToolOutput` can be any JSON-serializable value. For `askUser`, recommend using a structured object:
```typescript
addToolOutput({
  tool: 'askUser',
  toolCallId: part.toolCallId,
  output: JSON.stringify({
    fieldName: 'businessModel',
    selected: ['B2B SaaS'],
    isOther: false,
  }),
});
```

Or simpler, just send the user's answer as a string:
```typescript
addToolOutput({
  tool: 'askUser',
  toolCallId: part.toolCallId,
  output: 'B2B SaaS',
});
```

**Recommendation**: Use a structured object so the model can parse it reliably. The model will receive this as the tool result in the next step.

### 8e. Step Count with Interactive Tools
With `stopWhen: stepCountIs(15)`:
- Each time the model calls a tool and gets a result, that's one "step"
- For server-executed tools, multiple tools can execute in a single step (parallel calls)
- For interactive tools (no execute), each round trip is a separate step
- 8 askUser calls = at minimum 8 steps
- The model may also call server-executed tools in between (e.g., for "Other" extraction)
- **15 steps gives comfortable headroom** for 8 questions + some follow-ups + summary

### 8f. `stepCountIs` Only Evaluates After Tool Results
`stopWhen` conditions are checked ONLY after a step that contains tool results. This means:
- The very first generation (step 0) always runs
- The condition is checked after step 1 (which had tool results from step 0's calls)
- `stepCountIs(15)` means: stop after 15 steps that had tool results

### 8g. Browser Close/Resume
If the user closes the browser during an askUser interaction:
- The message with `input-available` tool part is in the local state
- On reload, if messages are hydrated from localStorage/Supabase, the askUser card should re-render
- The card should still be interactive (not disabled) because no output was provided
- The server's sanitization filter will strip incomplete tool parts if the user sends a text message instead

### 8h. Type Safety for Tool Parts
AI SDK v6 supports typed tool parts. The part type `tool-askUser` is automatically inferred from the tool name. This means:
```tsx
// TypeScript knows part.input shape when part.type === 'tool-askUser'
if (part.type === 'tool-askUser' && part.state === 'input-available') {
  part.input.question;   // typed as string
  part.input.options;    // typed as array
  part.input.multiSelect; // typed as boolean
}
```

However, the current codebase uses a generic `Record<string, unknown>` approach for parts. Sprint 2 can maintain this pattern for simplicity, or upgrade to typed parts.

---

## 9. Recommended Implementation Pattern for `askUser`

### Server: Tool Definition (`src/lib/ai/tools/ask-user.ts`)
```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const askUser = tool({
  description:
    'Ask the user a structured question with tappable option chips. ' +
    'Use for categorical/choice-based questions during onboarding. ' +
    'For nuanced questions requiring free text, just ask in your message.',
  inputSchema: z.object({
    question: z.string().describe('The question to display'),
    options: z.array(z.object({
      label: z.string().describe('Short label for the chip'),
      description: z.string().optional().describe('Optional one-line description'),
    })).min(2).max(6).describe('Tappable option chips (2-6 options). Always include "Other" as last option.'),
    multiSelect: z.boolean().describe('If true, user can select multiple options with a Done button'),
    fieldName: z.string().describe('The onboarding field this populates (e.g., businessModel, industry)'),
  }),
  // NO execute -- result comes from frontend user interaction
});
```

### Server: Route Integration (`src/app/api/journey/stream/route.ts`)
```typescript
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { askUser } from '@/lib/ai/tools/ask-user';

const result = streamText({
  model: anthropic(MODELS.CLAUDE_OPUS),
  system: LEAD_AGENT_SYSTEM_PROMPT,
  messages: await convertToModelMessages(sanitizedMessages),
  tools: { askUser },
  stopWhen: stepCountIs(15),
  temperature: 0.3,
  providerOptions: {
    anthropic: {
      thinking: { type: 'adaptive' },
    },
  },
});

return result.toUIMessageStreamResponse();
```

### Frontend: useChat Setup (`src/app/journey/page.tsx`)
```typescript
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';

const { messages, sendMessage, addToolOutput, status, error, setMessages } = useChat({
  transport,
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  onError: (err) => {
    // Handle MissingToolResultsError
    if (err?.message?.includes('Tool result is missing')) {
      setMessages((prev) => {
        const cleaned = [...prev];
        for (let i = cleaned.length - 1; i >= 0; i--) {
          if (cleaned[i].role === 'assistant') {
            cleaned.splice(i, 1);
            break;
          }
        }
        return cleaned;
      });
    }
  },
});
```

### Frontend: Rendering `askUser` in ChatMessage
```tsx
// In renderToolPart or message rendering:
case 'tool-askUser': {
  const callId = part.toolCallId;
  switch (part.state) {
    case 'input-streaming':
      return <Skeleton key={callId} />; // Brief loading state
    case 'input-available':
      return (
        <AskUserCard
          key={callId}
          question={part.input.question}
          options={part.input.options}
          multiSelect={part.input.multiSelect}
          fieldName={part.input.fieldName}
          onSubmit={(value) => {
            addToolOutput({
              tool: 'askUser',
              toolCallId: callId,
              output: value,  // string or object
            });
          }}
        />
      );
    case 'output-available':
      return (
        <AskUserCardCompleted
          key={callId}
          question={part.input.question}
          options={part.input.options}
          selection={part.output}
        />
      );
  }
}
```

---

## 10. Flow Diagram: askUser Multi-Step Cycle

```
User sends message: "Hey, I run a tech company called Acme"
  |
  v
[Server] streamText step 1:
  - Model generates text: "Nice. Let me learn a bit more about Acme."
  - Model calls tool: askUser({ question: "What's your business model?", options: [...], ... })
  - Step ends with finishReason: 'tool-calls'
  - Stream sent to client
  |
  v
[Client] Receives stream:
  - Text part rendered: "Nice. Let me learn a bit more about Acme."
  - Tool part rendered: AskUserCard with chips [B2B SaaS | B2C | Marketplace | Other]
  - Status goes from 'streaming' -> 'ready'
  - User sees chips, taps "B2B SaaS"
  |
  v
[Client] addToolOutput({ tool: 'askUser', toolCallId: '...', output: 'B2B SaaS' })
  - Tool part state: input-available -> output-available
  - AskUserCard becomes AskUserCardCompleted (chips disabled, selected highlighted)
  - sendAutomaticallyWhen evaluates -> returns true (all tool calls have results)
  - New HTTP request sent to server with full message history including tool result
  |
  v
[Server] streamText step 2:
  - Model receives: user message + assistant (text + askUser call) + tool result ("B2B SaaS")
  - Model generates: "B2B SaaS -- makes sense. What industry?"
  - Model calls: askUser({ question: "What industry?", options: [...dynamic...], ... })
  - Step ends with finishReason: 'tool-calls'
  |
  v
[Client] Cycle repeats...
  |
  v
[Server] After all 8 required fields collected:
  - Model generates: "Here's what I've got: [summary]. Does this look right?"
  - Model calls: askUser({ question: "Confirm?", options: ["Looks good", "Change something"], ... })
  |
  v
[Client] User taps "Looks good"
  |
  v
[Server] Final step:
  - Model generates: "We're all set. Moving on to build your strategy."
  - No more tool calls -> stream ends with finishReason: 'stop'
```

---

## 11. Existing Codebase Patterns to Preserve

### Message Sanitization
Both `src/app/api/journey/stream/route.ts` and `src/app/api/chat/agent/route.ts` use identical sanitization logic to strip incomplete tool parts. This must be preserved when adding tools to the journey route.

### `sendAutomaticallyWhen` Change
The current journey page uses `lastAssistantMessageIsCompleteWithApprovalResponses` (from Sprint 1 for future-proofing). For Sprint 2, switch to `lastAssistantMessageIsCompleteWithToolCalls` since `askUser` uses `addToolOutput`, not `addToolApprovalResponse`.

If the journey page ever needs BOTH patterns (unlikely), combine them:
```typescript
sendAutomaticallyWhen: ({ messages }) =>
  lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
  lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
```

### `hasPendingApproval` in Journey Page
The current journey page checks for `approval-requested` state to block input. For `askUser`, the equivalent blocking state is `input-available` (tool waiting for user response). Update the blocking logic:
```typescript
const hasPendingToolInteraction = messages.some(
  (msg) => msg.role === 'assistant' && msg.parts.some(
    (part) => typeof part === 'object' && 'type' in part &&
      typeof (part as Record<string, unknown>).type === 'string' &&
      ((part as Record<string, unknown>).type as string).startsWith('tool-') &&
      'state' in part &&
      (['input-available', 'approval-requested'].includes(
        (part as Record<string, unknown>).state as string
      ))
  )
);
```

### `ChatMessage` `renderToolPart` Extension
The existing `renderToolPart` in `src/components/journey/chat-message.tsx` dispatches on tool name. Add a case for `askUser` that renders the `AskUserCard` component.

### `stopWhen` vs `maxSteps`
The existing chat agent route (`src/app/api/chat/agent/route.ts`) already uses the v6 pattern:
```typescript
stopWhen: stepCountIs(10),
```

Use the same pattern for the journey route with a higher limit:
```typescript
stopWhen: stepCountIs(15),
```

---

## 12. Open Questions Answered

### Q1 (PRD): Should addToolOutput be called immediately on single-select tap?
**Answer**: Yes, call `addToolOutput` immediately. The SDK handles the state update and auto-resubmit synchronously. No animation delay needed. If you want visual feedback (chip highlight), update local UI state in the same click handler before calling `addToolOutput`.

### Q2 (PRD): Resume after browser close?
**Answer**: If messages are persisted to localStorage/Supabase and hydrated on mount, the `askUser` card will re-render in `input-available` state (still interactive). The user can continue where they left off. Server sanitization handles edge cases.

### Q3 (PRD): "Other" extraction -- frontend or backend?
**Answer**: Either works. Recommended: **frontend** (before sending tool result). Call `generateObject()` in a client-side API call, then pass the structured result to `addToolOutput()`. This keeps the agent conversation clean -- it receives structured data, not raw "Other" text. Alternative: pass raw text as tool result and let the agent handle it (simpler but less reliable).

### Q4 (PRD): Supabase write trigger?
**Answer**: Use `onFinish` callback on `streamText` for server-side persistence. For client-side (localStorage mirror), update in the `addToolOutput` click handler or in a `useEffect` watching `messages`.

### Q5 (PRD): Thinking block border color?
**Answer**: Current implementation uses `--border-default`. PRD says `--accent-blue`. Change in Sprint 2 thinking block enhancement.

---

## 13. Sources

- [AI SDK UI: Chatbot Tool Usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage)
- [AI SDK Core: Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [AI SDK Core: streamText Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [AI SDK UI: useChat Reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [AI SDK 5.0 Migration Guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0)
- [AI SDK 6 Release Blog](https://vercel.com/blog/ai-sdk-6)
- [Vercel Academy: Tool Use](https://vercel.com/academy/ai-sdk/tool-use)
- [Vercel Academy: Multi-Step & Generative UI](https://vercel.com/academy/ai-sdk/multi-step-and-generative-ui)
- [Cookbook: Call Tools in Multiple Steps](https://ai-sdk.dev/cookbook/node/call-tools-multiple-steps)
- [GitHub Discussion: Multi-Step Tool Client Handling](https://github.com/vercel/ai/discussions/4142)
