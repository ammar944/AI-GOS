# Research: Thinking Block Streaming & Enhancement

**Date**: 2026-02-27
**Task**: Thinking Block Enhancement (PRD Section 2.5)
**Scope**: Adaptive thinking, reasoning part streaming, timer, collapsible UI, design tokens

---

## 1. Adaptive Thinking with Claude Opus 4.6

### What is Adaptive Thinking?

Adaptive thinking (`thinking: { type: 'adaptive' }`) is the **recommended** mode for Claude Opus 4.6 and Sonnet 4.6. Instead of a fixed `budgetTokens`, Claude dynamically determines when and how much to think based on query complexity.

- At default effort level (`high`), Claude **almost always thinks**
- At lower effort levels (`medium`, `low`), Claude may skip thinking for simple queries
- `thinking: { type: 'enabled', budgetTokens: N }` is **deprecated** on Opus 4.6
- Adaptive thinking automatically enables **interleaved thinking** (thinking between tool calls)

### Current Route Configuration

```typescript
// src/app/api/journey/stream/route.ts (lines 66-78)
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
```

**Status**: Config is correct (`adaptive`). However, no explicit `sendReasoning: true` is passed to `toUIMessageStreamResponse()` — but this is fine because **`sendReasoning` defaults to `true`** (verified in AI SDK source: `sendReasoning = true` at `node_modules/ai/dist/index.mjs:7245`).

### Effort Levels (optional tuning)

| Level    | Behavior                                          |
|----------|---------------------------------------------------|
| `max`    | Always thinks, no depth constraints (Opus 4.6 only) |
| `high`   | Default. Always thinks. Deep reasoning.           |
| `medium` | Moderate thinking. May skip for simple queries.   |
| `low`    | Minimal thinking. Skips for simple tasks.         |

To set effort, add to providerOptions:
```typescript
providerOptions: {
  anthropic: {
    thinking: { type: 'adaptive' },
    // effort is set via output_config, not providerOptions
  },
},
```
Note: The `effort` parameter is set at the Anthropic API level via `output_config.effort`, not directly through the AI SDK providerOptions. For default `high` effort, no change is needed.

---

## 2. How Reasoning Parts Stream in Vercel AI SDK

### Server-Side: SSE Stream Protocol

The AI SDK uses a **start/delta/end** pattern for reasoning blocks, identical to how text parts stream:

```
event: reasoning-start
data: {"type":"reasoning-start","id":"reasoning_abc123","providerMetadata":{...}}

event: reasoning-delta
data: {"type":"reasoning-delta","id":"reasoning_abc123","delta":"Let me analyze..."}

event: reasoning-delta
data: {"type":"reasoning-delta","id":"reasoning_abc123","delta":" the business model"}

event: reasoning-end
data: {"type":"reasoning-end","id":"reasoning_abc123","providerMetadata":{...}}
```

Key observations:
- Each reasoning block gets a unique `id` (e.g., `"reasoning_abc123"`)
- Deltas stream **incrementally** (token by token, like text)
- Multiple reasoning blocks can appear (interleaved thinking between tool calls)

### Client-Side: `ReasoningUIPart` in `message.parts`

```typescript
// node_modules/ai/dist/index.d.ts:1350-1364
type ReasoningUIPart = {
  type: 'reasoning';
  text: string;              // Accumulated reasoning text (grows during streaming)
  state?: 'streaming' | 'done';  // Streaming lifecycle state
  providerMetadata?: ProviderMetadata;
};
```

**Streaming lifecycle**:
1. `reasoning-start` SSE event → creates a new `ReasoningUIPart` with `{ type: 'reasoning', text: '', state: 'streaming' }` and pushes it to `message.parts`
2. `reasoning-delta` SSE events → appends `chunk.delta` to the existing part's `text` property (mutates in place)
3. `reasoning-end` SSE event → sets `state` to `'done'`, removes from active tracking

**Critical detail**: The `text` property on the reasoning part **grows incrementally** during streaming. Each `reasoning-delta` appends to `reasoningPart.text`. The `write()` call after each delta triggers a React re-render via `useChat`, so the component **sees the text grow character by character**.

### Internal SDK Processing (verified in source)

```javascript
// node_modules/ai/dist/index.mjs:5125-5163
case "reasoning-start": {
  const reasoningPart = {
    type: "reasoning",
    text: "",
    providerMetadata: chunk.providerMetadata,
    state: "streaming"
  };
  state.activeReasoningParts[chunk.id] = reasoningPart;
  state.message.parts.push(reasoningPart);
  write();  // triggers re-render
  break;
}
case "reasoning-delta": {
  const reasoningPart = state.activeReasoningParts[chunk.id];
  reasoningPart.text += chunk.delta;  // incremental append
  write();  // triggers re-render
  break;
}
case "reasoning-end": {
  const reasoningPart = state.activeReasoningParts[chunk.id];
  reasoningPart.state = "done";
  delete state.activeReasoningParts[chunk.id];
  write();  // triggers re-render
  break;
}
```

### Helper Function

```typescript
import { isReasoningUIPart } from 'ai';
// or just check: part.type === 'reasoning'
```

---

## 3. Calculating Thinking Duration

### No Server-Side Duration

Neither the Anthropic API nor the Vercel AI SDK provides a `durationMs` field on reasoning parts or in stream metadata. The thinking duration must be **tracked client-side**.

### Client-Side Timer Strategy

Since `ReasoningUIPart.state` transitions from `'streaming'` to `'done'`, we can track timing with `useRef` + `useEffect`:

```typescript
// Strategy: Track when reasoning starts streaming and when it completes
const thinkingStartRef = useRef<number | null>(null);
const [thinkingDurationMs, setThinkingDurationMs] = useState<number | undefined>();

// When we detect a reasoning part with state === 'streaming', record start time
// When state changes to 'done', calculate duration
```

**Approach A — Inside ThinkingBlock component (RECOMMENDED)**:

```typescript
function ThinkingBlock({ content, state, defaultOpen }: ThinkingBlockProps) {
  const startTimeRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state === 'streaming') {
      const interval = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current);
      }, 100); // Update every 100ms for smooth display
      return () => clearInterval(interval);
    }
  }, [state]);

  // When state transitions to 'done', freeze the elapsed time
  const durationMs = state === 'done' ? elapsed : elapsed;
  const label = state === 'streaming'
    ? `Thinking for ${(elapsed / 1000).toFixed(1)}s`
    : `Thought for ${(elapsed / 1000).toFixed(1)}s`;

  // ...
}
```

**Approach B — In parent via useEffect watching parts**:

Track reasoning part state transitions in `renderMessageParts()` or the page component. Less clean because it requires lifting state.

**Recommendation**: Use **Approach A** — self-contained timer inside `ThinkingBlock`. The component receives `state` from the reasoning part and manages its own timer lifecycle. When `state === 'streaming'`, run an interval. When `state === 'done'`, stop and freeze the displayed value.

**Edge case**: If the component mounts after `state` is already `'done'` (e.g., on page reload with cached messages), we won't have timing info. In this case, show just "Thought" without a duration, or show a dash.

---

## 4. How Reasoning Parts Are Currently Rendered

### In `chat-message.tsx` (`renderMessageParts`)

```typescript
// src/components/journey/chat-message.tsx:459-468
if (part.type === 'reasoning') {
  flushText(`${messageId}-text-before-reasoning-${i}`);
  elements.push(
    <ThinkingBlock
      key={`${messageId}-thinking-${i}`}
      content={(part.text as string) || ''}
    />
  );
  continue;
}
```

**Current issues**:
1. Does NOT pass `state` (streaming vs done) — ThinkingBlock cannot differentiate
2. Does NOT pass `durationMs` — existing prop is unused
3. Does NOT pass `defaultOpen` — defaults to `false` (collapsed)

### In `thinking-block.tsx` (current implementation)

```typescript
// src/components/chat/thinking-block.tsx
interface ThinkingBlockProps {
  content: string;
  durationMs?: number;       // Unused — no one passes this
  defaultOpen?: boolean;     // Defaults to false
}
```

**What exists**:
- Collapsible toggle with `AnimatePresence` + Framer Motion height animation
- Chevron rotation animation (0deg → 90deg)
- Left border: `2px solid var(--border-default, rgba(255, 255, 255, 0.12))`
- Label: "Thinking" or "Thinking for X.Xs" (if durationMs provided)
- Italic text in `--text-tertiary`

**What needs to change** (per Design System spec):
1. **Border color**: Change from `--border-default` to `--accent-blue` (`rgb(54, 94, 255)`)
2. **Timer**: Add live timer that counts up during streaming, freezes when done
3. **Streaming display**: Show `content` as it grows (already works since React re-renders on `text` change, but currently only visible when expanded)
4. **State prop**: Accept `state: 'streaming' | 'done'` to control timer + visual indicators
5. **Auto-expand during streaming**: Consider showing content while actively thinking (collapsed after done)

---

## 5. Framer Motion Patterns for Collapsible + Streaming Content

### Current Pattern (Already Working)

The existing ThinkingBlock uses `AnimatePresence` with `height: 0` ↔ `height: "auto"`:

```tsx
<AnimatePresence initial={false}>
  {isOpen && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ overflow: "hidden" }}
    >
      {/* content */}
    </motion.div>
  )}
</AnimatePresence>
```

**This pattern is sufficient** for the enhancement. Framer Motion handles `height: "auto"` natively, and as `content` grows during streaming, the container will auto-resize.

### Potential Enhancement: `useMeasure` for Smoother Height Animation

For more precise height animations when content is growing (streaming), combine Framer Motion with `useMeasure` from `react-use`:

```tsx
import useMeasure from 'react-use-measure';

function CollapsibleContent({ isOpen, children }) {
  const [ref, { height }] = useMeasure();

  return (
    <motion.div
      animate={{ height: isOpen ? height : 0, opacity: isOpen ? 1 : 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{ overflow: "hidden" }}
    >
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}
```

**Verdict**: The current `height: "auto"` approach in `AnimatePresence` works well. The `useMeasure` approach is only needed if we see jank with rapidly growing content. Start with the simpler approach; optimize if needed.

### Motion Presets from Project

The project already defines spring presets in `src/lib/motion.ts`:
- `springs.snappy` — quick, 500 stiffness (good for toggle chevron)
- `springs.smooth` — natural, 400 stiffness (good for height animation)
- `durations.fast` = 0.15s, `durations.normal` = 0.3s

---

## 6. Design System Section 5.2 Spec

From PRD Section 2.5 and Design System reference:

| Property | Spec | Current | Action |
|----------|------|---------|--------|
| Collapsible | Yes, collapsed by default | Yes | Keep |
| Chevron toggle | Yes | Yes | Keep |
| Border-left | 2px, `--accent-blue` | 2px, `--border-default` | **CHANGE** |
| Timer | "Thinking for X.Xs" (live count) | Static (durationMs prop, unused) | **CHANGE** |
| Text style | Italic, `--text-tertiary` | Italic, `--text-tertiary` | Keep |
| Streaming | Show content as it arrives | Content shown but no streaming awareness | **CHANGE** |
| Font size | ~11.5-12.5px | Label: 11.5px, Content: 12.5px | Keep |

### CSS Variable Values

```css
--accent-blue: rgb(54, 94, 255);       /* Primary blue */
--text-tertiary: ...;                    /* Gray text for reasoning */
--border-default: rgba(255, 255, 255, 0.12);  /* Current, too subtle */
```

---

## 7. Implementation Plan

### Props Change

```typescript
interface ThinkingBlockProps {
  content: string;
  state?: 'streaming' | 'done';  // NEW: from ReasoningUIPart.state
  defaultOpen?: boolean;
}
// Remove durationMs — timer is self-managed
```

### Key Changes to `thinking-block.tsx`

1. **Accept `state` prop** from `ReasoningUIPart.state`
2. **Self-managed timer**: `useRef(Date.now())` on mount, `setInterval` every 100ms while `state === 'streaming'`, freeze on `state === 'done'`
3. **Border color**: `var(--accent-blue)` instead of `var(--border-default)`
4. **Label text**:
   - While streaming: "Thinking for X.Xs" (live count, ticking up)
   - After done: "Thought for X.Xs" (frozen)
   - No state info (historical): "Thinking" (no duration)
5. **Auto-expand while streaming** (optional UX decision — see Open Question below)

### Key Changes to `chat-message.tsx`

```typescript
// In renderMessageParts, update the reasoning handler:
if (part.type === 'reasoning') {
  flushText(`${messageId}-text-before-reasoning-${i}`);
  elements.push(
    <ThinkingBlock
      key={`${messageId}-thinking-${i}`}
      content={(part.text as string) || ''}
      state={(part as { state?: string }).state as 'streaming' | 'done' | undefined}
    />
  );
  continue;
}
```

### Key Changes to `route.ts`

None required. `sendReasoning` already defaults to `true`, and `thinking: { type: 'adaptive' }` is already configured.

---

## 8. Streaming Text Rendering Behavior

Since the AI SDK mutates `reasoningPart.text` in place (appending deltas) and calls `write()` after each delta, the `useChat` hook triggers a React re-render on every delta. This means:

- The `content` prop passed to `ThinkingBlock` **automatically grows** character by character
- No special streaming text rendering is needed (no typewriter effect, no manual character-by-character logic)
- React's re-render cycle handles showing new content as it arrives
- The text will appear incrementally in the collapsible panel as long as the panel is open

**Important**: If the panel is collapsed during streaming, the text still accumulates. When the user expands it, they see all accumulated text at once. This is acceptable behavior.

---

## 9. Open Questions for Implementation

1. **Auto-expand during streaming?** Should the thinking block automatically be open while `state === 'streaming'` and collapse after `state === 'done'`? This would give users a live view of reasoning, then auto-collapse to save space. The Design System says "collapsed by default" but doesn't address streaming state.
   - **Recommendation**: Keep collapsed by default. Users who want to see thinking can expand. Auto-expanding could be jarring.

2. **Multiple reasoning blocks?** With interleaved thinking (adaptive mode), Claude can produce multiple reasoning blocks in a single message (one before each tool call). Each will appear as a separate `ReasoningUIPart` in `message.parts`. The current implementation handles this correctly since it loops over all parts.

3. **Historical messages**: When a message is loaded from history (not streaming), `state` will be `'done'` or `undefined`. The timer should show nothing (no duration) in this case since we don't persist timing data.

4. **Summarized thinking**: Claude Opus 4.6 returns **summarized** thinking (not full thinking output). The summarized text is shorter and provides key reasoning steps. This is fine for display — no special handling needed.

---

## 10. Sources

- [Anthropic Adaptive Thinking Docs](https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking)
- [Anthropic Extended Thinking Docs](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking)
- [Vercel AI SDK Anthropic Provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)
- [Vercel AI SDK Claude 4 Guide](https://ai-sdk.dev/cookbook/guides/claude-4)
- [Vercel AI SDK Chatbot Reasoning](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)
- [Vercel AI SDK Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
- [AI SDK GitHub Issue #9077 — Reasoning parts missing id field](https://github.com/vercel/ai/issues/9077)
- [Framer Motion Height Transitions](https://medium.com/@pkrystkiewicz/framer-motion-animating-height-transitions-in-react-166ca55d4262)
- [Framer Motion Layout Animations](https://www.framer.com/motion/layout-animations/)
- AI SDK source code: `node_modules/ai/dist/index.mjs` and `node_modules/ai/dist/index.d.ts`
- Existing codebase: `src/components/chat/thinking-block.tsx`, `src/components/journey/chat-message.tsx`, `src/app/api/journey/stream/route.ts`
