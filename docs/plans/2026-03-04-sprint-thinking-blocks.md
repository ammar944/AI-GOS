# Thinking Blocks Surface Sprint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface Claude's thinking blocks visibly to users during the journey, so they watch the agent reason in real time — building trust and conveying strategic depth.

**Architecture:** The end-to-end plumbing already exists. Anthropic thinking is enabled in the route (`budgetTokens: 5000`). The AI SDK v6 streams reasoning parts automatically (`sendReasoning = true` by default). The journey `chat-message.tsx` already handles `part.type === 'reasoning'` and renders `<ThinkingBlock>`. The `ThinkingBlock` component already has `state` prop, streaming timer, and collapsible UI. The only missing behavior is: `defaultOpen` must be `true` during streaming and transition to collapsible when `state === 'done'`. Additionally, the `agent-chat.tsx` uses a legacy XML `<think>` tag parser instead of the proper SDK reasoning parts — fix that too.

**Tech Stack:** React (useState, useEffect), Framer Motion (already installed), Vercel AI SDK v6 `useChat` + `DefaultChatTransport`, `@ai-sdk/anthropic` thinking option

---

## Audit Findings (Read Before Implementing)

### What already works (do NOT change):
- `src/app/api/journey/stream/route.ts:123-126` — `thinking: { type: 'enabled', budgetTokens: 5000 }` is set.
- `src/app/api/journey/stream/route.ts:137` — `result.toUIMessageStreamResponse()` called with no options. `sendReasoning` defaults to `true` in AI SDK v6 — reasoning parts ARE streamed.
- `src/components/journey/chat-message.tsx:619-628` — `renderMessageParts()` already handles `part.type === 'reasoning'` and renders `<ThinkingBlock>` with the correct `state` mapping (`streaming` / `done`).
- `src/components/chat/thinking-block.tsx` — Full component with timer, state prop, collapsible UI via Framer Motion `AnimatePresence`. Already complete from the prior enhancement plan.

### What is broken / missing:
1. **`ThinkingBlock` collapses by default**: `defaultOpen = false` on line 17 of `thinking-block.tsx`. During streaming, the user sees a closed chevron ("Thinking for 2.3s") with no visible content. The vision requires content visible while streaming, collapsible when done.
2. **`defaultOpen` is static**: The `isOpen` state is seeded from `defaultOpen` once on mount. When `state` transitions from `streaming` to `done`, the component should auto-close (allowing users to focus on the agent's response text) unless the user manually opened it.
3. **`agent-chat.tsx` uses legacy XML parsing**: Lines ~78-88 parse `<think>...</think>` tags from raw text instead of using SDK reasoning parts. This is the blueprint chat agent (not the journey) — it still needs updating for consistency, but lower priority.

### AI SDK v6 reasoning part shape (confirmed from source):
```typescript
// During streaming: state.activeReasoningParts[id] = { type: 'reasoning', text: '', state: 'streaming' }
// After complete:   reasoningPart.state = 'done'
// Shape in message.parts:
{ type: 'reasoning', text: string, state: 'streaming' | 'done' }
```
The `isReasoningUIPart(part)` export from `'ai'` checks `part.type === 'reasoning'`.

---

## Task 1: Fix ThinkingBlock Auto-Open/Auto-Close Behavior

**Files:**
- Modify: `src/components/chat/thinking-block.tsx`

The `ThinkingBlock` needs to:
- Open automatically when `state === 'streaming'` (so user sees reasoning as it arrives)
- Auto-close when `state` transitions to `'done'` (focus shifts to the response below)
- Respect manual user toggle: if the user manually closes while streaming, don't fight them; if they open while done, keep it open

**Step 1: Add an effect to sync `isOpen` with `state`**

Current code at line 18: `const [isOpen, setIsOpen] = useState(defaultOpen);`

The fix: initialize `isOpen` from state (open if streaming, closed if done/undefined), then add an effect that auto-closes when streaming ends — but only if the user hasn't manually toggled.

Replace the current `ThinkingBlock` function body's state initialization and effect block:

```typescript
export function ThinkingBlock({
  content,
  state,
  defaultOpen = false,
}: ThinkingBlockProps) {
  // Auto-open while streaming, auto-close when done (unless user toggled)
  const userToggledRef = useRef(false);
  const [isOpen, setIsOpen] = useState(() => state === 'streaming' || defaultOpen);

  // Self-managed timer: starts on mount, ticks while streaming, freezes when done
  const startTimeRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (state !== 'streaming') return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 100);
    return () => clearInterval(interval);
  }, [state]);

  // Auto-open when streaming starts (e.g. if mounted in done state then state changes)
  useEffect(() => {
    if (state === 'streaming' && !userToggledRef.current) {
      setIsOpen(true);
    }
  }, [state]);

  // Auto-close when streaming ends — only if user hasn't manually interacted
  useEffect(() => {
    if (state === 'done' && !userToggledRef.current) {
      setIsOpen(false);
    }
  }, [state]);
```

**Step 2: Update the toggle button handler to set `userToggledRef`**

Find the `onClick` handler on the toggle button (currently `onClick={() => setIsOpen((prev) => !prev)}`) and update it:

```typescript
onClick={() => {
  userToggledRef.current = true;
  setIsOpen((prev) => !prev);
}}
```

**Step 3: Verify timer label logic is correct**

The current label logic at lines 37-45 is already correct:
```typescript
const label = (() => {
  if (state === 'streaming') {
    return `Thinking for ${(elapsed / 1000).toFixed(1)}s`;
  }
  if (state === 'done') {
    return `Thought for ${(elapsed / 1000).toFixed(1)}s`;
  }
  return 'Thinking';
})();
```
No changes needed here.

**Step 4: Commit**

```bash
git commit -m "feat: auto-open ThinkingBlock during streaming, auto-close when done"
```

---

## Task 2: Verify Reasoning Parts Reach the Frontend

**Files:**
- Read: `src/app/api/journey/stream/route.ts` (no changes needed — confirmed working)
- Read: `src/components/journey/chat-message.tsx:609-645` (no changes needed — confirmed working)

This task is a manual verification step. No code changes are required. The AI SDK streams reasoning parts by default. The `renderMessageParts` function in `chat-message.tsx` already handles them.

**Step 1: Confirm the reasoning part type check**

In `src/components/journey/chat-message.tsx` at line 619, verify this block exists:
```typescript
// Reasoning/thinking parts
if (part.type === 'reasoning') {
  flushText(`${messageId}-text-before-reasoning-${i}`);
  elements.push(
    <ThinkingBlock
      key={`${messageId}-thinking-${i}`}
      content={(part.text as string) || ''}
      state={(() => { const s = (part as { state?: string }).state; return s === 'streaming' || s === 'done' ? s : undefined; })()}
    />
  );
  continue;
}
```

If this block is present and unchanged, Task 2 is complete with no edits.

**Step 2: Confirm `toUIMessageStreamResponse()` does not need options**

In `src/app/api/journey/stream/route.ts` line 137:
```typescript
return result.toUIMessageStreamResponse();
```
No `sendReasoning: false` is set. The default is `true`. This is correct — no change needed.

---

## Task 3: Update ThinkingBlock `defaultOpen` Prop in Journey ChatMessage

**Files:**
- Modify: `src/components/journey/chat-message.tsx:619-628`

Currently, `ThinkingBlock` is rendered with no `defaultOpen` prop, so it defaults to `false`. After Task 1, the component handles auto-open via the `state` prop — so this is a cleanup task that removes the redundant pattern and makes intent explicit.

**Step 1: Update the ThinkingBlock render call to remove ambiguity**

The current render at lines 621-627:
```typescript
elements.push(
  <ThinkingBlock
    key={`${messageId}-thinking-${i}`}
    content={(part.text as string) || ''}
    state={(() => { const s = (part as { state?: string }).state; return s === 'streaming' || s === 'done' ? s : undefined; })()}
  />
);
```

No change is needed here since `defaultOpen` defaults to `false` and the auto-open is now driven by `state` in Task 1. This task is a verification step only.

However, clean up the inline IIFE for readability. Replace the render call with:

```typescript
const thinkingState = (part as { state?: string }).state;
const normalizedState = thinkingState === 'streaming' || thinkingState === 'done'
  ? thinkingState
  : undefined;

elements.push(
  <ThinkingBlock
    key={`${messageId}-thinking-${i}`}
    content={(part.text as string) || ''}
    state={normalizedState}
  />
);
```

**Step 2: Commit**

```bash
git commit -m "refactor: clean up ThinkingBlock state normalization in chat-message.tsx"
```

---

## Task 4: Fix Legacy XML Thinking Parser in agent-chat.tsx

**Files:**
- Modify: `src/components/chat/agent-chat.tsx`

The `agent-chat.tsx` uses a `parseThinkingBlocks()` function that parses `<think>...</think>` XML tags from raw text (lines ~75-88). This is the blueprint chat agent (separate from the journey). It should use SDK reasoning parts for consistency.

**Step 1: Locate the parseThinkingBlocks usage**

In `agent-chat.tsx` around line 538, the text accumulator is passed through `parseThinkingBlocks()`. The blueprint agent uses the same `useChat` hook — reasoning parts should appear in `message.parts` as `{ type: 'reasoning' }` already.

**Step 2: Identify whether agent-chat.tsx renders message parts or raw content**

Read `src/components/chat/agent-chat.tsx` starting at the message rendering section (~line 530). Check if it iterates `message.parts` or uses `message.content`.

If it iterates `message.parts` and still calls `parseThinkingBlocks`, add a `type === 'reasoning'` guard before the text accumulator reaches `parseThinkingBlocks`:

```typescript
// Reasoning parts — render directly, do not accumulate as text
if (part.type === 'reasoning') {
  flushText(`${key}-text-before-reasoning`);
  elements.push(
    <ThinkingBlock
      key={`${key}-reasoning`}
      content={(part as { text?: string }).text ?? ''}
      state={(() => {
        const s = (part as { state?: string }).state;
        return s === 'streaming' || s === 'done' ? s : undefined;
      })()}
    />
  );
  continue;
}
```

Add this BEFORE the text accumulation block in the part iteration loop.

**Step 3: Keep parseThinkingBlocks as fallback**

Do NOT remove `parseThinkingBlocks`. Older messages in history may have `<think>` tags in text content. Keep it as a fallback for text parts only.

**Step 4: Commit**

```bash
git commit -m "feat: add SDK reasoning part handling to agent-chat.tsx alongside legacy XML parser"
```

---

## Task 5: Add Visual Polish — Streaming Pulse Indicator

**Files:**
- Modify: `src/components/chat/thinking-block.tsx`

While the thinking block streams, add a subtle animated pulse to the chevron indicator to visually signal active computation. This uses Framer Motion which is already imported.

**Step 1: Import `motion` from framer-motion (already imported)**

`motion` is already available — `AnimatePresence` is already imported. Add `motion` if not already destructured:

Check current import: `import { motion, AnimatePresence } from "framer-motion";`

If `motion` is already imported, no change needed.

**Step 2: Wrap the chevron icon with a pulse animation while streaming**

Replace the plain `<ChevronRight>` with a motion-wrapped version that pulses opacity when `state === 'streaming'`:

```typescript
{state === 'streaming' ? (
  <motion.span
    animate={{ opacity: [1, 0.4, 1] }}
    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    style={{ display: 'flex', alignItems: 'center' }}
  >
    <ChevronRight
      className="w-3 h-3"
      style={{
        color: "var(--accent-blue, rgb(54, 94, 255))",
        transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 0.2s ease",
      }}
    />
  </motion.span>
) : (
  <ChevronRight
    className="w-3 h-3"
    style={{
      color: "var(--text-tertiary, #666666)",
      transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
      transition: "transform 0.2s ease",
    }}
  />
)}
```

Also update the label `color` to use `--accent-blue` while streaming:

```typescript
<span
  style={{
    fontSize: "11.5px",
    color: state === 'streaming' ? "var(--accent-blue, rgb(54, 94, 255))" : "var(--text-tertiary, #666666)",
  }}
>
  {label}
</span>
```

**Step 3: Commit**

```bash
git commit -m "feat: add streaming pulse indicator to ThinkingBlock chevron"
```

---

## Task 6: Integration Test — Verify Thinking Blocks Appear in Stream

**Files:**
- Create: `src/lib/ai/__tests__/thinking-blocks-integration.test.ts` (manual verification script — not a Vitest test, run with ts-node or inspect in browser)

The fastest way to verify is a browser smoke test. The Playwright test suite can be used if available, but for this sprint, the verification is manual:

**Step 1: Manual browser verification checklist**

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:3000/journey`
3. Send a message: "I'm building a B2B SaaS tool for DevOps teams that need incident management"
4. Observe:
   - [ ] A "Thinking for X.Xs" header appears at the top of the assistant response (blue chevron, pulsing)
   - [ ] The thinking content is visible and streaming (auto-opened)
   - [ ] The timer counts up in real time (100ms intervals)
   - [ ] When the response completes, the thinking block auto-collapses to show "Thought for X.Xs"
   - [ ] The user can click to re-expand the thinking block
   - [ ] The assistant's actual response text appears below the collapsed thinking block
   - [ ] Clicking the chevron toggles open/close without breaking

**Step 2: Check browser DevTools — confirm reasoning parts in message**

In Chrome DevTools console while the stream runs:
```javascript
// After sending a message, inspect the useChat messages state via React DevTools
// Look for messages[N].parts — should contain:
// { type: 'reasoning', text: '...', state: 'done' }
// This confirms the SDK is streaming and mapping reasoning parts correctly.
```

**Step 3: Confirm no regressions**

Run the existing test suite:
```bash
npm run test:run
```

Expected: All existing tests pass. No new failures.

---

## Task 7: Build Verification

**Step 1: Run build**

```bash
npm run build
```

Expected: 0 TypeScript errors, 0 build failures.

**Step 2: Fix any type errors**

Common issues to watch for:
- `useRef` without initial value needs `useRef<boolean>(false)` not `useRef(false)` in strict TypeScript
- The `userToggledRef` must be typed: `const userToggledRef = useRef<boolean>(false);`

**Step 3: Final commit**

```bash
git commit -m "feat: surface thinking blocks during journey — auto-open while streaming, auto-close when done"
```

---

## Summary of Changes

| File | Change | Why |
|------|--------|-----|
| `src/components/chat/thinking-block.tsx` | Auto-open on `state === 'streaming'`, auto-close on `state === 'done'`, pulse animation on chevron | Core UX: users see reasoning as it happens |
| `src/components/journey/chat-message.tsx` | Refactor inline IIFE to named variable for readability | Cleanup — no behavior change |
| `src/components/chat/agent-chat.tsx` | Add `part.type === 'reasoning'` handler before text accumulator | Blueprint agent also gets proper reasoning part rendering |

**Files NOT changed:**
- `src/app/api/journey/stream/route.ts` — Thinking is already enabled, `sendReasoning` defaults to `true`
- `src/app/journey/page.tsx` — `message.parts` is already passed to `ChatMessage`, no changes needed
- `src/lib/ai/providers.ts` — Model config is already correct

---

## Key Technical Notes

### Why thinking blocks are hidden today

`ThinkingBlock` has `defaultOpen = false` (line 17, `thinking-block.tsx`). When a reasoning part arrives during streaming, the component mounts with `isOpen = false`. The user sees only a collapsed "Thinking for 2.3s" label — no content. The content IS there, just invisible. This is the entire problem.

### Why no route changes are needed

AI SDK v6 `toUIMessageStreamResponse()` has `sendReasoning = true` by default (confirmed in `node_modules/ai/dist/index.js` line 7324). The SDK emits `reasoning-start`, `reasoning-delta`, `reasoning-end` SSE chunks automatically when the Anthropic provider returns thinking blocks. The `readUIMessageStream` consumer maps these to `{ type: 'reasoning', text: string, state: 'streaming' | 'done' }` in `message.parts`. The frontend already receives them.

### Why no `useChat` changes are needed

`useChat` from `@ai-sdk/react` passes `message.parts` through unchanged. The `ChatMessage` component in `src/components/journey/chat-message.tsx` receives `parts={message.parts}` from `src/app/journey/page.tsx:333`. The `renderMessageParts` function iterates parts and the `type === 'reasoning'` branch is already present at line 619.

### The `userToggledRef` pattern

Using a ref (not state) to track manual user interaction avoids re-renders and breaks the auto-open/auto-close feedback loop. The flow:
1. Component mounts with `state === 'streaming'` → `isOpen = true` (effect runs)
2. User clicks to close → `userToggledRef.current = true`, `isOpen = false`
3. `state` changes to `'done'` → effect fires but `userToggledRef.current === true` → skip auto-close
4. Result: user's manual preference wins over automation

If user did NOT touch the toggle:
1. Component mounts with `state === 'streaming'` → `isOpen = true`
2. `state` changes to `'done'` → `userToggledRef.current === false` → auto-close fires → `isOpen = false`
3. Result: thinking block collapses cleanly when the response arrives
