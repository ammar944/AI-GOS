# Task 3.2: Journey Page Orchestrator

## Objective

Create `src/app/journey/page.tsx` — the client-side page that wires all Phase 2 UI components to the streaming API route from Task 3.1. This page renders the full journey chat experience: a welcome message from the AI strategist, a scrollable message list, a typing indicator during loading, and the glassmorphism input at the bottom. It uses `useChat` with `DefaultChatTransport` to stream responses from `/api/journey/stream`.

## Context

Phase 3 integration task. This is the main orchestrator page that ties everything together. All Phase 2 components (`JourneyLayout`, `JourneyHeader`, `ChatMessage`, `JourneyChatInput`, `TypingIndicator`) are consumed here. The `useChat` hook from `@ai-sdk/react` manages the message array, streaming state, and send function. A hardcoded welcome message (from Task 1.3) is displayed as a fake assistant message that is NOT sent to the API — it's purely client-side decoration. For Sprint 1, `phase` is always `'setup'` and there is no Supabase persistence.

## Dependencies

- Task 1.3 (lead agent system prompt) — provides `LEAD_AGENT_WELCOME_MESSAGE`
- Task 2.1 (JourneyLayout) — layout shell with `phase='setup'` centering
- Task 2.2 (JourneyHeader) — logo-only header
- Task 2.3 (ChatMessage) — message rendering with streaming cursor
- Task 2.4 (JourneyChatInput) — glassmorphism input with auto-resize
- Task 2.5 (TypingIndicator) — 3 bouncing dots for loading state
- Task 3.1 (streaming API route) — backend at `/api/journey/stream`

## Blocked By

- Phase 2 complete (Tasks 2.1–2.R all passed)
- Task 3.1 (API route must exist for streaming to work)

## Research Findings

- From `src/components/chat/agent-chat.tsx`: `useChat` returns `{ messages, sendMessage, status, error, stop, setMessages }`. Status values: `'ready'` (idle), `'submitted'` (request sent, waiting for first token), `'streaming'` (tokens arriving).
- From `src/components/chat/agent-chat.tsx`: Transport is created via `useMemo(() => new DefaultChatTransport({ api: '/api/chat/agent', body: {...} }), [deps])`. For the journey page, body is empty (no blueprint context needed).
- From `src/components/chat/agent-chat.tsx`: `sendMessage({ text: content })` is the correct call signature — pass an object with `text` property, NOT a raw string.
- From `src/components/chat/agent-chat.tsx`: `getTextContent` extracts text from UIMessage parts: `message.parts.filter(p => p.type === 'text').map(p => p.text).join('')`.
- From `src/components/chat/agent-chat.tsx`: Scroll-to-bottom uses `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })` in a `useEffect` keyed on `[messages, status]`.
- From Task 2.3 contract: `ChatMessage` accepts `{ role, content, isStreaming, className }`.
- From Task 2.4 contract: `JourneyChatInput` accepts `{ onSubmit, isLoading, disabled, placeholder, className }`.
- From Task 2.1 contract: `JourneyLayout` accepts `{ phase, chatContent, blueprintContent, className }`.
- From CLAUDE.md: `toUIMessageStreamResponse()` requires `DefaultChatTransport` on the frontend. Mismatched transport causes raw SSE to display as text.
- From existing `agent-chat.tsx`: Welcome/empty state is rendered inline before the message list. The journey page should show the welcome message as a fake `ChatMessage` (role='assistant') rather than an empty state card.

## Implementation Plan

### Step 1: Create the page directory

Create `src/app/journey/` directory if it doesn't exist.

### Step 2: Create page.tsx

Create `src/app/journey/page.tsx`:

```typescript
'use client';

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';

import { JourneyLayout } from '@/components/journey/journey-layout';
import { JourneyHeader } from '@/components/journey/journey-header';
import { ChatMessage } from '@/components/journey/chat-message';
import { JourneyChatInput } from '@/components/journey/chat-input';
import { TypingIndicator } from '@/components/journey/typing-indicator';
import { LEAD_AGENT_WELCOME_MESSAGE } from '@/lib/ai/prompts/lead-agent-system';

/**
 * Extract text content from a UIMessage's parts array.
 * Filters for text parts and joins them into a single string.
 */
function getTextContent(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export default function JourneyPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Transport ─────────────────────────────────────────────────────────
  // No body needed for Sprint 1 (no blueprint context, no session ID).
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/journey/stream',
      }),
    []
  );

  // ── Chat hook ─────────────────────────────────────────────────────────
  const { messages, sendMessage, status, error } = useChat({
    transport,
    onError: (err) => {
      console.error('Journey chat error:', err);
    },
  });

  // ── Derived state ─────────────────────────────────────────────────────
  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';
  const isLoading = isStreaming || isSubmitted;

  // ── Scroll to bottom on new messages ──────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  // ── Submit handler ────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    (content: string) => {
      if (!content.trim() || isLoading) return;
      sendMessage({ text: content.trim() });
    },
    [isLoading, sendMessage]
  );

  // ── Determine streaming state for last message ────────────────────────
  const lastMessage = messages[messages.length - 1];
  const isLastMessageStreaming =
    isStreaming &&
    lastMessage?.role === 'assistant';

  // ── Chat content ──────────────────────────────────────────────────────
  const chatContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <JourneyHeader />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {/* Welcome message — always shown, never sent to API */}
        <ChatMessage
          role="assistant"
          content={LEAD_AGENT_WELCOME_MESSAGE}
          isStreaming={false}
        />

        {/* Actual conversation messages */}
        {messages.map((message, index) => {
          const isThisMessageStreaming =
            message.role === 'assistant' &&
            index === messages.length - 1 &&
            isLastMessageStreaming;

          return (
            <ChatMessage
              key={message.id}
              role={message.role as 'user' | 'assistant'}
              content={getTextContent(message)}
              isStreaming={isThisMessageStreaming}
            />
          );
        })}

        {/* Typing indicator — shown when waiting for first token */}
        {isSubmitted && <TypingIndicator className="ml-9" />}

        {/* Error display */}
        {error && (
          <div
            className="mx-0 my-2 px-3 py-2 rounded-lg text-xs"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
            }}
          >
            {error.message || 'Something went wrong. Please try again.'}
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area — pinned to bottom */}
      <div className="flex-shrink-0 px-4 pb-4 pt-0">
        <JourneyChatInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder="Tell me about your business..."
        />
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="h-screen" style={{ background: 'var(--bg-base)' }}>
      <JourneyLayout phase="setup" chatContent={chatContent} />
    </div>
  );
}
```

### Step 3: Understand the welcome message pattern

The welcome message is rendered as a static `ChatMessage` component at the top of the messages area. It is NOT included in the `messages` array from `useChat` and is NOT sent to the API. This means:

1. The AI never sees its own welcome message in conversation history (it comes from the system prompt persona instead).
2. The welcome message always appears, even on page refresh.
3. No special handling needed for the first user message — `useChat` manages the full conversation lifecycle.

### Step 4: Understand the typing indicator logic

The `TypingIndicator` should show ONLY when `status === 'submitted'` — meaning the request has been sent but no tokens have arrived yet. Once `status === 'streaming'`, the streaming cursor inside `ChatMessage` takes over. The two indicators should never appear simultaneously:

- `status === 'submitted'` → Show `TypingIndicator` (bouncing dots)
- `status === 'streaming'` → Show streaming cursor in the last `ChatMessage` via `isStreaming={true}`
- `status === 'ready'` → Show neither

### Step 5: Understand the scroll behavior

Auto-scroll fires on every `messages` or `status` change via `useEffect`. The `messagesEndRef` div is an invisible anchor at the bottom of the message list. `scrollIntoView({ behavior: 'smooth' })` provides smooth scroll animation.

### Step 6: Understand the layout structure

The height chain works as follows:
```
div.h-screen                     ← full viewport
  └─ JourneyLayout phase="setup" ← h-full (fills parent)
       └─ chatContent div        ← flex flex-col h-full
            ├─ JourneyHeader     ← 56px fixed height
            ├─ Messages area     ← flex-1 overflow-y-auto (scrollable)
            └─ Input area        ← flex-shrink-0 (pinned to bottom)
```

### Step 7: Verify the page is accessible

- `/journey` should be protected by Clerk middleware (confirmed: not in `isPublicRoute`)
- Unauthenticated users are redirected to `/sign-in` by Clerk middleware
- The page itself doesn't need its own auth check — middleware handles it

## Files to Create

- `src/app/journey/page.tsx`

## Contracts

### Provides (for downstream tasks)

```
Route: /journey
Type: Client component (default export)
Auth: Clerk middleware-protected
Layout: Full viewport, centered chat (max-width 720px)
Features: Welcome message, streaming chat, auto-scroll, typing indicator, error display
```

- Task 3.R (Regression) tests this page end-to-end

### Consumes (from upstream tasks)

- Task 1.3: `LEAD_AGENT_WELCOME_MESSAGE` from `@/lib/ai/prompts/lead-agent-system`
- Task 2.1: `JourneyLayout` component with `phase='setup'` prop
- Task 2.2: `JourneyHeader` component
- Task 2.3: `ChatMessage` component with `role`, `content`, `isStreaming` props
- Task 2.4: `JourneyChatInput` component with `onSubmit`, `isLoading`, `placeholder` props
- Task 2.5: `TypingIndicator` component with optional `className` prop
- Task 3.1: Backend API at `/api/journey/stream` returning `UIMessageStreamResponse`

## Acceptance Criteria

- [ ] File exists at `src/app/journey/page.tsx`
- [ ] `'use client'` directive at top of file
- [ ] Default export function (Next.js page convention)
- [ ] `useChat` hook with `DefaultChatTransport` pointing to `/api/journey/stream`
- [ ] Transport created in `useMemo` (stable reference)
- [ ] Welcome message rendered as static `ChatMessage` (role='assistant', not sent to API)
- [ ] Welcome message uses `LEAD_AGENT_WELCOME_MESSAGE` from Task 1.3
- [ ] All conversation messages rendered via `ChatMessage` component
- [ ] `getTextContent()` correctly extracts text from UIMessage parts
- [ ] Last streaming assistant message gets `isStreaming={true}` on its `ChatMessage`
- [ ] `TypingIndicator` shown only when `status === 'submitted'`
- [ ] `TypingIndicator` hidden when `status === 'streaming'` or `status === 'ready'`
- [ ] Auto-scroll to bottom on new messages via `messagesEndRef`
- [ ] `JourneyChatInput` disabled when streaming (`isLoading={true}`)
- [ ] `JourneyChatInput` calls `sendMessage({ text: content })` on submit
- [ ] Error display shown when `useChat` reports an error
- [ ] `JourneyLayout` wraps everything with `phase='setup'` (centered, max-width 720px)
- [ ] `JourneyHeader` rendered at top of chat content
- [ ] Full viewport height (`h-screen`) with proper flex column layout
- [ ] No Supabase persistence (Sprint 1 — conversation is ephemeral)
- [ ] No tools, no branching, no export menu, no undo/redo (Sprint 1 scope)
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Lint passes

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] No new TypeScript errors introduced

### Visual/Functional Verification (Manual)

- [ ] Navigate to `/journey` — page loads, welcome message visible
- [ ] Welcome message matches `LEAD_AGENT_WELCOME_MESSAGE` text exactly
- [ ] Welcome message has AI avatar (gradient circle) and left-aligned styling
- [ ] Chat input is visible at bottom with "Tell me about your business..." placeholder
- [ ] Layout is centered (max-width 720px) per JourneyLayout `phase='setup'`
- [ ] Header shows "AI-GOS" gradient logo at top

### Streaming Flow (Manual)

- [ ] Type a message and press Enter — message appears as user bubble (right-aligned)
- [ ] Typing indicator (3 bouncing dots) appears below user message
- [ ] Once streaming starts, typing indicator disappears
- [ ] AI response streams in character-by-character with blinking cursor
- [ ] Streaming cursor disappears when response completes
- [ ] Messages auto-scroll to keep latest content visible
- [ ] Can send a follow-up message after AI completes — full round-trip works

### Error Handling (Manual)

- [ ] If API returns error, red error banner appears below messages
- [ ] If network fails, error is caught and displayed

### Playwright Integration (Task 3.R)

- [ ] Navigate to `/journey` — 200 response, page renders
- [ ] Welcome message text is present in DOM
- [ ] Input field is interactive (can type)
- [ ] Submitting a message triggers streaming (status changes visible)
- [ ] After response completes, input is re-enabled

## Research Files to Read

- `.claude/orchestration-aigos-v2-sprint1/research/existing-codebase.md` — useChat patterns, transport setup
- `.claude/orchestration-aigos-v2-sprint1/research/chat-ui-components.md` — Component contracts
- `.claude/orchestration-aigos-v2-sprint1/DISCOVERY.md` — D4 persona, D14 layout

## Git

- Branch: `aigos-v2`
- Commit message prefix: `Task 3.2:`
