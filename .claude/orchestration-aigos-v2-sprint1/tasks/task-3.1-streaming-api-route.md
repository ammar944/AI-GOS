# Task 3.1: Streaming API Route

## Objective

Create the `/api/journey/stream` POST endpoint that streams AI responses using Vercel AI SDK v6. This route uses `streamText` with Claude Opus 4.6 and adaptive thinking, sanitizes incoming messages to prevent `MissingToolResultsError`, and returns the response via `toUIMessageStreamResponse()`. No tools are wired for Sprint 1 — this is pure conversational streaming.

## Context

Phase 3 integration task. This is the backend counterpart to the journey page. The existing codebase has a proven pattern in `src/app/api/chat/agent/route.ts` that uses the same `streamText` + `convertToModelMessages` + `toUIMessageStreamResponse` flow. This task replicates that pattern for the journey experience but with significant simplifications: no tools, no blueprint context, no persistence callbacks. The system prompt comes from `lead-agent-system.ts` (Task 1.3) and the model constant from `providers.ts` (Task 1.4).

## Dependencies

- Task 1.3 (lead agent system prompt) — provides `LEAD_AGENT_SYSTEM_PROMPT`
- Task 1.4 (model constant) — provides `MODELS.CLAUDE_OPUS` = `'claude-opus-4-6'`

## Blocked By

- Phase 1 complete (Tasks 1.1–1.R all passed)

## Research Findings

- From `src/app/api/chat/agent/route.ts`: Proven pattern for message sanitization — filter out tool parts with states `input-streaming`, `input-available`, `approval-requested` to prevent `MissingToolResultsError` when `convertToModelMessages()` encounters tool calls without results.
- From `src/lib/ai/providers.ts`: `anthropic` provider instance already exported via `createAnthropic()`. After Task 1.4, `MODELS.CLAUDE_OPUS` = `'claude-opus-4-6'` is available.
- From CLAUDE.md: `convertToModelMessages()` is async — must `await` it. This is a critical gotcha that causes runtime errors if forgotten.
- From CLAUDE.md: `toUIMessageStreamResponse()` must pair with `DefaultChatTransport` on the frontend. Using the wrong transport causes raw SSE text to display instead of parsed messages.
- From existing agent route: `maxDuration = 300` for Vercel Pro tier (5-minute timeout for long responses).
- From DISCOVERY.md D2: Adaptive thinking via `thinking: { type: "adaptive" }` — Opus decides when to use extended thinking vs. direct response.
- From `src/middleware.ts`: `/journey` is NOT in `isPublicRoute`, so Clerk middleware auto-protects it. The API route at `/api/journey/stream` is also protected by middleware, but we add explicit `auth()` check as defense-in-depth.

## Implementation Plan

### Step 1: Create the route directory

Create the directory `src/app/api/journey/stream/` if it doesn't exist.

### Step 2: Create route.ts

Create `src/app/api/journey/stream/route.ts`:

```typescript
// POST /api/journey/stream
// Streaming chat endpoint for the v2 journey experience.
// Uses Claude Opus 4.6 with adaptive thinking for conversational strategy sessions.

import { streamText, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { anthropic } from '@/lib/ai/providers';
import { MODELS } from '@/lib/ai/providers';
import { LEAD_AGENT_SYSTEM_PROMPT } from '@/lib/ai/prompts/lead-agent-system';

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
  // This mirrors the exact pattern from src/app/api/chat/agent/route.ts.
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
    thinking: { type: 'adaptive' },
    temperature: 0.3,
  });

  return result.toUIMessageStreamResponse();
}
```

### Step 3: Verify import paths

Confirm the following imports resolve correctly:
- `import { anthropic, MODELS } from '@/lib/ai/providers'` — provider instance + model constants
- `import { LEAD_AGENT_SYSTEM_PROMPT } from '@/lib/ai/prompts/lead-agent-system'` — system prompt from Task 1.3
- `import { streamText, convertToModelMessages } from 'ai'` — Vercel AI SDK core
- `import type { UIMessage } from 'ai'` — message type for the request body
- `import { auth } from '@clerk/nextjs/server'` — Clerk auth check

### Step 4: Verify no tools are passed

Sprint 1 is conversation-only. The `streamText` call must NOT include a `tools` parameter. Tools will be added in Sprint 2.

### Step 5: Verify maxDuration

`export const maxDuration = 300` is required for Vercel Pro tier. Without it, the serverless function times out after 10s on the default plan or 60s on Pro.

## Files to Create

- `src/app/api/journey/stream/route.ts`

## Contracts

### Provides (for downstream tasks)

```
POST /api/journey/stream
Request body: { messages: UIMessage[] }
Response: UIMessageStreamResponse (SSE stream)
Auth: Clerk userId required (401 if missing)
```

- Task 3.2 (Journey Page) connects to this via `DefaultChatTransport({ api: '/api/journey/stream' })`

### Consumes (from upstream tasks)

- Task 1.3: `LEAD_AGENT_SYSTEM_PROMPT` from `@/lib/ai/prompts/lead-agent-system`
- Task 1.4: `MODELS.CLAUDE_OPUS` from `@/lib/ai/providers` (value: `'claude-opus-4-6'`)
- Existing: `anthropic` provider instance from `@/lib/ai/providers`

## Acceptance Criteria

- [ ] File exists at `src/app/api/journey/stream/route.ts`
- [ ] `export const maxDuration = 300` at module level
- [ ] POST handler exports correctly
- [ ] Clerk `auth()` check returns 401 JSON on unauthorized requests
- [ ] Request body validation returns 400 JSON when messages is missing or not an array
- [ ] Messages are sanitized — incomplete tool parts with states `input-streaming`, `input-available`, `approval-requested` are stripped
- [ ] `convertToModelMessages()` is properly `await`ed (async!)
- [ ] `streamText` uses `anthropic(MODELS.CLAUDE_OPUS)` as model
- [ ] `streamText` passes `LEAD_AGENT_SYSTEM_PROMPT` as `system` parameter
- [ ] `streamText` includes `thinking: { type: 'adaptive' }`
- [ ] `streamText` includes `temperature: 0.3`
- [ ] `streamText` does NOT include `tools` parameter (Sprint 1: no tools)
- [ ] `streamText` does NOT include `prepareStep` or `stopWhen` (no tool loop)
- [ ] Returns `result.toUIMessageStreamResponse()` (NOT `toTextStreamResponse`)
- [ ] No `onFinish` callback (no persistence in Sprint 1)
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Lint passes

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] No new TypeScript errors introduced

### Manual Smoke Test

- [ ] Start dev server (`npm run dev`)
- [ ] Use browser devtools or `curl` to POST to `/api/journey/stream` without auth header → 401 response
- [ ] Authenticated POST with `{ "messages": [] }` technically works (empty conversation) — does not crash
- [ ] Authenticated POST with valid messages returns SSE stream headers (`Content-Type: text/event-stream` or similar)

### Integration Test (with Task 3.2)

- [ ] Frontend `useChat` connects successfully and receives streaming tokens
- [ ] No `MissingToolResultsError` in server logs
- [ ] Responses reflect the lead agent persona (warm, direct, no AI slop)
- [ ] Adaptive thinking activates on complex questions (reasoning traces may appear)

## Research Files to Read

- `.claude/orchestration-aigos-v2-sprint1/research/existing-codebase.md` — Agent route pattern
- `.claude/orchestration-aigos-v2-sprint1/DISCOVERY.md` — D2 model config, D5 prompt location

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 3.1:`
