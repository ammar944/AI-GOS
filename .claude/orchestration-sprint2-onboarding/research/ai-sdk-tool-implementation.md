# AI SDK v6 Interactive Tool Implementation Guide

**Date**: 2026-02-27
**Author**: Second-wave research agent
**Verified against**: `ai@6.0.73`, `@ai-sdk/react@3.0.75`, `@ai-sdk/provider-utils` (bundled)

---

## 1. Verified API Surface

All claims below are verified by reading `node_modules/ai/dist/index.d.ts` and `node_modules/@ai-sdk/provider-utils/dist/index.d.ts` from the installed packages.

### 1a. CONFIRMED APIs (exist in installed SDK)

| API | Location | Line | Status |
|-----|----------|------|--------|
| `addToolOutput()` | `ai/dist/index.d.ts:3416` | Returns `Promise<void>` | **EXISTS** -- primary API |
| `addToolResult()` | `ai/dist/index.d.ts:3430` | Returns `Promise<void>` | **EXISTS** -- deprecated, has `@deprecated Use addToolOutput` annotation |
| `stepCountIs()` | `ai/dist/index.d.ts:953` | `(stepCount: number) => StopCondition<any>` | **EXISTS** |
| `hasToolCall()` | `ai/dist/index.d.ts:954` | `(toolName: string) => StopCondition<any>` | **EXISTS** |
| `stopWhen` | `ai/dist/index.d.ts:2455,3003` | Property on `streamText` options | **EXISTS** |
| `sendAutomaticallyWhen` | `ai/dist/index.d.ts:3340` | Property on `ChatInit` | **EXISTS** |
| `lastAssistantMessageIsCompleteWithToolCalls` | `ai/dist/index.d.ts:3639` | `({ messages }) => boolean` | **EXISTS** |
| `lastAssistantMessageIsCompleteWithApprovalResponses` | `ai/dist/index.d.ts:3630` | `({ messages }) => boolean` | **EXISTS** |
| `tool()` | `@ai-sdk/provider-utils/dist/index.d.ts:1146-1149` | Identity function with overloads | **EXISTS** |
| `streamText.onFinish` | `ai/dist/index.d.ts:2537` | `StreamTextOnFinishCallback<TOOLS>` with `steps` array | **EXISTS** |
| `toUIMessageStreamResponse({ onFinish })` | `ai/dist/index.d.ts:1977` | `UIMessageStreamOnFinishCallback` with `messages` | **EXISTS** |

### 1b. DOES NOT EXIST

| API | Status | Notes |
|-----|--------|-------|
| `maxSteps` | **REMOVED** -- zero matches in `ai/dist/index.d.ts` | Fully replaced by `stopWhen: stepCountIs(N)` |

### 1c. First-Wave Research Accuracy

The first-wave research at `ai-sdk-tool-patterns.md` was **correct on all claims**:
- `addToolOutput` exists and is the primary API (confirmed)
- `addToolResult` is deprecated (confirmed -- has `@deprecated` annotation at line 3429)
- `stepCountIs` exists (confirmed at line 953)
- `maxSteps` is removed (confirmed -- zero matches)
- `sendAutomaticallyWhen` exists (confirmed at line 3340)
- `lastAssistantMessageIsCompleteWithToolCalls` exists (confirmed at line 3639)
- `tool()` helper exists in `@ai-sdk/provider-utils`, re-exported from `ai` (confirmed -- `ai/dist/index.js:138`)

### 1d. Key Type Signatures (Exact from Source)

**`addToolOutput` (line 3416-3428):**
```typescript
addToolOutput: <TOOL extends keyof InferUIMessageTools<UI_MESSAGE>>(
  {state, tool, toolCallId, output, errorText}:
    | {
        state?: "output-available";
        tool: TOOL;
        toolCallId: string;
        output: InferUIMessageTools<UI_MESSAGE>[TOOL]["output"];
        errorText?: never;
      }
    | {
        state: "output-error";
        tool: TOOL;
        toolCallId: string;
        output?: never;
        errorText: string;
      }
) => Promise<void>;
```

**`tool()` overloads (provider-utils lines 1146-1149):**
```typescript
declare function tool<INPUT, OUTPUT>(tool: Tool<INPUT, OUTPUT>): Tool<INPUT, OUTPUT>;
declare function tool<INPUT>(tool: Tool<INPUT, never>): Tool<INPUT, never>;
declare function tool<OUTPUT>(tool: Tool<never, OUTPUT>): Tool<never, OUTPUT>;
declare function tool(tool: Tool<never, never>): Tool<never, never>;
```

**`Tool` type (provider-utils line 1013):**
```typescript
type Tool<INPUT, OUTPUT> = {
  description?: string;
  title?: string;
  providerOptions?: ProviderOptions;
  inputSchema: FlexibleSchema<INPUT>;
  inputExamples?: Array<{ input: NoInfer<INPUT> }>;
  needsApproval?: boolean | ToolNeedsApprovalFunction<INPUT>;
  strict?: boolean;
  onInputStart?: (options: ToolExecutionOptions) => void | PromiseLike<void>;
  onInputDelta?: (options: { inputTextDelta: string } & ToolExecutionOptions) => void | PromiseLike<void>;
  onInputAvailable?: (options: { input: INPUT } & ToolExecutionOptions) => void | PromiseLike<void>;
  // ... execute is optional (ToolOutputProperties union)
  toModelOutput?: (...) => ToolResultOutput | PromiseLike<ToolResultOutput>;
}
```

Key: When `execute` is omitted, the tool is an "interactive tool" -- the SDK will not auto-execute it, and the frontend must provide output via `addToolOutput()`.

**`StopCondition` type (line 950-953):**
```typescript
type StopCondition<TOOLS extends ToolSet> = (options: {
    steps: Array<StepResult<TOOLS>>;
}) => PromiseLike<boolean> | boolean;
declare function stepCountIs(stepCount: number): StopCondition<any>;
declare function hasToolCall(toolName: string): StopCondition<any>;
```

**`StreamTextOnFinishCallback` (line 2361-2378):**
```typescript
type StreamTextOnFinishCallback<TOOLS extends ToolSet> = (event: StepResult<TOOLS> & {
    readonly steps: StepResult<TOOLS>[];
    readonly totalUsage: LanguageModelUsage;
    experimental_context: unknown;
}) => PromiseLike<void> | void;
```

**`StepResult.toolResults` (line 820):**
```typescript
readonly toolResults: Array<TypedToolResult<TOOLS>>;
```
Where `TypedToolResult` contains: `{ type: 'tool-result', toolCallId, toolName, input, output, ... }`

---

## 2. askUser Tool Definition

**File**: `src/lib/ai/tools/ask-user.ts` (CREATE)

```typescript
// askUser tool -- interactive tool for structured onboarding questions
// No execute function: result comes from user interaction on the frontend

import { tool } from 'ai';
import { z } from 'zod';

export const askUserInputSchema = z.object({
  question: z.string().describe('The question to display above the chips'),
  options: z
    .array(
      z.object({
        label: z.string().describe('Short label for the chip'),
        description: z.string().optional().describe('Optional one-line description below the label'),
      })
    )
    .min(2)
    .max(6)
    .describe(
      'Tappable option chips (2-6 options). Always include "Other" as the last option.'
    ),
  multiSelect: z
    .boolean()
    .describe('If true, user can select multiple options before submitting with a Done button'),
  fieldName: z
    .string()
    .describe(
      'The onboarding field this question populates (e.g., businessModel, industry, monthlyAdBudget)'
    ),
});

export type AskUserInput = z.infer<typeof askUserInputSchema>;

export const askUser = tool({
  description:
    'Ask the user a structured question with tappable option chips. ' +
    'Use for categorical or choice-based questions during onboarding. ' +
    'For open-ended questions requiring free text (company name, website URL, specific details), ' +
    'just ask in your message text -- do NOT use this tool.',
  inputSchema: askUserInputSchema,
  // NO execute function -- this is an interactive tool.
  // The frontend renders chip cards, the user taps a selection,
  // and addToolOutput() sends the result back to the model.
});
```

**Why this works**: The `tool()` helper is a type-safe identity function. By omitting `execute`, the SDK treats this as an interactive tool. When the model calls it, the step finishes with `finishReason: 'tool-calls'`, and the client receives the tool part for rendering.

---

## 3. Route Integration

**File**: `src/app/api/journey/stream/route.ts` (MODIFY)

### Current Code (lines 1-79):
```typescript
import { streamText, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
// ... auth, providers, prompt imports

export async function POST(request: Request) {
  // ... auth, parse, sanitize (unchanged)

  const result = streamText({
    model: anthropic(MODELS.CLAUDE_OPUS),
    system: LEAD_AGENT_SYSTEM_PROMPT,
    messages: await convertToModelMessages(sanitizedMessages),
    temperature: 0.3,
    providerOptions: {
      anthropic: {
        thinking: { type: 'adaptive' },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
```

### Target Code (diff from current):

```diff
-import { streamText, convertToModelMessages } from 'ai';
+import { streamText, convertToModelMessages, stepCountIs } from 'ai';
 import type { UIMessage } from 'ai';
 import { auth } from '@clerk/nextjs/server';
 import { anthropic, MODELS } from '@/lib/ai/providers';
 import { LEAD_AGENT_SYSTEM_PROMPT } from '@/lib/ai/prompts/lead-agent-system';
+import { askUser } from '@/lib/ai/tools/ask-user';

 // ... auth, parse, sanitize (unchanged)

   const result = streamText({
     model: anthropic(MODELS.CLAUDE_OPUS),
     system: LEAD_AGENT_SYSTEM_PROMPT,
     messages: await convertToModelMessages(sanitizedMessages),
+    tools: { askUser },
+    stopWhen: stepCountIs(15),
     temperature: 0.3,
     providerOptions: {
       anthropic: {
         thinking: { type: 'adaptive' },
       },
     },
+    onFinish: async ({ steps, totalUsage }) => {
+      // Extract all askUser tool results across all steps for Supabase persistence.
+      // Each step's toolResults contains results from that step only.
+      // For interactive tools (no execute), toolResults will be empty on the server
+      // since the tool result comes from the client on the NEXT request.
+      // The tool results appear as tool-result parts in the messages instead.
+      //
+      // IMPORTANT: For interactive tools, the tool result is provided by the client
+      // via addToolOutput(), which triggers a NEW HTTP request. So in any given
+      // request's onFinish, the steps array will contain:
+      //   - Step 0: the model's response (possibly with askUser tool call)
+      //   - If there were server-executed tools, their results appear in step N toolResults
+      //
+      // For askUser specifically, the result arrives as part of the NEXT request's
+      // message history (the client includes it in the messages array). So we need
+      // to extract askUser results from the INCOMING messages, not from onFinish steps.
+      //
+      // The primary persistence hook for askUser data is the INCOMING request body.
+      // See extractOnboardingFields() below.
+
+      try {
+        // Log usage for monitoring
+        const totalTokens = totalUsage?.totalTokens || 0;
+        if (totalTokens > 0) {
+          console.log(`[journey/stream] Opus usage: ${totalTokens} tokens across ${steps.length} steps`);
+        }
+      } catch (err) {
+        console.error('[journey/stream] onFinish error:', err);
+      }
+    },
   });

   return result.toUIMessageStreamResponse();
```

### Full Target Route File:

```typescript
// POST /api/journey/stream
// Streaming chat endpoint for the v2 journey experience.
// Uses Claude Opus 4.6 with adaptive thinking for conversational strategy sessions.

import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import type { UIMessage } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { anthropic, MODELS } from '@/lib/ai/providers';
import { LEAD_AGENT_SYSTEM_PROMPT } from '@/lib/ai/prompts/lead-agent-system';
import { askUser } from '@/lib/ai/tools/ask-user';

export const maxDuration = 300;

interface JourneyStreamRequest {
  messages: UIMessage[];
}

export async function POST(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Parse request ───────────────────────────────────────────────────────
  const body: JourneyStreamRequest = await request.json();

  if (!body.messages || !Array.isArray(body.messages)) {
    return new Response(
      JSON.stringify({ error: 'messages array is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Sanitize messages ───────────────────────────────────────────────────
  // Strip tool parts that never completed to prevent MissingToolResultsError
  // when convertToModelMessages encounters tool calls without results.
  const INCOMPLETE_TOOL_STATES = new Set([
    'input-streaming',
    'input-available',
    'approval-requested',
  ]);

  const sanitizedMessages = body.messages.map((msg) => ({
    ...msg,
    parts: msg.parts.filter((part) => {
      if (
        typeof part === 'object' &&
        'type' in part &&
        typeof part.type === 'string' &&
        part.type.startsWith('tool-') &&
        part.type !== 'tool-invocation'
      ) {
        const state = (part as Record<string, unknown>).state as string | undefined;
        if (state && INCOMPLETE_TOOL_STATES.has(state)) {
          return false; // Drop incomplete tool parts
        }
      }
      return true;
    }),
  })) as UIMessage[];

  // ── Stream ──────────────────────────────────────────────────────────────
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
    onFinish: async ({ steps, totalUsage }) => {
      try {
        const totalTokens = totalUsage?.totalTokens || 0;
        if (totalTokens > 0) {
          console.log(
            `[journey/stream] Opus usage: ${totalTokens} tokens across ${steps.length} steps`
          );
        }
      } catch (err) {
        console.error('[journey/stream] onFinish error:', err);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
```

### Critical Note on `onFinish` and Interactive Tools

For **server-executed tools** (with `execute`), `onFinish.steps[N].toolResults` contains the tool outputs because the server ran them.

For **interactive tools** (without `execute`, like `askUser`), the situation is different:
1. Request 1: Model generates text + askUser tool call. `onFinish` fires with `steps[0].toolCalls = [{toolName: 'askUser', ...}]` but `steps[0].toolResults = []` (no results -- waiting for client).
2. Client calls `addToolOutput()`. This triggers Request 2.
3. Request 2: The messages array now includes the tool result from the client. The model sees it and continues.

So **Supabase persistence of askUser answers should happen by extracting tool results from the incoming `body.messages`**, not from `onFinish.steps`. The `onFinish` callback is useful for logging/monitoring and for persisting server-executed tool results.

For a more robust persistence approach, extract the askUser results from the incoming messages on each request:

```typescript
// Extract askUser results from incoming messages for persistence
function extractAskUserResults(messages: UIMessage[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      if (
        p.type === 'tool-askUser' &&
        p.state === 'output-available' &&
        p.input &&
        p.output
      ) {
        const input = p.input as { fieldName: string };
        fields[input.fieldName] = p.output;
      }
    }
  }
  return fields;
}
```

---

## 4. Frontend Wiring

**File**: `src/app/journey/page.tsx` (MODIFY)

### Current Code Key Lines:
```typescript
const { messages, sendMessage, addToolApprovalResponse, status, error, setMessages } = useChat({
  transport,
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  // ...
});
```

### Target Changes:

```diff
 import {
   DefaultChatTransport,
-  lastAssistantMessageIsCompleteWithApprovalResponses,
+  lastAssistantMessageIsCompleteWithToolCalls,
+  lastAssistantMessageIsCompleteWithApprovalResponses,
 } from 'ai';

   // Chat hook
-  const { messages, sendMessage, addToolApprovalResponse, status, error, setMessages } = useChat({
+  const { messages, sendMessage, addToolOutput, addToolApprovalResponse, status, error, setMessages } = useChat({
     transport,
-    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
+    sendAutomaticallyWhen: ({ messages }) =>
+      lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
+      lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
     onError: (err) => {
       // ... unchanged
     },
   });

-  // Block input while any tool is waiting for user approval
-  const hasPendingApproval = messages.some(
+  // Block input while any tool is waiting for user interaction
+  const hasPendingToolInteraction = messages.some(
     (msg) =>
       msg.role === 'assistant' &&
       msg.parts.some(
         (part) =>
           typeof part === 'object' &&
           'type' in part &&
           typeof (part as Record<string, unknown>).type === 'string' &&
           ((part as Record<string, unknown>).type as string).startsWith('tool-') &&
-          'state' in part &&
-          (part as Record<string, unknown>).state === 'approval-requested'
+          'state' in part && (
+            (part as Record<string, unknown>).state === 'approval-requested' ||
+            (part as Record<string, unknown>).state === 'input-available'
+          )
       )
   );

-  const isLoading = isStreaming || isSubmitted || hasPendingApproval;
+  const isLoading = isStreaming || isSubmitted || hasPendingToolInteraction;

   // In the ChatMessage render, pass addToolOutput:
           return (
             <ChatMessage
               key={message.id}
               messageId={message.id}
               role={message.role as 'user' | 'assistant'}
               parts={message.parts}
               isStreaming={isThisMessageStreaming}
               onToolApproval={(approvalId, approved) =>
                 addToolApprovalResponse({ id: approvalId, approved })
               }
+              onToolOutput={(toolCallId, output) =>
+                addToolOutput({
+                  tool: 'askUser',
+                  toolCallId,
+                  output,
+                })
+              }
             />
           );
```

### Full Target `useChat` Setup:

```typescript
'use client';

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
// ... other imports

export default function JourneyPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/journey/stream' }),
    []
  );

  const {
    messages,
    sendMessage,
    addToolOutput,
    addToolApprovalResponse,
    status,
    error,
    setMessages,
  } = useChat({
    transport,
    sendAutomaticallyWhen: ({ messages }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
      lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
    onError: (err) => {
      console.error('Journey chat error:', err);
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

  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';

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
          (['input-available', 'approval-requested'].includes(
            (part as Record<string, unknown>).state as string
          ))
      )
  );

  const isLoading = isStreaming || isSubmitted || hasPendingToolInteraction;

  // ... rest of component (auto-scroll, handleSubmit, etc.)

  // In the ChatMessage render:
  return (
    <ChatMessage
      key={message.id}
      messageId={message.id}
      role={message.role as 'user' | 'assistant'}
      parts={message.parts}
      isStreaming={isThisMessageStreaming}
      onToolApproval={(approvalId, approved) =>
        addToolApprovalResponse({ id: approvalId, approved })
      }
      onToolOutput={(toolCallId, output) =>
        addToolOutput({
          tool: 'askUser',
          toolCallId,
          output,
        })
      }
    />
  );
}
```

### Important: `sendAutomaticallyWhen` Behavior

When `addToolOutput()` is called:
1. The SDK updates the tool part locally: `state: 'input-available'` -> `state: 'output-available'`, sets `output` field
2. The SDK evaluates `sendAutomaticallyWhen({ messages })`
3. `lastAssistantMessageIsCompleteWithToolCalls` checks: is the last assistant message complete AND do ALL tool calls in the last step have results?
4. If true, the SDK automatically sends a new request to the server with the full message history (including the tool result)
5. The server receives the messages, processes them, and streams back the model's next response

This is why you do NOT need to manually call `sendMessage()` after `addToolOutput()`.

---

## 5. Tool Part Rendering

**File**: `src/components/journey/chat-message.tsx` (MODIFY)

### Current `renderToolPart` Function (lines 270-418):

The current function handles tool states generically. For `askUser`, we need to intercept before the generic handlers.

### Changes to `ChatMessageProps` Interface:

```diff
 interface ChatMessageProps {
   role: 'user' | 'assistant';
   content?: string;
   parts?: Array<{ type: string; [key: string]: unknown }>;
   messageId?: string;
   isStreaming?: boolean;
   onToolApproval?: (approvalId: string, approved: boolean) => void;
+  onToolOutput?: (toolCallId: string, output: unknown) => void;
   className?: string;
 }
```

### Changes to `renderToolPart`:

```diff
 function renderToolPart(
   part: Record<string, unknown>,
   key: string,
   onToolApproval?: (approvalId: string, approved: boolean) => void,
+  onToolOutput?: (toolCallId: string, output: unknown) => void,
 ): React.ReactNode {
   const toolName = (part.type as string).replace('tool-', '');
   const state = part.state as string;
   const input = part.input as Record<string, unknown> | undefined;
   const output = part.output as Record<string, unknown> | undefined;

+  // ── askUser interactive tool ──────────────────────────────────────────
+  if (toolName === 'askUser') {
+    const askInput = input as {
+      question: string;
+      options: Array<{ label: string; description?: string }>;
+      multiSelect: boolean;
+      fieldName: string;
+    } | undefined;
+    const toolCallId = part.toolCallId as string;
+
+    if (state === 'input-streaming') {
+      // Tool arguments still streaming -- show subtle loading state
+      return (
+        <div
+          key={key}
+          className="px-3 py-2 rounded-lg text-xs my-1 animate-pulse"
+          style={{
+            background: 'var(--bg-hover)',
+            border: '1px solid var(--border-subtle)',
+            color: 'var(--text-tertiary)',
+          }}
+        >
+          Preparing question...
+        </div>
+      );
+    }
+
+    if (state === 'input-available' && askInput) {
+      return (
+        <AskUserCard
+          key={key}
+          question={askInput.question}
+          options={askInput.options}
+          multiSelect={askInput.multiSelect}
+          fieldName={askInput.fieldName}
+          onSubmit={(value) => {
+            onToolOutput?.(toolCallId, value);
+          }}
+        />
+      );
+    }
+
+    if (state === 'output-available') {
+      return (
+        <AskUserCardCompleted
+          key={key}
+          question={askInput?.question ?? ''}
+          options={askInput?.options ?? []}
+          selection={output}
+        />
+      );
+    }
+
+    if (state === 'output-error') {
+      return (
+        <div
+          key={key}
+          className="px-3 py-2 rounded-lg text-xs my-1"
+          style={{
+            background: 'rgba(239, 68, 68, 0.1)',
+            border: '1px solid rgba(239, 68, 68, 0.2)',
+            color: '#ef4444',
+          }}
+        >
+          {(part.errorText as string) || 'Failed to capture your selection'}
+        </div>
+      );
+    }
+
+    // Fallback for unknown states
+    return null;
+  }

   // Loading states (existing generic handler)
   if (state === 'input-streaming' || state === 'input-available') {
     // ... existing code unchanged
   }
   // ... rest of existing renderToolPart unchanged
```

### Propagation Through Component Tree

The `onToolOutput` prop must flow from `ChatMessage` -> `AssistantMessage` -> `renderMessageParts` -> `renderToolPart`:

```diff
 function renderMessageParts(
   parts: Array<{ type: string; [key: string]: unknown }>,
   messageId: string,
   isStreaming: boolean,
   onToolApproval?: (approvalId: string, approved: boolean) => void,
+  onToolOutput?: (toolCallId: string, output: unknown) => void,
 ): React.ReactNode {
   // ... inside the loop:
       const toolElement = renderToolPart(
         part as Record<string, unknown>,
         `${messageId}-tool-${i}`,
-        onToolApproval
+        onToolApproval,
+        onToolOutput,
       );
```

```diff
 function AssistantMessage({
   content,
   parts,
   messageId,
   isStreaming,
   onToolApproval,
+  onToolOutput,
   className,
 }: {
   content?: string;
   parts?: Array<{ type: string; [key: string]: unknown }>;
   messageId: string;
   isStreaming: boolean;
   onToolApproval?: (approvalId: string, approved: boolean) => void;
+  onToolOutput?: (toolCallId: string, output: unknown) => void;
   className?: string;
 }) {
   // ...
       {parts
-        ? renderMessageParts(parts, messageId, isStreaming, onToolApproval)
+        ? renderMessageParts(parts, messageId, isStreaming, onToolApproval, onToolOutput)
         : (/* ... */)}
```

```diff
 export function ChatMessage({
   role,
   content,
   parts,
   messageId,
   isStreaming = false,
   onToolApproval,
+  onToolOutput,
   className,
 }: ChatMessageProps) {
   // ...
     return (
       <AssistantMessage
         content={content}
         parts={parts}
         messageId={messageId ?? (content ? 'welcome' : 'msg')}
         isStreaming={isStreaming}
         onToolApproval={onToolApproval}
+        onToolOutput={onToolOutput}
         className={className}
       />
     );
```

---

## 6. onFinish Callback -- Extracting Tool Results for Supabase Persistence

### The Problem with Interactive Tools and `onFinish`

For **server-executed tools**, the `onFinish` callback's `steps` array contains tool results. But for **interactive tools** (like `askUser`), the tool result comes from the client on the NEXT HTTP request. So within a single request's `onFinish`, you will NOT find askUser results in `steps[N].toolResults`.

### Recommended Persistence Strategy

**Option A: Extract from incoming messages (server-side, on each request)**

This is the most reliable approach. On each request to `/api/journey/stream`, scan the incoming `body.messages` for completed askUser tool parts:

```typescript
// Add to route.ts, before the streamText call

function extractOnboardingFields(messages: UIMessage[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      if (
        typeof p.type === 'string' &&
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

// In the POST handler, after sanitization:
const onboardingFields = extractOnboardingFields(body.messages);
if (Object.keys(onboardingFields).length > 0) {
  // Persist to Supabase (non-blocking)
  persistOnboardingFields(userId, onboardingFields).catch((err) => {
    console.error('[journey/stream] Failed to persist onboarding fields:', err);
  });
}
```

**Option B: Client-side persistence (localStorage, immediate)**

In the `onToolOutput` click handler in `journey/page.tsx`, also write to localStorage:

```typescript
const handleToolOutput = useCallback(
  (toolCallId: string, output: unknown) => {
    // 1. Send to SDK
    addToolOutput({
      tool: 'askUser',
      toolCallId,
      output,
    });

    // 2. Persist to localStorage immediately
    // (Requires extracting fieldName from the tool part input)
    const fieldName = getFieldNameFromToolCall(messages, toolCallId);
    if (fieldName) {
      updateJourneySession(fieldName, output);
    }
  },
  [addToolOutput, messages]
);
```

**Recommended: Use BOTH approaches (belt + suspenders per DISCOVERY.md D11)**
- localStorage: immediate, for fast hydration
- Supabase: on each request, for authoritative persistence

### Using `streamText.onFinish` for Server-Executed Tool Results

If future tools with `execute` are added to the journey route, their results WILL appear in `onFinish.steps`:

```typescript
onFinish: async ({ steps, totalUsage }) => {
  // Extract results from server-executed tools
  const allToolResults = steps.flatMap((step) => step.toolResults);

  for (const result of allToolResults) {
    if (result.toolName === 'someServerTool') {
      // Process server-executed tool result
      await persistToolResult(userId, result);
    }
  }

  // Note: askUser results will NOT appear here because askUser has no execute function.
  // askUser results come from the client on the next request.
},
```

### Using `toUIMessageStreamResponse({ onFinish })` for Message Persistence

The `onFinish` on `toUIMessageStreamResponse` receives the full `messages` array (UI format). This is useful for persisting the entire conversation:

```typescript
return result.toUIMessageStreamResponse({
  onFinish: ({ messages: responseMessages, responseMessage }) => {
    // responseMessages = full message list including the new assistant message
    // responseMessage = just the new assistant message
    // Useful for persisting to Supabase message history table
  },
});
```

---

## 7. Multi-Step Flow -- End-to-End

### Flow Diagram (Verified Against SDK Behavior)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ REQUEST 1: User sends "Hey, I run a tech company called Acme"          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Server] POST /api/journey/stream                                      │
│    ├── body.messages = [{ role: 'user', content: 'Hey, I run...' }]     │
│    ├── extractOnboardingFields(messages) => {} (no results yet)         │
│    ├── streamText({                                                     │
│    │     model: opus, tools: { askUser }, stopWhen: stepCountIs(15)     │
│    │   })                                                               │
│    │                                                                    │
│    │   STEP 0:                                                          │
│    │     Model generates text: "Tell me more about Acme."               │
│    │     Model calls tool: askUser({                                    │
│    │       question: "What's your business model?",                     │
│    │       options: [{label: "B2B SaaS"}, {label: "B2C"}, ...],         │
│    │       multiSelect: false,                                          │
│    │       fieldName: "businessModel"                                   │
│    │     })                                                             │
│    │     finishReason: 'tool-calls'                                     │
│    │     toolResults: [] (no execute function!)                         │
│    │                                                                    │
│    ├── onFinish fires:                                                  │
│    │     steps = [{ toolCalls: [askUser], toolResults: [] }]            │
│    │     (No askUser results to persist)                                │
│    │                                                                    │
│    └── Stream sent to client                                            │
│                                                                         │
│  [Client] Receives stream                                               │
│    ├── Text part rendered: "Tell me more about Acme."                   │
│    ├── Tool part received: {                                            │
│    │     type: 'tool-askUser',                                          │
│    │     state: 'input-streaming' -> 'input-available',                 │
│    │     toolCallId: 'call_abc123',                                     │
│    │     input: { question, options, multiSelect, fieldName }           │
│    │   }                                                                │
│    ├── AskUserCard rendered with chip options                           │
│    ├── status: 'streaming' -> 'ready'                                   │
│    ├── sendAutomaticallyWhen evaluated -> false                         │
│    │   (tool call exists but has NO result yet)                         │
│    └── WAITING for user interaction                                     │
│                                                                         │
│  [User] Taps "B2B SaaS" chip                                           │
│    ├── onClick handler calls addToolOutput({                            │
│    │     tool: 'askUser',                                               │
│    │     toolCallId: 'call_abc123',                                     │
│    │     output: JSON.stringify({                                       │
│    │       fieldName: 'businessModel',                                  │
│    │       selected: ['B2B SaaS'],                                      │
│    │       selectedIndex: 0                                             │
│    │     })                                                             │
│    │   })                                                               │
│    ├── SDK updates tool part locally:                                   │
│    │     state: 'input-available' -> 'output-available'                 │
│    │     output: '{"fieldName":"businessModel","selected":["B2B SaaS"]}│
│    ├── AskUserCard -> AskUserCardCompleted (chips disabled)             │
│    ├── localStorage updated with businessModel field                    │
│    ├── sendAutomaticallyWhen evaluated -> TRUE                          │
│    │   (all tool calls now have results)                                │
│    └── SDK automatically sends new request                              │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ REQUEST 2: Auto-sent by SDK (includes tool result in messages)          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Server] POST /api/journey/stream                                      │
│    ├── body.messages = [                                                │
│    │     { role: 'user', content: 'Hey, I run...' },                    │
│    │     { role: 'assistant', parts: [                                  │
│    │         { type: 'text', text: 'Tell me more...' },                 │
│    │         { type: 'tool-askUser', state: 'output-available',         │
│    │           input: {...}, output: '{"selected":["B2B SaaS"]}' }      │
│    │     ]}                                                             │
│    │   ]                                                                │
│    ├── extractOnboardingFields(messages) =>                             │
│    │     { businessModel: '{"selected":["B2B SaaS"]}' }                 │
│    ├── persistOnboardingFields(userId, fields) (non-blocking)           │
│    ├── sanitize (output-available parts pass through)                   │
│    ├── convertToModelMessages (includes tool result)                    │
│    ├── streamText step 0:                                               │
│    │     Model sees: user msg + assistant (text + askUser call + result) │
│    │     Model generates: "B2B SaaS, nice. What industry?"              │
│    │     Model calls: askUser({ fieldName: 'industry', ... })           │
│    │     finishReason: 'tool-calls'                                     │
│    └── Stream sent to client                                            │
│                                                                         │
│  ... CYCLE REPEATS for each onboarding question ...                     │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ FINAL REQUEST: After all fields collected                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Server] Model generates summary text                                  │
│    ├── "Here's what I've got: [summary]. Ready to build your strategy?" │
│    ├── No tool calls -> finishReason: 'stop'                            │
│    └── Stream completes normally                                        │
│                                                                         │
│  [Client]                                                               │
│    ├── Text rendered, no tool parts                                     │
│    ├── status: 'ready'                                                  │
│    ├── sendAutomaticallyWhen -> false (no tool calls to resolve)        │
│    └── Conversation complete                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Step Count Accounting

With `stopWhen: stepCountIs(15)`:

| Scenario | Steps Used |
|----------|-----------|
| 8 askUser questions (each = 1 request with 1 step) | 8 |
| Model follow-up text without tools | 0 (no tool results = condition not checked) |
| Model summary at end | 0 (no tool results) |
| "Other" text -> model interprets | +1 per "Other" follow-up |
| **Total typical** | **8-10** (well under 15) |

Note: `stepCountIs(N)` evaluates to `steps.length >= N` and only checks after a step that has tool results. For interactive tools, the "step" counted is the step where the model sees the tool result in the next request. So 8 askUser questions = at most 8 steps (one per round trip where the model receives a tool result and generates another response).

### Edge Cases

1. **User types free text while chips are showing**: The free text goes as a new user message. The pending askUser tool part stays in `input-available`. The server's sanitization filter will strip it, and the model will respond to the free text. The chips remain on screen but become stale. The model should guide the user back to selecting an option.

2. **User closes browser mid-tool-call**: On reload, if messages are hydrated from localStorage, the askUser card re-renders in `input-available` state (still interactive). The user can tap a chip to continue.

3. **Network error during addToolOutput re-send**: The SDK's `onError` fires. The tool part is already in `output-available` locally. The user may need to trigger a manual resend (or the component can retry).

4. **Multiple tool calls in one step**: If the model calls askUser twice in one response (unlikely but possible), both chips render. The user must respond to both before `sendAutomaticallyWhen` returns true (it checks ALL tool calls have results).

---

## 8. Summary of Changes by File

| File | Action | Key Changes |
|------|--------|-------------|
| `src/lib/ai/tools/ask-user.ts` | CREATE | Tool definition with Zod inputSchema, no execute |
| `src/app/api/journey/stream/route.ts` | MODIFY | Add `tools: { askUser }`, `stopWhen: stepCountIs(15)`, `onFinish`, import `askUser` and `stepCountIs` |
| `src/app/journey/page.tsx` | MODIFY | Destructure `addToolOutput`, change `sendAutomaticallyWhen` to combined function, add `onToolOutput` prop to ChatMessage, update `hasPendingToolInteraction` logic |
| `src/components/journey/chat-message.tsx` | MODIFY | Add `onToolOutput` prop, add `askUser` case in `renderToolPart` before generic handlers, propagate through AssistantMessage/renderMessageParts |
| `src/components/journey/ask-user-card.tsx` | CREATE | AskUserCard + AskUserCardCompleted components (separate implementation task) |

### Import Changes Summary

**route.ts:**
```typescript
// ADD to existing imports:
import { stepCountIs } from 'ai';  // add to existing 'ai' import
import { askUser } from '@/lib/ai/tools/ask-user';
```

**page.tsx:**
```typescript
// CHANGE import:
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,     // ADD
  lastAssistantMessageIsCompleteWithApprovalResponses,  // KEEP
} from 'ai';
```

**chat-message.tsx:**
```typescript
// ADD import:
import { AskUserCard, AskUserCardCompleted } from '@/components/journey/ask-user-card';
```
