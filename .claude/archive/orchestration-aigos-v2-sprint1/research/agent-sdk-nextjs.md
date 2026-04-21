# Research: Agent SDK + Next.js Integration

**Date**: 2026-02-27
**Domain**: Agent SDK Orchestrator + SSE Streaming
**Status**: Complete

---

## Summary

The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk` v0.2.61) is fundamentally a wrapper around the Claude Code CLI that spawns a child process for each `query()` call. This architecture makes it **incompatible with Vercel serverless functions** due to ~12-second cold start overhead, 8GB+ RAM requirements, and the need for a persistent filesystem with Node.js CLI. The recommended approach for AI-GOS v2 Sprint 1 is to **continue using the existing Vercel AI SDK pattern** (`streamText` + `@ai-sdk/anthropic` + `toUIMessageStreamResponse()`) which already works in the codebase, supports Opus 4.6, extended thinking, tool calling, and streaming -- and operates natively in serverless environments. The Agent SDK should only be considered for a future container-based deployment (e.g., Fly.io) if subagent orchestration or built-in tool execution becomes a hard requirement.

---

## Key Findings

### 1. Agent SDK Architecture (Critical Blocker)

The Agent SDK does NOT call the Anthropic API directly. It works by:

1. **Spawning a child process** running the Claude Code CLI (`cli.js`)
2. Communicating with that process via IPC (JSON messages over stdio)
3. The CLI process manages the agent loop, tool execution, and API calls internally

**Concrete evidence:**
- The SDK bundles `cli.js` internally and spawns it via `child_process.spawn`
- The `spawnClaudeCodeProcess` option exists specifically to customize this spawning behavior
- GitHub issue #34 documents **~12-second overhead per `query()` call** due to process initialization
- The `pathToClaudeCodeExecutable` option confirms it needs the CLI binary
- Memory requirement: **minimum 8GB RAM** (documented in serverless deployment analysis) due to subprocess stdout/stderr retention in the Node.js heap

**Performance measurements from GitHub issue #34:**
| Method | Latency |
|--------|---------|
| Agent SDK (cold) | ~12-13s per query |
| Agent SDK (warm, streaming mode) | ~2-3s per query |
| Direct Anthropic Messages API | 1-3s per query |

### 2. query() Function API

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// Returns AsyncGenerator<SDKMessage, void>
const q = query({
  prompt: "Your instruction here",
  options: {
    model: "claude-opus-4-6",
    allowedTools: ["Read", "Edit", "Bash"],
    systemPrompt: "Custom system prompt",
    thinking: { type: "adaptive" },  // or { type: "enabled", budgetTokens: N }
    permissionMode: "acceptEdits",
    maxTurns: 10,
    maxBudgetUsd: 5.0,
    includePartialMessages: true,  // Required for streaming text deltas
    hooks: { PostToolUse: [{ matcher: "Edit", hooks: [logFn] }] },
    agents: { "reviewer": { description: "...", prompt: "...", tools: ["Read"] } },
    mcpServers: { "custom": customMcpServer },
    resume: sessionId,  // Resume prior session
    effort: "high",     // "low" | "medium" | "high" | "max"
    abortController: new AbortController(),
  }
});
```

**Message types yielded by the async generator:**
- `SDKSystemMessage` (type: "system", subtype: "init") -- session initialization with session_id, tools, model
- `SDKAssistantMessage` (type: "assistant") -- contains `message.content` blocks (text, tool_use, thinking)
- `SDKPartialAssistantMessage` (type: "stream_event") -- only with `includePartialMessages: true`, wraps `BetaRawMessageStreamEvent` from Anthropic SDK (includes `content_block_delta` with `text_delta`, `thinking_delta`, etc.)
- `SDKUserMessage` (type: "user") -- tool results, synthetic messages
- `SDKResultMessage` (type: "result") -- final result with `total_cost_usd`, `usage`, `modelUsage`, `duration_ms`
- `SDKStatusMessage`, `SDKToolProgressMessage`, `SDKHookStartedMessage`, etc.

**Query interface methods:**
```typescript
interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setModel(model?: string): Promise<void>;
  streamInput(stream: AsyncIterable<SDKUserMessage>): Promise<void>;
  close(): void;
  // ... more utility methods
}
```

### 3. V2 Preview Interface (Simpler Multi-Turn)

A new `unstable_v2_*` API simplifies multi-turn:

```typescript
import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk";

await using session = unstable_v2_createSession({ model: "claude-opus-4-6" });

await session.send("First message");
for await (const msg of session.stream()) {
  if (msg.type === "assistant") { /* process */ }
}

await session.send("Follow-up");
for await (const msg of session.stream()) { /* ... */ }
```

Same child process architecture underneath -- just easier API surface.

### 4. Custom Tools via MCP

The Agent SDK uses MCP (Model Context Protocol) servers for custom tools:

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const server = createSdkMcpServer({
  name: "blueprint-tools",
  version: "1.0.0",
  tools: [
    tool(
      "searchBlueprint",
      "Search blueprint sections",
      { query: z.string().describe("Search query") },
      async (args) => ({
        content: [{ type: "text", text: JSON.stringify(results) }]
      })
    )
  ]
});

for await (const msg of query({
  prompt: "...",
  options: {
    mcpServers: { "blueprint-tools": server },
    allowedTools: ["mcp__blueprint-tools__searchBlueprint"]
  }
})) { /* ... */ }
```

### 5. Hooks System

Available hooks: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `SubagentStart`, `SubagentStop`, `PermissionRequest`, `Notification`, `PreCompact`, `Setup`, `TeammateIdle`, `TaskCompleted`, `ConfigChange`, `WorktreeCreate`, `WorktreeRemove`.

```typescript
const costTracker: HookCallback = async (input, toolUseId, { signal }) => {
  if (input.hook_event_name === "PostToolUse") {
    // Log tool_name, tool_input, tool_response
  }
  return {};
};

options: {
  hooks: {
    PostToolUse: [{ matcher: ".*", hooks: [costTracker] }]
  }
}
```

### 6. Vercel Serverless Constraints (Why Agent SDK Won't Work)

| Constraint | Vercel Serverless | Agent SDK Requirement |
|------------|------------------|-----------------------|
| Max duration | 300s (Pro) | Unlimited (long-running) |
| RAM | 1024-3008 MB | 8GB+ recommended |
| Cold start | <1s expected | ~12s per query() |
| Filesystem | Read-only (except /tmp) | Persistent read/write CWD |
| Child processes | Limited support | Requires spawning CLI |
| Process lifecycle | Ephemeral per request | Needs persistent process |

**Vercel Sandbox** is a separate product that COULD run the Agent SDK (creates isolated containers), but it is not a serverless function -- it is a full container environment with different billing and setup. Not appropriate for Sprint 1.

### 7. Existing Codebase Pattern (Vercel AI SDK)

The codebase already has a working chat agent at `src/app/api/chat/agent/route.ts`:

```typescript
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { groq, GROQ_CHAT_MODEL } from '@/lib/ai/groq-provider';

const result = streamText({
  model: groq(GROQ_CHAT_MODEL),  // Currently Groq Llama 3.3 70B
  system: systemPrompt,
  messages: await convertToModelMessages(sanitizedMessages),
  tools,
  prepareStep: ({ steps }) => { /* control tool flow */ },
  stopWhen: stepCountIs(10),
  temperature: 0.3,
  onFinish: async ({ text, totalUsage, steps }) => { /* persist */ },
});

return result.toUIMessageStreamResponse();
```

Frontend uses `useChat` from `@ai-sdk/react`:
```typescript
const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/chat/agent',
  body: { blueprint, blueprintId },
});
```

### 8. Vercel AI SDK + @ai-sdk/anthropic Capabilities

The existing `@ai-sdk/anthropic` provider (v3.0.36 in codebase) supports:

**Extended Thinking:**
```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

const result = streamText({
  model: anthropic('claude-opus-4-6'),
  prompt: "...",
  providerOptions: {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: 12000 },
      // OR: thinking: { type: 'adaptive' } -- not confirmed in docs
    },
  },
});
```

**Opus 4.6 Speed Mode:**
```typescript
providerOptions: {
  anthropic: {
    speed: 'fast',   // ~2.5x faster output
    effort: 'medium', // Controls thinking depth
  },
}
```

**Prompt Caching:**
```typescript
messages: [{
  role: 'user',
  content: [{
    type: 'text',
    text: longSystemPrompt,
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } },
    },
  }],
}]
```

**Tool Calling:** Already working in the codebase with Zod `inputSchema`.

**Streaming:** `streamText()` + `toUIMessageStreamResponse()` works with `useChat` via `DefaultChatTransport`.

### 9. Feature Comparison: Agent SDK vs Vercel AI SDK

| Feature | Agent SDK | Vercel AI SDK + @ai-sdk/anthropic |
|---------|-----------|-----------------------------------|
| Model: Opus 4.6 | Yes | Yes |
| Extended Thinking | Yes (adaptive) | Yes (budgetTokens or adaptive) |
| Tool Calling | Yes (MCP-based) | Yes (Zod inputSchema) |
| Streaming to Browser | Manual bridge needed | Built-in (toUIMessageStreamResponse) |
| useChat Integration | Not supported | Native |
| Subagents | Yes (Task tool) | No (must implement manually) |
| Built-in File Tools | Yes (Read, Edit, Bash, etc.) | No (must implement) |
| Prompt Caching | Yes (automatic) | Yes (via providerOptions) |
| Session Resumption | Yes (built-in) | Manual (store messages) |
| Cost Tracking | Yes (total_cost_usd) | Yes (totalUsage in onFinish) |
| Serverless Compatible | NO | YES |
| Cold Start | ~12s | <1s |
| RAM Requirement | 8GB+ | <512MB |
| Process Model | Child process (CLI) | In-process API call |
| Multi-provider | No (Claude only) | Yes (any provider) |

---

## Recommended Approach

**Use the Vercel AI SDK (`streamText` + `@ai-sdk/anthropic`) for Sprint 1.**

Specifically:

### API Route: `src/app/api/journey/stream/route.ts`

```typescript
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { auth } from '@clerk/nextjs/server';

export const maxDuration = 300;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const { messages } = await request.json();

  const result = streamText({
    model: anthropic('claude-opus-4-6'),
    system: LEAD_AGENT_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 10000 },
        // Enable prompt caching on system prompt
      },
    },
    // Tools can be added in later sprints
    temperature: 0.3,
  });

  return result.toUIMessageStreamResponse();
}
```

### Frontend: `src/components/journey/journey-chat.tsx`

```typescript
import { useChat } from '@ai-sdk/react';

const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/journey/stream',
});
```

### Why This Approach

1. **Zero new dependencies** -- uses existing `ai` and `@ai-sdk/anthropic` packages
2. **Proven pattern** -- identical to the working chat agent at `/api/chat/agent`
3. **Serverless native** -- no child processes, no CLI, no 8GB RAM
4. **useChat compatible** -- `toUIMessageStreamResponse()` works with `DefaultChatTransport`
5. **Supports Opus 4.6** -- with thinking, tool calling, prompt caching, speed mode
6. **Sub-second cold start** -- vs 12s for Agent SDK
7. **Follows CLAUDE.md conventions** -- existing patterns, no new abstractions

### Future Sprint Migration Path (if needed)

If subagent orchestration becomes critical in Sprint 3+:
1. Deploy Agent SDK in a container (Fly.io or Vercel Sandbox)
2. Expose via WebSocket or SSE endpoint
3. Frontend connects to container endpoint instead of serverless function
4. Keep Vercel AI SDK as the fallback for simple interactions

---

## Alternatives Considered

### Alternative 1: Agent SDK in Vercel Serverless (REJECTED)

**Why rejected:**
- ~12s cold start per query (unacceptable for chat UX)
- 8GB+ RAM requirement exceeds Vercel's 3008MB limit
- Spawns child processes (fragile in serverless)
- Read/write filesystem required (Vercel is read-only except /tmp)
- 80MB unpacked package size

### Alternative 2: Agent SDK in Vercel Sandbox (DEFERRED)

**Why deferred:**
- Vercel Sandbox is a separate product requiring `@vercel/sandbox` package
- Adds significant infrastructure complexity for Sprint 1
- Good for Sprint 3+ when subagents/file tools are needed
- Would require a custom WebSocket bridge to frontend

### Alternative 3: Agent SDK in Container (Fly.io / E2B) (DEFERRED)

**Why deferred:**
- Adds infrastructure outside Vercel (deployment complexity)
- Good long-term architecture but overkill for Sprint 1
- Sprint 1 only needs basic streaming chat -- no file operations or subagents
- Consider for Sprint 3+ if subagent orchestration is confirmed

### Alternative 4: Direct Anthropic SDK (`@anthropic-ai/sdk`) (REJECTED)

**Why rejected:**
- Would require building streaming SSE bridge manually
- No `useChat` integration
- More code for same result
- Vercel AI SDK already wraps this with proper streaming support

### Alternative 5: Agent SDK with Custom SSE Bridge (REJECTED)

Theoretical pattern to pipe Agent SDK output to SSE:
```typescript
// THEORETICAL -- NOT RECOMMENDED
export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const msg of query({ prompt, options })) {
        if (msg.type === 'stream_event') {
          const event = msg.event;
          if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({text: event.delta.text})}\n\n`));
            }
          }
        }
      }
      controller.close();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
}
```

**Why rejected:**
- Would NOT work with `useChat` (incompatible SSE format)
- Still has the 12s cold start and 8GB RAM problems
- Custom bridge is fragile and hard to maintain
- Would need to implement tool call state management manually

---

## Pitfalls and Edge Cases

### Agent SDK Pitfalls (if used in future)

1. **12s cold start**: Each `query()` spawns a new child process. Mitigate with streaming input mode to keep the process warm between messages (~2-3s for subsequent queries).

2. **Memory leaks**: All subprocess stdout/stderr is retained in the JS heap. Long sessions can OOM. Set `NODE_OPTIONS="--max-old-space-size=4096"` and `MALLOC_ARENA_MAX=2`.

3. **Orphaned processes**: If the parent process dies, spawned Claude Code processes become zombies. Use `abortController` and proper cleanup via `query.close()`.

4. **Settings interference**: User-level `~/.claude/settings.json` can override SDK config. Use `settingSources: []` (empty) to isolate.

5. **Bundler issues**: The SDK bundles `cli.js` which breaks with webpack/esbuild. Needs special config (`external: ['@anthropic-ai/claude-agent-sdk']`).

6. **WSL2/Docker issues**: Process spawning fails silently on some platforms (GitHub issue #20, #14464). Need `pathToClaudeCodeExecutable` workaround.

### Vercel AI SDK Pitfalls (current approach)

1. **MissingToolResultsError**: `convertToModelMessages()` throws if tool calls lack results. Sanitize messages by stripping incomplete tool parts before converting (already handled in codebase).

2. **Transport matching**: `toUIMessageStreamResponse()` requires `DefaultChatTransport` on frontend. Using `TextStreamChatTransport` will show raw SSE as text.

3. **Thinking tokens not in totalUsage**: Extended thinking token usage may need separate tracking via `providerMetadata.anthropic`.

4. **Prompt caching minimum**: Anthropic requires 1024-4096 tokens minimum for caching. Short system prompts won't benefit.

5. **300s max duration**: Vercel Pro tier limit. Complex agentic loops with many tool calls could timeout. Use `stopWhen: stepCountIs(N)` to bound iterations.

6. **UIMessage providerOptions**: `UIMessage` type from `useChat` does NOT support `providerOptions`. Must use `convertToModelMessages()` first in the API route.

---

## References

- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Agent SDK V2 Preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview)
- [Agent SDK Hosting Guide](https://platform.claude.com/docs/en/agent-sdk/hosting)
- [Agent SDK Streaming vs Single Mode](https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- [Agent SDK 12s Overhead Issue](https://github.com/anthropics/claude-agent-sdk-typescript/issues/34)
- [Agent SDK Common Pitfalls](https://liruifengv.com/posts/claude-agent-sdk-pitfalls-en/)
- [Vercel AI SDK Anthropic Provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)
- [Vercel AI SDK 6 Blog Post](https://vercel.com/blog/ai-sdk-6)
- [Vercel Sandbox + Agent SDK Guide](https://vercel.com/kb/guide/using-vercel-sandbox-claude-agent-sdk)
- [Serverless Claude Code Platform Comparison](https://gist.github.com/alexfazio/dcf2f253d346d8ed2702935b57184582)
- [Complete Guide to Building Agents with Claude Agent SDK](https://nader.substack.com/p/the-complete-guide-to-building-agents)
- [npm: @anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)

---

## Appendix: PRD Open Questions Resolved

**Q1: How to integrate Agent SDK with Next.js SSE streaming?**
Answer: Don't. The Agent SDK spawns child processes and is incompatible with Vercel serverless. Use `streamText` + `@ai-sdk/anthropic` instead, which is already proven in the codebase.

**Q2: Does the Agent SDK have a web-compatible transport?**
Answer: No. The Agent SDK yields `SDKMessage` objects from an async generator. There is no built-in SSE/WebSocket transport. A custom bridge would be needed, but it would NOT be compatible with `useChat`'s expected stream format (`toUIMessageStreamResponse`).

**Q5: Google Fonts -- next/font or link tags?**
Answer: (Out of scope for this research, but: use `next/font` for automatic optimization and self-hosting.)

**Q6: Tailwind v4 tokens -- globals.css @theme or tailwind config?**
Answer: (Out of scope for this research, but: Tailwind v4 uses CSS-first config, so tokens go in `globals.css` via `@theme` directive.)
