# Research: Chat UI Components + Streaming UX

**Domain**: Chat UI Components + Streaming UX
**Sprint**: AI-GOS v2 Sprint 1
**Date**: 2026-02-27

---

## 1. useChat from @ai-sdk/react

### Installed Versions

- `@ai-sdk/react`: **3.0.75** (from `package.json` `^3.0.75`, installed exactly `3.0.75`)
- `ai` (core): **6.0.73** (from `package.json` `^6.0.70`, installed `6.0.73`)

### Existing Usage Pattern (agent-chat.tsx)

The v1 codebase at `/src/components/chat/agent-chat.tsx` demonstrates the full useChat integration. Key patterns:

#### Transport Configuration

```tsx
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

// Transport is created with useMemo — recreated when deps change
const transport = useMemo(
  () =>
    new DefaultChatTransport({
      api: '/api/chat/agent',    // <-- Custom API endpoint
      body: {                     // <-- Extra body data sent with every request
        blueprintId: blueprintId || '',
        blueprint,
        conversationId,
      },
    }),
  [blueprint, blueprintId, conversationId]
);
```

**For v2 /journey endpoint**, the transport would be:

```tsx
const transport = useMemo(
  () =>
    new DefaultChatTransport({
      api: '/api/journey/stream',
      body: {
        sessionId,
        phase: journeyPhase,
      },
    }),
  [sessionId, journeyPhase]
);
```

#### useChat Hook Destructured State

```tsx
const {
  messages,                    // UIMessage[] — full message history
  sendMessage,                 // (opts: { text: string }) => void — send user message
  addToolApprovalResponse,     // (opts: { id: string, approved: boolean }) => void
  status,                      // 'ready' | 'submitted' | 'streaming' | 'error'
  error,                       // Error | undefined
  stop,                        // () => void — abort streaming
  setMessages,                 // React setState for messages
} = useChat({
  transport,
  sendAutomaticallyWhen: ...,  // optional auto-resubmit condition
  onError: (err) => { ... },   // error callback
});
```

#### Status-Based UI State

```tsx
const isStreaming = status === 'streaming';
const isSubmitted = status === 'submitted';
const isLoading = isStreaming || isSubmitted || hasPendingApproval;
```

Status lifecycle: `ready` -> `submitted` (request sent, awaiting first token) -> `streaming` (tokens arriving) -> `ready` (complete).

#### Message Submission

```tsx
const handleSubmit = useCallback(
  (content: string) => {
    if (!content || isLoading) return;
    sendMessage({ text: content });
  },
  [isLoading, sendMessage]
);
```

#### Rendering Streaming Text

Messages have a `parts` array. Text parts are extracted and rendered:

```tsx
// Extract text from message parts
const getTextContent = (message: UIMessage): string => {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');
};

// During streaming, the last assistant message gets isStreaming=true
const isLastAssistant =
  message.role === 'assistant' &&
  msgIndex === messages.length - 1 &&
  isStreaming;
```

The `MessageBubble` receives `isStreaming` and renders the streaming cursor:

```tsx
{isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
```

#### Backend Response Format (CRITICAL — must match)

The backend MUST use `toUIMessageStreamResponse()` (not `toTextStreamResponse()`):

```tsx
// route.ts
const result = streamText({
  model: groq(GROQ_CHAT_MODEL),
  system: systemPrompt,
  messages: await convertToModelMessages(sanitizedMessages),
  tools,
  temperature: 0.3,
});
return result.toUIMessageStreamResponse();
```

**Transport matching rule**: `toUIMessageStreamResponse()` requires `DefaultChatTransport` on the frontend. Using `toTextStreamResponse()` with `DefaultChatTransport` causes raw SSE text to display.

### v2 Journey Minimal useChat Setup

For Sprint 1, the journey page needs a simpler setup (no tools, no blueprint):

```tsx
'use client';

import { useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';

export function JourneyChat() {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/journey/stream' }),
    []
  );

  const { messages, sendMessage, status, error, stop } = useChat({ transport });

  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';
  const isLoading = isStreaming || isSubmitted;

  const handleSubmit = (text: string) => {
    if (!text.trim() || isLoading) return;
    sendMessage({ text });
  };

  return (
    // ... render messages + input
  );
}
```

---

## 2. Chat Message Rendering Patterns

### Existing Component: MessageBubble

Located at `/src/components/chat/message-bubble.tsx`.

#### User vs AI Message Distinction

**User messages** — right-aligned, bubble-wrapped:

```tsx
if (isUser) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.smooth, delay }}
      className="flex gap-3 px-4 py-2 flex-row-reverse"
    >
      <div
        className="max-w-[88%] px-3.5 py-2.5 ml-auto"
        style={{
          background: 'var(--bg-hover, #161616)',
          border: '1px solid var(--border-default, rgba(255, 255, 255, 0.12))',
          borderRadius: '14px 14px 4px 14px',  // notch on bottom-right
          color: 'var(--text-primary, #ffffff)',
          fontSize: '13.5px',
        }}
      >
        {renderContent(content)}
      </div>
    </motion.div>
  );
}
```

**AI messages** — left-aligned with gradient avatar, no bubble:

```tsx
// Assistant message
<motion.div className="flex gap-3 px-4 py-2 items-start">
  {/* Gradient avatar */}
  <div
    className="flex-shrink-0 w-6 h-6 rounded-[7px] flex items-center justify-center mt-0.5"
    style={{ background: 'linear-gradient(135deg, var(--accent-blue), #006fff)' }}
  >
    <Sparkles className="w-3 h-3" style={{ color: '#ffffff' }} />
  </div>

  {/* Content — no bubble background */}
  <div
    className={cn('flex-1 min-w-0', isStreaming && 'streaming-bubble')}
    style={{
      fontSize: '13.5px',
      lineHeight: '1.65',
      color: 'var(--text-secondary, #a0a0a0)',
    }}
  >
    {renderContent(content)}
    {isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
  </div>
</motion.div>
```

#### V2 Design System Changes

Per the PRD, v2 messages should use:
- **User bubble**: right-aligned, max-width 85% (currently 88%), `--bg-hover` bg, `14px 14px 4px 14px` border-radius
- **AI message**: left-aligned with **24px** gradient avatar (`--accent-blue` to `#006fff`), no bubble, `--text-secondary` body
- **Avatar radius**: `rounded-[7px]` (existing) — matches 24px circle in PRD

The existing v1 patterns are very close to v2 spec. Primary changes:
- Avatar size: 24px (w-6 h-6) matches spec exactly (existing is already 24px)
- Max-width: change from 88% to 85%

#### Markdown Rendering

The existing `MessageBubble` has a custom markdown renderer (`renderContent()`) that handles:
- Headers (`#`, `##`, `###`)
- Bold (`**text**`)
- Inline code (`` `code` ``)
- Code blocks with language (` ```lang `)
- Bullet lists (`-` or `*`)
- Numbered lists (`1.`)
- Links (`[text](url)`)
- Citation subscripts (`[1]`, `[2]`)

This is a **custom implementation** (not react-markdown). For v2, we can reuse this directly or simplify for Sprint 1 (since journey chat doesn't need citations or code blocks initially).

#### Scroll-to-Bottom Behavior

Existing pattern in `agent-chat.tsx`:

```tsx
const messagesEndRef = useRef<HTMLDivElement>(null);

// Auto-scroll on new messages or status change
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages, status]);

// In JSX:
<div className="flex-1 overflow-y-auto py-4 px-0 chat-messages-scroll">
  {/* ... messages ... */}
  <div ref={messagesEndRef} />
</div>
```

The CSS class `chat-messages-scroll` from globals.css adds smooth scroll behavior:

```css
.chat-messages-scroll {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
```

**For v2**: Same pattern works. Consider adding a "scroll to bottom" button that appears when user scrolls up (not in Sprint 1 scope but worth noting).

---

## 3. Auto-Resize Textarea Patterns

### Existing Implementation (chat-input.tsx)

Located at `/src/components/chat/chat-input.tsx`:

```tsx
// Auto-resize textarea: min 20px (1 row), max 100px (~5 rows)
const autoResize = useCallback(() => {
  const el = inputRef.current;
  if (!el) return;
  el.style.height = 'auto';                         // Reset to recalculate
  el.style.height = `${Math.min(el.scrollHeight, 100)}px`;  // Cap at max
}, []);

useEffect(() => {
  autoResize();
}, [input, autoResize]);
```

The textarea element:

```tsx
<textarea
  ref={inputRef}
  value={input}
  onChange={handleInputChange}
  onKeyDown={handleKeyDown}
  rows={1}
  className="w-full px-3 pt-2.5 pb-1 text-[13px] outline-none resize-none overflow-y-auto leading-[1.5] bg-transparent scrollbar-hide"
  style={{
    color: 'var(--text-primary)',
    minHeight: '20px',
    maxHeight: '100px',
  }}
/>
```

### V2 Required Changes

Per PRD: max-height should be **120px** (not 100px). Update:

```tsx
const autoResize = useCallback(() => {
  const el = inputRef.current;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;  // 120px per PRD
}, []);
```

And on the element:

```tsx
style={{
  minHeight: '20px',
  maxHeight: '120px',
}}
```

### Keyboard Handling

**Enter** = submit, **Shift+Enter** = newline:

```tsx
const handleKeyDown = useCallback(
  (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  },
  [handleSubmit]
);
```

After submit, reset height:

```tsx
requestAnimationFrame(() => {
  const el = inputRef.current;
  if (el) {
    el.style.height = 'auto';
    el.style.height = '20px';
  }
});
```

---

## 4. Glassmorphism Input Styling

### Existing Pattern

The v1 `chat-input.tsx` uses a form container with dynamic border/shadow:

```tsx
<form
  onSubmit={handleSubmit}
  style={{
    borderRadius: '12px',
    background: 'var(--bg-input)',             // #0e1017
    border: `1px solid ${borderColor}`,
    boxShadow,
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    overflow: 'hidden',
  }}
>
```

Where borderColor and boxShadow are dynamic:

```tsx
const borderColor = isFocused
  ? 'var(--border-focus, #4d6fff)'
  : 'var(--border-default)';

const boxShadow = isFocused
  ? '0 0 24px rgba(77,111,255,0.12)'
  : 'none';
```

### V2 Glassmorphism Design — Full Spec

The v2 design system calls for a glassmorphism input with **focus glow** (double ring). Here is the implementation pattern using the design tokens:

#### CSS Variables Used

```css
--bg-input: #0e1017;              /* Input field background */
--border-default: rgb(31, 31, 31);
--border-focus: rgb(54, 94, 255);  /* --accent-blue */
--accent-blue: rgb(54, 94, 255);
--accent-blue-glow: rgba(54, 94, 255, 0.15);
```

#### Glassmorphism Container (v2 spec)

```tsx
<div
  className="relative"
  style={{
    borderRadius: '14px',
    // Glassmorphism: translucent background + backdrop blur
    background: 'rgba(14, 16, 23, 0.85)',  // --bg-input at 85% opacity
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: `1px solid ${isFocused ? 'var(--border-focus)' : 'var(--border-default)'}`,
    // Double-ring glow on focus
    boxShadow: isFocused
      ? '0 0 0 1px rgba(54, 94, 255, 0.3), 0 0 24px rgba(54, 94, 255, 0.15), 0 0 48px rgba(54, 94, 255, 0.05)'
      : '0 0 0 0 transparent',
    transition: 'border-color 0.2s ease, box-shadow 0.3s ease',
  }}
>
```

#### Tailwind v4 Approach

In Tailwind v4, glassmorphism can be done with utility classes, but the dynamic focus glow requires inline styles or CSS classes. Recommended hybrid approach:

```tsx
// Base container classes (Tailwind v4)
className={cn(
  'rounded-[14px] backdrop-blur-[16px] overflow-hidden transition-all duration-200',
  isFocused && 'border-[var(--border-focus)]'
)}

// Dynamic styles still needed for glow
style={{
  background: 'rgba(14, 16, 23, 0.85)',
  border: `1px solid ${isFocused ? 'var(--border-focus)' : 'var(--border-default)'}`,
  boxShadow: isFocused
    ? '0 0 0 1px rgba(54, 94, 255, 0.3), 0 0 24px rgba(54, 94, 255, 0.15), 0 0 48px rgba(54, 94, 255, 0.05)'
    : 'none',
}}
```

#### CSS-Only Alternative (globals.css)

For better performance and reusability, define as a CSS class outside any `@layer` (to beat Tailwind v4 specificity):

```css
/* Glassmorphism input container — MUST be unlayered */
.glass-input {
  border-radius: 14px;
  background: rgba(14, 16, 23, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-default);
  transition: border-color 0.2s ease, box-shadow 0.3s ease;
}

.glass-input:focus-within {
  border-color: var(--border-focus) !important;
  box-shadow:
    0 0 0 1px rgba(54, 94, 255, 0.3),
    0 0 24px rgba(54, 94, 255, 0.15),
    0 0 48px rgba(54, 94, 255, 0.05) !important;
}
```

This CSS-only approach is cleaner: no need to track `isFocused` state — `:focus-within` handles it.

#### Send Button with Blue Glow

```tsx
<button
  type="submit"
  disabled={!canSend}
  style={{
    background: canSend ? 'var(--accent-blue)' : 'transparent',
    color: canSend ? '#ffffff' : 'var(--text-quaternary)',
    boxShadow: canSend ? '0 0 12px rgba(54, 94, 255, 0.4)' : 'none',
    borderRadius: '8px',
    width: '28px',
    height: '28px',
    transition: 'all 0.15s ease',
  }}
>
  <Send size={14} />
</button>
```

#### Gradient Fade-In Above Input

The existing v1 already implements this:

```tsx
{/* Gradient fade above the input */}
<div
  aria-hidden
  style={{
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    height: '48px',
    background: 'linear-gradient(180deg, transparent, var(--bg-chat) 30%)',
    pointerEvents: 'none',
    zIndex: 1,
  }}
/>
```

For v2, when input is fixed at bottom:

```tsx
{/* Fixed input area at bottom of chat panel */}
<div
  className="sticky bottom-0 px-4 pb-4 pt-2"
  style={{ background: 'transparent' }}
>
  {/* Gradient fade */}
  <div
    aria-hidden
    className="absolute bottom-full left-0 right-0 h-12 pointer-events-none"
    style={{
      background: 'linear-gradient(to bottom, transparent, var(--bg-base))',
    }}
  />
  {/* Glassmorphism input */}
  <div className="glass-input">
    {/* textarea + send button */}
  </div>
</div>
```

---

## 5. Streaming Cursor Implementation

### Existing CSS (globals.css)

Already implemented at `/src/app/globals.css` lines 988-1054:

```css
@keyframes streaming-cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  margin-left: 1px;
  vertical-align: text-bottom;
  background: var(--accent-blue, rgb(54, 94, 255));
  border-radius: 1px;
  animation: streaming-cursor-blink 0.8s step-end infinite;
}
```

### PRD Spec Match

The PRD specifies:
- Inline block: 2px wide, 14px tall -- **matches existing**
- Color: `--accent-blue` -- **matches existing**
- Blink animation: step-end 0.8s infinite -- **matches existing**

### How It Positions at End of Streaming Text

In the `MessageBubble` component:

```tsx
{renderContent(content)}
{isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
```

Since the cursor is `display: inline-block` placed immediately after the text content inside a flex-1 div, it naturally flows to the end of the last line of text. The `vertical-align: text-bottom` aligns it with the text baseline.

### When to Show/Hide

Logic in `agent-chat.tsx`:

```tsx
// isLastAssistant is true when:
// 1. message.role === 'assistant'
// 2. It's the last message in the array
// 3. status === 'streaming'
const isLastAssistant =
  message.role === 'assistant' &&
  msgIndex === messages.length - 1 &&
  isStreaming;

// Passed to renderMessageParts which passes to MessageBubble
```

The cursor ONLY shows during active streaming on the last assistant message. Once `status` changes to `'ready'`, `isStreaming` becomes false and the cursor disappears.

### Additional Streaming Effects

The existing CSS also includes a subtle glow on the streaming message:

```css
.streaming-bubble {
  position: relative;
}

.streaming-bubble::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  opacity: 0;
  pointer-events: none;
  background: linear-gradient(
    135deg,
    rgba(54, 94, 255, 0.06) 0%,
    transparent 50%,
    rgba(54, 94, 255, 0.03) 100%
  );
  animation: streaming-bubble-glow 2s ease-in-out infinite;
}

@keyframes streaming-bubble-glow {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
```

### V2 Implementation

The existing CSS and rendering logic are already perfect for v2. Can be reused as-is. For the new journey component, create a simplified extraction:

```tsx
// In journey/chat-message.tsx
interface JourneyChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function JourneyChatMessage({ role, content, isStreaming }: JourneyChatMessageProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end px-4 py-2">
        <div
          className="max-w-[85%] px-3.5 py-2.5"
          style={{
            background: 'var(--bg-hover)',
            border: '1px solid var(--border-default)',
            borderRadius: '14px 14px 4px 14px',
            color: 'var(--text-primary)',
            fontSize: '14px',
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-4 py-2 items-start">
      {/* 24px gradient avatar */}
      <div
        className="flex-shrink-0 w-6 h-6 rounded-[7px] flex items-center justify-center mt-0.5"
        style={{ background: 'linear-gradient(135deg, var(--accent-blue), #006fff)' }}
      >
        {/* Icon here */}
      </div>
      <div
        className={cn('flex-1 min-w-0', isStreaming && 'streaming-bubble')}
        style={{
          fontSize: '14px',
          lineHeight: '1.65',
          color: 'var(--text-secondary)',
        }}
      >
        {content}
        {isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
      </div>
    </div>
  );
}
```

---

## 6. Typing Indicator Patterns

### Existing Implementation (typing-indicator.tsx)

Located at `/src/components/chat/typing-indicator.tsx`:

```tsx
export function TypingIndicator() {
  return (
    <div className="flex gap-3 px-5 py-2">
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: 'var(--bg-surface, #101010)' }}
      >
        <Bot className="w-4 h-4" style={{ color: 'var(--text-tertiary, #666666)' }} />
      </div>

      {/* Bubble with typing dots */}
      <div
        className="px-4 py-3"
        style={{
          background: 'var(--bg-card, #0d0d0d)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          borderRadius: '16px 16px 16px 4px',
        }}
      >
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--text-tertiary, #666666)' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### PRD Spec Comparison

PRD specifies:
- 3 dots: 5px circles, bouncing animation
- Staggered delay: 0s, 0.15s, 0.3s

The existing implementation uses:
- 3 dots: 6px circles (`w-1.5 h-1.5`), **opacity** animation (not bounce)
- Staggered delay: 0s, 0.2s, 0.4s

### V2 Implementation — Bounce Animation

For the v2 spec, change from opacity fade to vertical bounce:

```tsx
export function TypingIndicator() {
  return (
    <div className="flex gap-3 px-4 py-2 items-start">
      {/* 24px gradient avatar (matching AI message avatar) */}
      <div
        className="flex-shrink-0 w-6 h-6 rounded-[7px] flex items-center justify-center mt-0.5"
        style={{ background: 'linear-gradient(135deg, var(--accent-blue), #006fff)' }}
      >
        {/* Sparkles icon or similar */}
      </div>

      {/* Dots container */}
      <div className="flex items-center gap-1 py-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -4, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,       // 0s, 0.15s, 0.3s per PRD
              ease: 'easeInOut',
            }}
            className="rounded-full"
            style={{
              width: '5px',           // 5px per PRD
              height: '5px',
              background: 'var(--text-tertiary)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

#### CSS-Only Alternative (no framer-motion dependency)

If we want to avoid framer-motion for this small component:

```css
/* Typing indicator bounce animation — MUST be unlayered */
@keyframes typing-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.typing-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-tertiary);
  animation: typing-bounce 0.6s ease-in-out infinite;
}

.typing-dot:nth-child(2) { animation-delay: 0.15s; }
.typing-dot:nth-child(3) { animation-delay: 0.3s; }
```

```tsx
export function TypingIndicator() {
  return (
    <div className="flex gap-3 px-4 py-2 items-start">
      <div
        className="flex-shrink-0 w-6 h-6 rounded-[7px] flex items-center justify-center mt-0.5"
        style={{ background: 'linear-gradient(135deg, var(--accent-blue), #006fff)' }}
      />
      <div className="flex items-center gap-1 py-2">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}
```

### When to Show

Existing logic in `agent-chat.tsx`:

```tsx
{/* Typing indicator — only before first text token arrives */}
{(isSubmitted || (isStreaming && !messages.some(
  (m, i) => m.role === 'assistant' && i === messages.length - 1 &&
    m.parts.some(p => p.type === 'text' && p.text.length > 0)
))) && <TypingIndicator />}
```

This shows the typing indicator:
1. When `status === 'submitted'` (request sent, no response yet)
2. When `status === 'streaming'` BUT the last assistant message has no text content yet (tool calls may be in progress)

For v2 Sprint 1 (no tools), simplify to:

```tsx
{status === 'submitted' && <TypingIndicator />}
```

---

## 7. Step Indicator Component

### PRD Spec

From the PRD Section 2.2:
- App header with step indicators (Setup -> Generate -> Review -> Done)
- 56px height, `--bg-elevated` background, `--border-default` bottom border
- Step indicators: 24px circle with number, active = blue fill, done = green fill + checkmark

### Implementation Pattern

```tsx
interface Step {
  label: string;
  number: number;
}

const JOURNEY_STEPS: Step[] = [
  { label: 'Setup', number: 1 },
  { label: 'Generate', number: 2 },
  { label: 'Review', number: 3 },
  { label: 'Done', number: 4 },
];

type StepStatus = 'pending' | 'active' | 'completed';

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;  // 1-based index
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  const getStatus = (stepNumber: number): StepStatus => {
    if (stepNumber < currentStep) return 'completed';
    if (stepNumber === currentStep) return 'active';
    return 'pending';
  };

  return (
    <div className="flex items-center gap-3">
      {steps.map((step, index) => {
        const status = getStatus(step.number);
        return (
          <div key={step.number} className="flex items-center gap-3">
            {/* Step circle + label */}
            <div className="flex items-center gap-2">
              <StepCircle number={step.number} status={status} />
              <span
                className="text-xs font-medium"
                style={{
                  color: status === 'active'
                    ? 'var(--text-primary)'
                    : status === 'completed'
                      ? 'var(--accent-green)'
                      : 'var(--text-tertiary)',
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line between steps */}
            {index < steps.length - 1 && (
              <div
                className="w-6 h-px"
                style={{
                  background: step.number < currentStep
                    ? 'var(--accent-green)'  // completed connector
                    : 'var(--border-default)', // pending connector
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

### Step Circle Component

```tsx
import { Check } from 'lucide-react';

interface StepCircleProps {
  number: number;
  status: StepStatus;
}

function StepCircle({ number, status }: StepCircleProps) {
  // Dimensions: 24px circle per PRD
  const size = 24;

  // Colors by status
  const styles: Record<StepStatus, { bg: string; border: string; text: string }> = {
    active: {
      bg: 'var(--accent-blue)',          // Blue fill for active
      border: 'var(--accent-blue)',
      text: '#ffffff',
    },
    completed: {
      bg: 'var(--accent-green)',         // Green fill for done
      border: 'var(--accent-green)',
      text: '#ffffff',
    },
    pending: {
      bg: 'transparent',                 // No fill for pending
      border: 'var(--border-default)',
      text: 'var(--text-tertiary)',
    },
  };

  const s = styles[status];

  return (
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: s.bg,
        border: `1.5px solid ${s.border}`,
        transition: 'all 0.3s ease',
      }}
    >
      {status === 'completed' ? (
        <Check size={12} style={{ color: s.text }} strokeWidth={3} />
      ) : (
        <span
          className="text-[11px] font-semibold leading-none"
          style={{ color: s.text }}
        >
          {number}
        </span>
      )}
    </div>
  );
}
```

### Full Header Assembly

```tsx
export function JourneyHeader({ currentStep }: { currentStep: number }) {
  return (
    <header
      className="flex items-center justify-between px-6 flex-shrink-0"
      style={{
        height: '56px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      {/* Logo */}
      <div
        className="font-heading font-bold text-[15px]"
        style={{
          // Gradient text: white -> #93c5fd per PRD
          background: 'linear-gradient(90deg, #ffffff, #93c5fd)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        AI-GOS
      </div>

      {/* Step indicators */}
      <StepIndicator steps={JOURNEY_STEPS} currentStep={currentStep} />

      {/* Right side — placeholder for user avatar or settings */}
      <div className="w-[60px]" />
    </header>
  );
}
```

### Design Token Reference for Header

| Element | Token | Value |
|---------|-------|-------|
| Header height | (hardcoded) | 56px |
| Header background | `--bg-elevated` | `rgb(10, 13, 20)` |
| Bottom border | `--border-default` | `rgb(31, 31, 31)` |
| Logo font | `font-heading` (Instrument Sans) | 700 weight, 15px |
| Logo gradient | white -> `--brand-sky` | `#ffffff` -> `#93c5fd` |
| Active step circle | `--accent-blue` | `rgb(54, 94, 255)` |
| Completed step circle | `--accent-green` | `rgb(34, 197, 94)` |
| Pending step border | `--border-default` | `rgb(31, 31, 31)` |
| Step label (active) | `--text-primary` | `rgb(252, 252, 250)` |
| Step label (done) | `--accent-green` | `rgb(34, 197, 94)` |
| Step label (pending) | `--text-tertiary` | `rgb(100, 105, 115)` |
| Connector (done) | `--accent-green` | `rgb(34, 197, 94)` |
| Connector (pending) | `--border-default` | `rgb(31, 31, 31)` |

---

## 8. Adaptive Layout for /journey Page

### Phase 1: Centered Chat (Onboarding)

```tsx
// Centered column, max-width ~720px, no side panel
<div className="flex flex-col h-screen" style={{ background: 'var(--bg-base)' }}>
  <JourneyHeader currentStep={1} />
  <div className="flex-1 flex justify-center overflow-hidden">
    <div className="w-full max-w-[720px] flex flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto chat-messages-scroll">
        {/* message list */}
      </div>
      {/* Fixed input at bottom */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2">
        {/* glassmorphism input */}
      </div>
    </div>
  </div>
</div>
```

### Phase 3: Two-Column (Review) — Shell Only for Sprint 1

```tsx
<div className="flex flex-col h-screen" style={{ background: 'var(--bg-base)' }}>
  <JourneyHeader currentStep={3} />
  <div className="flex-1 flex overflow-hidden">
    {/* Chat panel — 440px */}
    <div
      className="flex-shrink-0 flex flex-col"
      style={{
        width: '440px',
        borderRight: '1px solid var(--border-default)',
        background: 'var(--bg-chat)',
        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* chat content */}
    </div>
    {/* Blueprint panel — fills remaining */}
    <div className="flex-1 overflow-hidden">
      {/* blueprint content */}
    </div>
  </div>
</div>
```

### CSS Transition Between Layouts

The transition from centered to two-column can be animated with a combination of width transition and max-width collapse:

```tsx
// Phase state
const [phase, setPhase] = useState<'onboarding' | 'review'>('onboarding');

// Container style
<div
  className="flex-shrink-0 flex flex-col mx-auto transition-all duration-500 ease-out"
  style={{
    width: phase === 'onboarding' ? '100%' : '440px',
    maxWidth: phase === 'onboarding' ? '720px' : '440px',
    borderRight: phase === 'review' ? '1px solid var(--border-default)' : 'none',
    background: 'var(--bg-chat)',
  }}
>
```

---

## 9. Font Configuration for V2

### Current Fonts (layout.tsx)

```tsx
const inter = Inter({ variable: '--font-inter', ... });
const instrumentSans = Instrument_Sans({ variable: '--font-instrument-sans', ... });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', ... });
```

### V2 Required Fonts (PRD Section 2.3)

- **DM Sans** (sans) -- 300, 400, 500, 600 -- body text
- **Instrument Sans** (display) -- 400, 500, 600, 700 -- headings (already loaded)
- **JetBrains Mono** (mono) -- 400, 500 -- code/data

### Changes Needed

Replace `Inter` with `DM_Sans` and `Geist_Mono` with `JetBrains_Mono`:

```tsx
import { DM_Sans, Instrument_Sans, JetBrains_Mono } from 'next/font/google';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600'],
});

const instrumentSans = Instrument_Sans({
  variable: '--font-instrument-sans',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
});
```

Update `@theme` in globals.css:

```css
@theme inline {
  --font-sans: var(--font-dm-sans), 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-heading: var(--font-instrument-sans), 'Instrument Sans', sans-serif;
  --font-display: var(--font-instrument-sans), 'Instrument Sans', sans-serif;
  --font-mono: var(--font-jetbrains-mono), 'JetBrains Mono', monospace;
}
```

**IMPORTANT**: The font changes affect the ENTIRE app (v1 + v2). This must be done carefully. Options:
1. **Global change** (simpler): Replace Inter with DM Sans everywhere. Both are similar enough.
2. **Scoped to /journey** (safer): Only load DM Sans and JetBrains Mono in the journey layout, not globally.

Recommendation: Option 2 for Sprint 1 (scope to journey route group), migrate globally later.

---

## 10. Complete Design Token Quick Reference

All tokens from the design system that the chat UI components will use:

### Backgrounds

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `rgb(7, 9, 14)` | Main page background |
| `--bg-elevated` | `rgb(10, 13, 20)` | Header, elevated surfaces |
| `--bg-surface` | `rgb(12, 14, 19)` | Component backgrounds |
| `--bg-chat` | `#090b10` | Chat panel background |
| `--bg-input` | `#0e1017` | Input field background |
| `--bg-hover` | `rgb(20, 23, 30)` | User message bubble bg |
| `--bg-active` | `rgb(25, 28, 35)` | Pressed states |
| `--bg-card` | `rgb(12, 14, 19)` | Card surfaces |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `rgb(252, 252, 250)` | Headings, user text |
| `--text-secondary` | `rgb(205, 208, 213)` | AI message body |
| `--text-tertiary` | `rgb(100, 105, 115)` | Labels, step labels |
| `--text-quaternary` | `rgb(49, 53, 63)` | Muted (nearly invisible on dark, avoid) |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | Light dividers |
| `--border-default` | `rgb(31, 31, 31)` | Standard borders |
| `--border-hover` | `rgb(45, 45, 50)` | Hover state borders |
| `--border-focus` | `rgb(54, 94, 255)` | Focus ring (matches accent-blue) |

### Accents

| Token | Value | Usage |
|-------|-------|-------|
| `--accent-blue` | `rgb(54, 94, 255)` | Active step, cursor, buttons |
| `--accent-blue-hover` | `rgb(0, 111, 255)` | Button hover |
| `--accent-blue-glow` | `rgba(54, 94, 255, 0.15)` | Focus glow |
| `--accent-green` | `rgb(34, 197, 94)` | Completed step |
| `--accent-amber` | `rgb(245, 158, 11)` | Warning states |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.02)` | Card elevation |
| `--shadow-elevated` | `0 4px 16px rgba(0,0,0,0.5)` | Elevated panels |
| `--shadow-glow` | `0 0 20px oklch(0.62 0.19 255 / 0.2)` | Blue glow |

---

## 11. Key Files to Create for Sprint 1

Based on this research, the implementer should create:

1. **`src/components/journey/chat-message.tsx`** -- User bubble + AI message (simplified from v1 MessageBubble)
2. **`src/components/journey/chat-input.tsx`** -- Glassmorphism input with auto-resize textarea
3. **`src/components/journey/streaming-cursor.tsx`** -- Can be CSS-only (already in globals.css)
4. **`src/components/journey/typing-indicator.tsx`** -- 3-dot bounce animation
5. **`src/components/journey/step-indicator.tsx`** -- Horizontal stepper with numbered circles
6. **`src/components/journey/journey-header.tsx`** -- 56px header with logo + step indicators
7. **`src/app/journey/page.tsx`** -- Page shell with adaptive layout
8. **`src/app/api/journey/stream/route.ts`** -- SSE streaming endpoint

### Key Files to Modify

1. **`src/app/globals.css`** -- Add `.glass-input`, `.typing-dot`, possibly v2-specific tokens
2. **`src/app/layout.tsx`** -- Potentially add DM Sans + JetBrains Mono fonts (or scope to journey route)

---

## 12. Gotchas and Warnings

1. **Transport matching is critical**: `toUIMessageStreamResponse()` on backend MUST pair with `DefaultChatTransport` on frontend. Mismatch causes raw SSE text to display.

2. **`convertToModelMessages` is async**: Must `await` it in route handlers. Forgetting `await` causes cryptic serialization errors.

3. **MissingToolResultsError**: If tool calls lack results in message history, `convertToModelMessages` throws. Sanitize messages server-side by stripping incomplete tool parts before converting.

4. **Tailwind v4 specificity**: Styles inside `@layer utilities` lose to unlayered component CSS. Any dynamic hover/focus styles that must override Tailwind should be placed OUTSIDE `@layer` with `!important`. See existing patterns like `.show-on-card-hover`.

5. **CSS var `--text-quaternary` is nearly invisible**: `rgb(49, 53, 63)` on dark backgrounds is unreadable. Use `--text-tertiary` as the minimum readable muted color.

6. **`experimental_useObject`**: Still experimental in `@ai-sdk/react@3.0.75`. Not graduated yet. Relevant if we need structured streaming later.

7. **Framer Motion already installed**: `framer-motion@12.26.1` is available. Use it for message animations (`motion.div` with `initial`/`animate`). But for simple CSS animations (cursor blink, typing dots), pure CSS is more performant.

8. **Font changes affect all routes**: Changing Inter to DM Sans in `layout.tsx` changes fonts globally including v1. Consider scoping to a route group layout for safety.
