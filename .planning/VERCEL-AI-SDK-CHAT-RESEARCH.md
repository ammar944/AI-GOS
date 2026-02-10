# Vercel AI SDK v6 -- Chat Agent Best Practices Research

> Research document for building an AI chat agent with Vercel AI SDK v6+.
> Project already uses `ai@^6.0.70`, `@ai-sdk/anthropic@^3.0.36`, `@ai-sdk/perplexity@^3.0.17`.

---

## Table of Contents

1. [useChat Hook](#1-usechat-hook)
2. [Tool Calling in Chat](#2-tool-calling-in-chat)
3. [Agent Loops / maxSteps](#3-agent-loops--maxsteps)
4. [Streaming: streamText vs generateText](#4-streaming-streamtext-vs-generatetext)
5. [RAG Patterns](#5-rag-patterns)
6. [Server-Side Chat Routes](#6-server-side-chat-routes)
7. [Multiple Providers in Chat](#7-multiple-providers-in-chat)
8. [Structured Outputs](#8-structured-outputs)
9. [Client-Side Tool Handling](#9-client-side-tool-handling)
10. [Conversation Persistence](#10-conversation-persistence)
11. [Architectural Recommendations](#11-architectural-recommendations)

---

## 1. useChat Hook

**Package**: `@ai-sdk/react` (React), also available for Vue/Svelte/Angular.

### Basic Usage (AI SDK 5+/6)

```tsx
'use client';
import { useChat } from '@ai-sdk/react';
import { useState } from 'react';

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, error } = useChat();

  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, i) => {
            if (part.type === 'text') return <span key={i}>{part.text}</span>;
            // Handle tool parts, step-start, etc.
            return null;
          })}
        </div>
      ))}
      <form onSubmit={e => {
        e.preventDefault();
        sendMessage({ text: input });
        setInput('');
      }}>
        <input value={input} onChange={e => setInput(e.target.value)} />
      </form>
    </div>
  );
}
```

### Key Configuration Options

| Option | Description |
|---|---|
| `id` | Unique chat identifier (auto-generated if omitted) |
| `messages` | Initial messages to populate the conversation |
| `sendAutomaticallyWhen` | Auto-resubmit when tool results are ready |
| `transport` | Custom transport (defaults to `DefaultChatTransport` with `/api/chat`) |
| `api` | Custom endpoint path |
| `headers` / `credentials` / `fetch` | Request customization |
| `messageMetadataSchema` | Zod schema for type-safe message metadata |
| `dataPartSchemas` | Zod schemas for type-safe data parts |

### Key Return Values

| Value | Description |
|---|---|
| `messages` | Array of `UIMessage` objects with `id`, `role`, `parts`, `metadata` |
| `status` | `"ready"` / `"submitted"` / `"streaming"` / `"error"` |
| `error` | Error object if request failed |
| `sendMessage()` | Submit new messages or resubmit after tool outputs |
| `regenerate()` | Recreate last assistant message |
| `stop()` | Abort streaming response |
| `addToolOutput()` | Provide tool result for client-side tools |
| `addToolApprovalResponse()` | Approve or reject tool execution |
| `setMessages()` | Update messages locally without API call |

### Key Callbacks

| Callback | Description |
|---|---|
| `onToolCall` | Invoked when a tool call is received; use `addToolOutput` to respond |
| `onFinish` | Fired when assistant completes streaming; receives message + all messages |
| `onError` | Called on request error |
| `onData` | Receives data parts as they arrive |

### Important: Message Format Changes (v5+)

- **UIMessage**: Frontend source of truth. Contains `id`, `role`, `parts[]`, `createdAt`, `metadata`.
- **ModelMessage**: What the LLM receives. Convert with `convertToModelMessages(messages)`.
- Messages use `parts[]` instead of flat `content`. Parts can be: `text`, `tool-{toolName}`, `step-start`, `source`, `file`, `reasoning`, `dynamic-tool`.
- No internal input state management -- you manage `input` state yourself.

---

## 2. Tool Calling in Chat

### Defining Server-Side Tools

```ts
import { tool } from 'ai';
import { z } from 'zod';

const tools = {
  getWeather: tool({
    description: 'Get the weather in a location',
    inputSchema: z.object({
      location: z.string().describe('The location to get the weather for'),
    }),
    execute: async ({ location }) => ({
      location,
      temperature: 72,
      condition: 'sunny',
    }),
  }),
};
```

### Tool Options

| Option | Description |
|---|---|
| `description` | Text guiding the model on when to use the tool |
| `inputSchema` | Zod schema (or JSON schema) for input parameters |
| `execute` | Async function that runs the tool (server-side) |
| `strict` | Boolean for strict schema validation (provider-dependent) |
| `needsApproval` | Boolean or async function for human-in-the-loop |
| `inputExamples` | Concrete examples to guide the model |
| `toModelOutput` | Transform output before sending to model (reduce tokens) |

### Tool Execute Context

The `execute` function receives a second argument with context:

```ts
execute: async ({ location }, { toolCallId, messages, abortSignal }) => {
  // toolCallId: unique ID for this invocation
  // messages: full conversation history
  // abortSignal: forward to fetch calls for cancellation
  return fetch(`/api/weather?location=${location}`, { signal: abortSignal });
}
```

### Tool Choice

```ts
toolChoice: 'auto'      // model decides (default)
toolChoice: 'required'  // model MUST call a tool
toolChoice: 'none'      // no tool calls allowed
toolChoice: { type: 'tool', toolName: 'getWeather' }  // force specific tool
```

### Tool Lifecycle Hooks (streaming)

```ts
getWeather: tool({
  // ...
  onInputStart: () => console.log('Tool call starting'),
  onInputDelta: ({ inputTextDelta }) => console.log('Streaming input:', inputTextDelta),
  onInputAvailable: ({ input }) => console.log('Complete input:', input),
})
```

### Three Types of Tools in Chat

1. **Server-side tools**: Have `execute` -- run automatically on server.
2. **Client-side auto-executing tools**: No `execute` -- handled via `onToolCall` callback on the client.
3. **Interactive tools**: No `execute` -- rendered in UI, user provides result via `addToolOutput`.

### Human-in-the-Loop with needsApproval

```ts
const dangerousTool = tool({
  description: 'Run a shell command',
  inputSchema: z.object({ command: z.string() }),
  needsApproval: true, // or: async ({ command }) => command.includes('rm')
  execute: async ({ command }) => { /* ... */ },
});
```

Approval flow:
1. Model requests tool call -> SDK returns `approval-requested` state
2. Client renders approval UI
3. User calls `addToolApprovalResponse({ id, approved: true/false })`
4. If approved, tool executes; if rejected, model gets denial message

### Preliminary Tool Results (Streaming)

Tools can yield intermediate results while executing:

```ts
execute: async function* ({ location }) {
  yield { status: 'loading', text: `Getting weather for ${location}...` };
  const data = await fetchWeather(location);
  yield { status: 'success', ...data };
}
```

---

## 3. Agent Loops / maxSteps

### stopWhen (replaces maxSteps in v5+)

The `stopWhen` parameter controls when the agent loop terminates:

```ts
import { streamText, stepCountIs } from 'ai';

const result = streamText({
  model: gateway('anthropic/claude-sonnet-4-5'),
  tools: { /* ... */ },
  stopWhen: stepCountIs(5), // max 5 steps
  prompt: 'What should I wear today?',
});
```

The SDK automatically:
1. Sends prompt to LLM
2. If LLM returns tool calls, executes them
3. Appends tool results to conversation
4. Sends updated conversation back to LLM
5. Repeats until `stopWhen` condition is met or LLM returns text-only

Other stop conditions:
- `stepCountIs(n)` -- stop after n steps
- `hasToolCall('finalAnswer')` -- stop when specific tool is called
- Custom function: `(steps) => boolean`

### prepareStep: Per-Step Configuration

```ts
const result = await generateText({
  model: gateway('anthropic/claude-sonnet-4-5'),
  tools: { /* ... */ },
  stopWhen: stepCountIs(5),
  prepareStep: async ({ stepNumber, steps, messages }) => {
    // Switch model based on step
    if (stepNumber === 0) {
      return { toolChoice: 'required' }; // force tool use on first step
    }
    // Can return: { model, toolChoice, tools, system, providerOptions }
  },
});
```

### Accessing Steps

```ts
const { text, steps } = await generateText({ /* ... */ });

// Extract all tool calls across all steps
const allToolCalls = steps.flatMap(step => step.toolCalls);

// Each step has: text, toolCalls, toolResults, finishReason, usage
```

### onStepFinish Callback

```ts
onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
  console.log('Step completed:', { finishReason, toolCalls });
}
```

### Agent Class (AI SDK 6)

```ts
import { ToolLoopAgent } from 'ai';

const myAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4-5',
  instructions: 'You are a helpful assistant.',
  tools: { getWeather, searchDocs },
  stopWhen: stepCountIs(10),
});

// Use in API route:
const result = await myAgent.generate({ prompt: userMessage });
// Or stream:
const result = await myAgent.stream({ prompt: userMessage });
```

The Agent class is mainly a convenience wrapper -- it encapsulates configuration but doesn't add new capabilities beyond `generateText`/`streamText` with tools.

---

## 4. Streaming: streamText vs generateText

### When to Use Each

| | `streamText` | `generateText` |
|---|---|---|
| **Use case** | Interactive chat, real-time UI | Background jobs, automation, email drafts |
| **Returns** | Stream of incremental updates | Complete result after generation |
| **User experience** | Progressive text rendering | Wait for full response |
| **Tool calls** | Streamed as they happen | Returned after completion |
| **Chat integration** | `.toUIMessageStreamResponse()` | Need manual SSE setup |

### streamText for Chat (Recommended)

```ts
// app/api/chat/route.ts
import { streamText, UIMessage, convertToModelMessages } from 'ai';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: gateway('anthropic/claude-sonnet-4-5'),
    messages: await convertToModelMessages(messages),
    tools: { /* ... */ },
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
```

### Streaming Tool Calls

Tool input is streamed progressively. On the client, tool parts go through states:
1. `input-streaming` -- partial input arriving
2. `input-available` -- complete input received
3. `output-available` or `output-error` -- execution finished

### SSE Protocol

AI SDK 5+ uses Server-Sent Events (SSE) natively. The `toUIMessageStreamResponse()` method handles all SSE formatting automatically. No manual WebSocket or stream parsing needed.

---

## 5. RAG Patterns

### Recommended Approach: Tool-Based Retrieval

The AI SDK recommends implementing RAG as a **tool** rather than pre-loading context:

```ts
const tools = {
  searchKnowledgeBase: tool({
    description: 'Search the knowledge base for relevant information. Call this when you need to answer questions about the product.',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
    }),
    execute: async ({ query }) => {
      // 1. Embed the query
      const queryEmbedding = await generateEmbedding(query);
      // 2. Search vector store
      const results = await vectorStore.search(queryEmbedding, { topK: 4 });
      // 3. Return relevant chunks
      return results.map(r => r.text).join('\n\n');
    },
  }),
};
```

### Why Tool-Based RAG?

- **Model decides when to retrieve**: Not every message needs retrieval.
- **Query refinement**: Model can rephrase the query for better results.
- **Multi-step retrieval**: Model can search, evaluate results, and search again.
- **Composable**: Combine with other tools naturally.

### System Prompt with Context (Alternative)

For simpler cases, inject context directly into the system prompt:

```ts
const result = streamText({
  model: gateway('anthropic/claude-sonnet-4-5'),
  system: `You are a helpful assistant. Use this context to answer questions:

${relevantContext}

If the context doesn't contain the answer, say you don't know.`,
  messages: await convertToModelMessages(messages),
});
```

### Full RAG Stack Example

```
User query
  -> Tool: searchKnowledgeBase(query)
    -> Embed query (OpenAI ada-002 / any embedding model)
    -> Vector search (pgvector / Pinecone / etc.)
    -> Return top-K chunks (similarity > 0.5)
  -> Model generates answer with retrieved context
  -> (Optional) Model calls tool again for follow-up queries
```

### Reranking (AI SDK 6)

```ts
import { rerank } from 'ai';
import { cohere } from '@ai-sdk/cohere';

const { ranking } = await rerank({
  model: cohere.reranking('rerank-v3.5'),
  documents: searchResults,
  query: userQuery,
  topN: 3,
});
```

---

## 6. Server-Side Chat Routes

### Basic Next.js App Router Route

```ts
// app/api/chat/route.ts
import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { gateway } from 'ai';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: gateway('anthropic/claude-sonnet-4-5'),
    system: 'You are a helpful assistant.',
    messages: await convertToModelMessages(messages),
    tools: {
      // tool definitions...
    },
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
```

### With Message Persistence

```ts
export async function POST(req: Request) {
  const { message, id: chatId }: { message: UIMessage; id: string } = await req.json();

  // Load previous messages from DB
  const previousMessages = await loadChat(chatId);
  const allMessages = [...previousMessages, message];

  const result = streamText({
    model: gateway('anthropic/claude-sonnet-4-5'),
    messages: await convertToModelMessages(allMessages),
    tools: { /* ... */ },
    stopWhen: stepCountIs(5),
  });

  // Ensure backend completes even if client disconnects
  result.consumeStream();

  return result.toUIMessageStreamResponse({
    originalMessages: allMessages,
    generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }),
    onFinish: ({ messages }) => {
      saveChat({ chatId, messages });
    },
  });
}
```

### Extended Duration (Vercel Deployment)

```ts
export const maxDuration = 60; // seconds (up to 800 on Enterprise)
```

### Using the Agent Class in a Route

```ts
import { ToolLoopAgent } from 'ai';

const agent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4-5',
  instructions: 'You are a blueprint editing assistant.',
  tools: { /* ... */ },
  stopWhen: stepCountIs(10),
});

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = await agent.stream({
    messages: await convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse();
}
```

---

## 7. Multiple Providers in Chat

### AI Gateway (Recommended)

AI SDK 6 uses the Vercel AI Gateway by default. Reference models as strings:

```ts
import { gateway } from 'ai';

// Use any provider through the gateway
const claudeModel = gateway('anthropic/claude-sonnet-4-5');
const perplexityModel = gateway('perplexity/sonar-pro');
const openaiModel = gateway('openai/gpt-4o');
```

### Direct Provider Imports (Alternative)

```ts
import { anthropic } from '@ai-sdk/anthropic';
import { createPerplexity } from '@ai-sdk/perplexity';

const perplexity = createPerplexity({ apiKey: process.env.PERPLEXITY_API_KEY });

const claudeModel = anthropic('claude-sonnet-4-5');
const perplexityModel = perplexity('sonar-pro');
```

### Per-Step Model Switching with prepareStep

Use different models for different steps in an agent loop:

```ts
const result = streamText({
  model: anthropic('claude-sonnet-4-5'), // default model
  tools: { research, analyze },
  stopWhen: stepCountIs(5),
  prepareStep: async ({ stepNumber, steps }) => {
    const lastStep = steps[steps.length - 1];
    // If last step called research tool, switch to cheaper model for next step
    if (lastStep?.toolCalls.some(tc => tc.toolName === 'research')) {
      return { model: anthropic('claude-haiku-4-5') };
    }
    // Override tools available per step
    return {};
  },
  messages: await convertToModelMessages(messages),
});
```

### Tool-Level Provider Usage

A tool's `execute` function can call any provider internally:

```ts
const researchTool = tool({
  description: 'Search the web for current information',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    // Use Perplexity inside a tool while main chat uses Claude
    const { text } = await generateText({
      model: perplexity('sonar-pro'),
      prompt: query,
    });
    return text;
  },
});
```

---

## 8. Structured Outputs

### Structured Output with Tool Loops (AI SDK 6)

AI SDK 6 unifies `generateObject` and `generateText`, allowing multi-step tool calling with structured output at the end:

```ts
import { ToolLoopAgent, Output } from 'ai';

const agent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4-5',
  tools: { getWeather, searchDocs },
  output: Output.object({
    schema: z.object({
      summary: z.string(),
      recommendations: z.array(z.string()),
      confidence: z.number().min(0).max(1),
    }),
  }),
});

const { output } = await agent.generate({
  prompt: 'Analyze the weather and suggest activities',
});
// output is typed: { summary: string; recommendations: string[]; confidence: number }
```

### Structured Output in streamText

```ts
const result = streamText({
  model: gateway('anthropic/claude-sonnet-4-5'),
  tools: { /* ... */ },
  output: Output.object({
    schema: z.object({
      editSuggestions: z.array(z.object({
        section: z.string(),
        currentText: z.string(),
        suggestedText: z.string(),
        rationale: z.string(),
      })),
    }),
  }),
  stopWhen: stepCountIs(5),
  messages: await convertToModelMessages(messages),
});
```

### Data Parts for Streaming Structured Data

Use data parts to stream arbitrary typed data from server to client during a response:

```ts
// Server: emit data parts during streaming
const stream = createUIMessageStream({
  execute: ({ writer }) => {
    writer.write({
      type: 'data',
      data: { type: 'progress', value: 0.5 },
    });
    // ...merge streamText result
  },
});

// Client: consume via dataPartSchemas
const { messages } = useChat({
  dataPartSchemas: {
    progress: z.object({ type: z.literal('progress'), value: z.number() }),
  },
});
```

---

## 9. Client-Side Tool Handling

### Auto-Executing Client Tools (onToolCall)

```tsx
const { messages, sendMessage, addToolOutput } = useChat({
  onToolCall: async ({ toolCall }) => {
    // IMPORTANT: check for dynamic tools first for type narrowing
    if (toolCall.dynamic) return;

    if (toolCall.toolName === 'getLocation') {
      const location = await navigator.geolocation.getCurrentPosition(/* ... */);
      addToolOutput({
        tool: 'getLocation',
        toolCallId: toolCall.toolCallId,
        output: { lat: location.coords.latitude, lng: location.coords.longitude },
      });
    }
  },
  // Auto-resubmit after all tool results are provided
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
});
```

### Interactive Tools (User Confirms/Provides Input)

```tsx
// Render tool invocations in the message parts
{message.parts.map((part, i) => {
  switch (part.type) {
    case 'tool-askForConfirmation':
      if (part.state === 'input-available') {
        return (
          <div key={i}>
            <p>{part.input.message}</p>
            <button onClick={() => addToolOutput({
              tool: 'askForConfirmation',
              toolCallId: part.toolCallId,
              output: 'Yes, confirmed.',
            })}>Confirm</button>
            <button onClick={() => addToolOutput({
              tool: 'askForConfirmation',
              toolCallId: part.toolCallId,
              output: 'No, rejected.',
            })}>Reject</button>
          </div>
        );
      }
      if (part.state === 'output-available') {
        return <p key={i}>Decision: {part.output}</p>;
      }
      return null;

    case 'tool-editSuggestion':
      // Render edit suggestion with approve/reject buttons
      // ...
  }
})}
```

### Tool Invocation States

| State | Description |
|---|---|
| `input-streaming` | Tool input being generated (partial args available) |
| `input-available` | Complete input received, waiting for execution |
| `output-available` | Tool completed successfully |
| `output-error` | Tool execution failed |
| `approval-requested` | Awaiting user approval (needsApproval tools) |

### Approval Flow (needsApproval)

```tsx
case 'approval-requested':
  return (
    <div>
      <p>Approve: {JSON.stringify(part.input)}</p>
      <button onClick={() => addToolApprovalResponse({
        id: part.approval.id,
        approved: true,
      })}>Approve</button>
      <button onClick={() => addToolApprovalResponse({
        id: part.approval.id,
        approved: false,
      })}>Reject</button>
    </div>
  );
```

### Auto-Submit Patterns

```tsx
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai';

const { messages, sendMessage } = useChat({
  // Automatically resubmit when all client-side tool results are provided
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
});
```

For approval workflows:
```tsx
import { lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';

sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
```

---

## 10. Conversation Persistence

### Recommended Storage Format

Store **UIMessage** objects (not ModelMessage). UIMessage is the source of truth containing all parts, metadata, tool results, etc.

### Save via onFinish

```ts
return result.toUIMessageStreamResponse({
  originalMessages: allMessages,
  generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }),
  onFinish: ({ messages }) => {
    // messages = complete UIMessage array (user + assistant)
    saveChat({ chatId, messages });
  },
});
```

### Load on Page Mount

```ts
// Server component or API
export async function loadChat(id: string): Promise<UIMessage[]> {
  const chat = await db.query.chats.findFirst({ where: eq(chats.id, id) });
  return chat?.messages ?? [];
}

// Client
const { messages, sendMessage } = useChat({
  id: chatId,
  messages: initialMessages, // loaded from DB, passed as prop
});
```

### Server-Side ID Generation

Important for persistence consistency:

```ts
return result.toUIMessageStreamResponse({
  generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }),
  // ...
});
```

### Handle Client Disconnects

```ts
result.consumeStream(); // ensures backend completes even if client disconnects
return result.toUIMessageStreamResponse({ /* ... */ });
```

### Optimize Payload Size

Send only the latest message instead of the full history:

```tsx
// Client
const { messages, sendMessage } = useChat({
  transport: new DefaultChatTransport({
    api: '/api/chat',
    prepareSendMessagesRequest({ messages, id }) {
      return {
        body: { message: messages[messages.length - 1], id },
      };
    },
  }),
});

// Server: reconstruct full history from DB + new message
export async function POST(req: Request) {
  const { message, id } = await req.json();
  const previousMessages = await loadChat(id);
  const allMessages = [...previousMessages, message];
  // ...
}
```

---

## 11. Architectural Recommendations

### For the AI-GOS Chat Agent

Given the project's existing stack (`ai@^6.0.70`, `@ai-sdk/anthropic`, `@ai-sdk/perplexity`) and the need for a blueprint editing/analysis chat, here are the recommendations:

#### A. API Route Architecture

```
app/api/chat/route.ts          -- Main chat endpoint
  uses streamText + tools       -- Streaming with multi-step tool loop
  stopWhen: stepCountIs(10)     -- Generous step limit for complex analysis
  prepareStep                   -- Dynamic model/tool selection per step
```

#### B. Tool Architecture

Define tools in separate files, compose into the route:

```
src/lib/ai/chat-tools/
  research.ts         -- Perplexity-powered web research tool
  blueprint-read.ts   -- Read current blueprint sections
  blueprint-edit.ts   -- Suggest edits to blueprint (needsApproval)
  analyze.ts          -- Deep analysis tool (uses Claude internally)
```

Key patterns:
- **Research tool**: Calls Perplexity internally via `generateText`
- **Blueprint read tool**: Returns relevant sections as context (RAG-like)
- **Blueprint edit tool**: Uses `needsApproval: true` for user review
- **Analyze tool**: Uses Claude for deep reasoning

#### C. Client Architecture

```tsx
useChat({
  onToolCall: async ({ toolCall }) => { /* auto-execute client tools */ },
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
})
```

Render tool parts in the UI:
- `tool-research`: Show research results with sources
- `tool-blueprintEdit`: Show diff view with approve/reject buttons
- `tool-analyze`: Show analysis results

#### D. Multi-Model Strategy

```ts
// Main chat: Claude Sonnet 4.5 (reasoning + tool orchestration)
model: anthropic('claude-sonnet-4-5'),

// Research tool internally: Perplexity Sonar Pro
// Inside execute: generateText({ model: perplexity('sonar-pro'), ... })

// Optional: Use prepareStep for cost optimization
prepareStep: async ({ stepNumber }) => {
  // Use Haiku for simple follow-ups
  if (stepNumber > 3) return { model: anthropic('claude-haiku-4-5') };
}
```

#### E. Message Persistence Pattern

```
1. Client sends only latest message + chatId
2. Server loads history from DB, appends new message
3. streamText processes full conversation
4. onFinish saves complete UIMessage array to DB
5. consumeStream() ensures save completes even on disconnect
```

#### F. Key Design Decisions

1. **Use `streamText` (not `generateText`)** for the chat route -- real-time streaming is essential for chat UX.

2. **Use tool-based RAG** -- let the model decide when to retrieve blueprint context rather than always injecting it.

3. **Use `needsApproval` for edits** -- blueprint edits should require user confirmation before applying.

4. **Use `sendAutomaticallyWhen`** -- auto-resubmit after server-side tools complete to keep the agent loop flowing without extra client-side logic.

5. **Use `convertToModelMessages`** -- always convert UIMessages before passing to `streamText`. This is the canonical conversion function.

6. **Use `UIMessage` for persistence** -- store the full UIMessage array, not ModelMessages. UIMessages contain all the information needed to restore the chat UI.

7. **Use `createIdGenerator` for server-side IDs** -- consistent IDs prevent conflicts across sessions.

8. **Use `consumeStream()`** -- always call this before returning the stream response to ensure backend processing completes.

---

## Sources

- [AI SDK Official Docs](https://ai-sdk.dev/docs/introduction)
- [useChat API Reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [Tool Calling Docs](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Chatbot with Tool Calling](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-with-tool-calling)
- [Chatbot Message Persistence](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence)
- [RAG Chatbot Cookbook](https://ai-sdk.dev/cookbook/guides/rag-chatbot)
- [Getting Started: Next.js App Router](https://ai-sdk.dev/docs/getting-started/nextjs-app-router)
- [AI SDK 5 Blog Post](https://vercel.com/blog/ai-sdk-5)
- [AI SDK 6 Blog Post](https://vercel.com/blog/ai-sdk-6)
- [Building AI Agents with Vercel](https://vercel.com/kb/guide/how-to-build-ai-agents-with-vercel-and-the-ai-sdk)
- [Providers and Models](https://ai-sdk.dev/docs/foundations/providers-and-models)
